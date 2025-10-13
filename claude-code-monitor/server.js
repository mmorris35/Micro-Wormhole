'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();
const logger = require('./lib/logger');
const { db, closeDatabase } = require('./lib/database');
const sessionsDb = require('./lib/sessions-db');
const ptyManager = require('./lib/pty-manager');
const sessionManager = require('./lib/session-manager');
const usersUtil = require('./lib/users');

// Configuration
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: '*', // Since this is on private Tailscale network
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

// Socket.io connection handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id} from ${socket.handshake.address}`);

    // Send welcome message
    socket.emit('message', { text: 'Connected to Claude Code Monitor' });

    // Get available users
    socket.on('users:list', () => {
        try {
            const users = usersUtil.getSystemUsers();
            const usernames = users.map(u => u.username);
            socket.emit('users:list', { users: usernames });
        } catch (error) {
            logger.error('Failed to get users list:', error);
            socket.emit('error', { message: 'Failed to get users list' });
        }
    });

    // Session lifecycle events
    socket.on('session:create', async (data) => {
        try {
            const { name, command, workingDirectory, runAsUser } = data;
            const session = await sessionManager.createSession({
                name,
                command,
                workingDirectory,
                runAsUser
            });
            socket.emit('session:created', { session });
            io.emit('session:list', { sessions: sessionManager.getAllSessions() });
            logger.info(`Session created: ${session.id} by ${socket.id}`);
        } catch (error) {
            logger.error('Error creating session:', error);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('session:list', () => {
        try {
            const sessions = sessionManager.getAllSessions();
            socket.emit('session:list', { sessions });
        } catch (error) {
            logger.error('Error listing sessions:', error);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('session:attach', (data) => {
        try {
            const { sessionId } = data;
            const result = sessionManager.attachSession(sessionId, socket.id);

            // Join Socket.io room for this session
            socket.join(sessionId);

            // Send session data and buffer
            socket.emit('session:attached', {
                session: result.session,
                buffer: result.buffer,
                connectedClients: result.connectedClients
            });

            logger.info(`Socket ${socket.id} attached to session ${sessionId}`);
        } catch (error) {
            logger.error('Error attaching to session:', error);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('session:detach', (data) => {
        try {
            const { sessionId } = data;
            sessionManager.detachSession(sessionId, socket.id);

            // Leave Socket.io room
            socket.leave(sessionId);

            socket.emit('session:detached', { sessionId });
            logger.info(`Socket ${socket.id} detached from session ${sessionId}`);
        } catch (error) {
            logger.error('Error detaching from session:', error);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('session:stop', (data) => {
        try {
            const { sessionId } = data;
            sessionManager.stopSession(sessionId);
            io.to(sessionId).emit('session:status', { sessionId, status: 'stopped' });
            logger.info(`Session stopped: ${sessionId} by ${socket.id}`);
        } catch (error) {
            logger.error('Error stopping session:', error);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('session:delete', (data) => {
        try {
            const { sessionId } = data;
            sessionManager.deleteSession(sessionId);
            io.emit('session:deleted', { sessionId });
            io.emit('session:list', { sessions: sessionManager.getAllSessions() });
            logger.info(`Session deleted: ${sessionId} by ${socket.id}`);
        } catch (error) {
            logger.error('Error deleting session:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Terminal I/O events
    socket.on('terminal:input', (data) => {
        try {
            const { sessionId, data: inputData } = data;
            sessionManager.writeToSession(sessionId, inputData);
        } catch (error) {
            logger.error('Error writing to terminal:', error);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('terminal:resize', (data) => {
        try {
            const { sessionId, cols, rows } = data;
            sessionManager.resizeSession(sessionId, cols, rows);
            logger.debug(`Terminal resized for session ${sessionId}: ${cols}x${rows}`);
        } catch (error) {
            logger.error('Error resizing terminal:', error);
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} - Reason: ${reason}`);

        // Clean up: detach from all sessions
        // (In a real implementation, you'd track which sessions this socket is attached to)
    });

    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });
});

// Forward session-manager events to Socket.io rooms
sessionManager.on('output', (sessionId, data) => {
    io.to(sessionId).emit('terminal:output', { sessionId, data });
});

sessionManager.on('status', (sessionId, status) => {
    io.to(sessionId).emit('session:status', { sessionId, status });
});

sessionManager.on('exit', (sessionId, exitCode, status) => {
    io.to(sessionId).emit('session:status', { sessionId, status });
    io.emit('session:list', { sessions: sessionManager.getAllSessions() });
});

sessionManager.on('deleted', (sessionId) => {
    io.emit('session:deleted', { sessionId });
    io.emit('session:list', { sessions: sessionManager.getAllSessions() });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Cache control for static assets
app.use((req, res, next) => {
    if (req.url.match(/\.(html|css|js)$/)) {
        if (NODE_ENV === 'production') {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        } else {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    maxAge: NODE_ENV === 'production' ? '1d' : 0
}));

// ===== File Upload Configuration =====

const multer = require('multer');

/**
 * Copy file to destination with correct ownership
 * Phase 6 will add sudo support for different users
 */
// eslint-disable-next-line no-unused-vars
async function copyFileToSession(sourcePath, destPath, runAsUser) {
    try {
        // Phase 5: Simple copy (current user only)
        fs.copyFileSync(sourcePath, destPath);
        logger.info(`File copied: ${destPath}`);

        // Phase 6 will add:
        // - sudo cp ${sourcePath} ${destPath}
        // - sudo chown ${runAsUser}:${runAsUser} ${destPath}

        return true;
    } catch (error) {
        logger.error('File copy failed:', error);
        throw error;
    }
}

// Ensure uploads directory exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`Created uploads directory: ${UPLOAD_DIR}`);
}

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-uuid-originalname
        const uniqueSuffix = Date.now() + '-' + crypto.randomUUID();
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE) || 104857600 // 100MB
    },
    fileFilter: (req, file, cb) => {
        // Accept all file types
        cb(null, true);
    }
});

// Socket.io test endpoint
app.get('/api/test-socket', (req, res) => {
    const connectedClients = io.engine.clientsCount;
    res.json({
        status: 'ok',
        connectedClients: connectedClients,
        message: 'Socket.io is working'
    });
});

// Shutdown test endpoint (remove in production)
if (NODE_ENV === 'development') {
    app.post('/api/shutdown', (req, res) => {
        res.json({ message: 'Shutdown initiated' });
        setTimeout(() => gracefulShutdown('API_REQUEST'), 100);
    });
}

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Get database stats
    let dbStats = { status: 'unknown' };
    try {
        const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
        dbStats = {
            status: 'ok',
            sessions: sessionCount.count
        };
    } catch (error) {
        logger.error('Error getting database stats:', error);
        dbStats = {
            status: 'error',
            error: error.message
        };
    }

    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
        },
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
        },
        socketio: {
            connected: io.engine.clientsCount
        },
        database: dbStats,
        environment: NODE_ENV
    };

    res.json(health);
});

// Status endpoint with version info
app.get('/api/status', (req, res) => {
    const packageJson = require('./package.json');

    res.json({
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        node: process.version,
        status: 'running'
    });
});

// Session management endpoints (for testing)
if (NODE_ENV === 'development') {
    app.get('/api/sessions', (req, res) => {
        try {
            const sessions = sessionsDb.getAllSessions();
            res.json({ sessions });
        } catch (error) {
            logger.error('Error getting sessions:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/sessions', (req, res) => {
        try {
            const { name, command, workingDirectory, runAsUser } = req.body;
            const session = sessionsDb.createSession({
                name,
                command,
                workingDirectory,
                runAsUser: runAsUser || process.env.USER
            });
            res.json({ session });
        } catch (error) {
            logger.error('Error creating session:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/sessions/:id', (req, res) => {
        try {
            const deleted = sessionsDb.deleteSession(req.params.id);
            if (deleted) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Session not found' });
            }
        } catch (error) {
            logger.error('Error deleting session:', error);
            res.status(500).json({ error: error.message });
        }
    });
}

// File upload endpoint
app.post('/api/upload/:sessionId', upload.single('file'), async (req, res) => {
    const { sessionId } = req.params;
    const file = req.file;

    // Validation
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!sessionId) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Session ID required' });
    }

    try {
        // Get session from database
        const session = sessionsDb.getSession(sessionId);
        if (!session) {
            // Clean up uploaded file
            fs.unlinkSync(file.path);
            return res.status(404).json({ error: 'Session not found' });
        }

        // Validate session is running
        if (session.status !== 'running') {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Session is not running' });
        }

        // Validate working directory exists
        if (!fs.existsSync(session.working_directory)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Session working directory not found' });
        }

        // Destination path in session working directory
        const destPath = path.join(session.working_directory, file.originalname);
        const tempPath = file.path;

        logger.info(`Uploading file to session ${sessionId}: ${file.originalname}`);

        // Copy file to session directory and set ownership
        await copyFileToSession(tempPath, destPath, session.run_as_user);

        // Clean up temp file
        fs.unlinkSync(tempPath);

        logger.info(`File uploaded successfully: ${destPath}`);

        // Emit event to connected clients
        io.to(sessionId).emit('file:uploaded', {
            sessionId,
            filename: file.originalname,
            path: destPath
        });

        res.json({
            success: true,
            filename: file.originalname,
            path: destPath
        });

    } catch (error) {
        logger.error(`File upload failed for session ${sessionId}:`, error);

        // Clean up temp file if it exists
        if (file && file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        res.status(500).json({ error: error.message });
    }
});

// Handle multer errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large (max 100MB)' });
        }
        return res.status(400).json({ error: error.message });
    }
    next(error);
});

// 404 handler
app.use((req, res) => {
    logger.warn(`404 - Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`, { stack: err.stack });
    res.status(err.status || 500).json({
        error: NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// Graceful shutdown handler
let isShuttingDown = false;

function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.warn('Shutdown already in progress...');
        return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Close HTTP server (stops accepting new connections)
    server.close(() => {
        logger.info('HTTP server closed');

        // Close all Socket.io connections
        io.close(() => {
            logger.info('Socket.io connections closed');

            // Close database connection
            closeDatabase();

            // Kill all PTY processes
            ptyManager.killAll();

            logger.info('Graceful shutdown complete');
            process.exit(0);
        });
    });

    // Force shutdown after timeout
    const shutdownTimeout = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000); // 10 second timeout

    shutdownTimeout.unref();
}

// Start server
function startServer() {
    server.listen(PORT, HOST, () => {
        const packageJson = require('./package.json');

        logger.info('='.repeat(60));
        logger.info(`${packageJson.name} v${packageJson.version}`);
        logger.info('='.repeat(60));
        logger.info(`Environment: ${NODE_ENV}`);
        logger.info(`Node version: ${process.version}`);
        logger.info(`Listening on: http://${HOST}:${PORT}`);
        logger.info(`Health check: http://${HOST}:${PORT}/api/health`);
        logger.info(`Status: http://${HOST}:${PORT}/api/status`);
        logger.info('='.repeat(60));
        logger.info('Server ready. Press Ctrl+C to stop');
    });
}

// Export for testing
module.exports = { app, server, io, startServer };

// Start if run directly
if (require.main === module) {
    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
        gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection:', { reason, promise });
        gracefulShutdown('UNHANDLED_REJECTION');
    });

    startServer();
}
