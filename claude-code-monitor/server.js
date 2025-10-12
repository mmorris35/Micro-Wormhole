'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();
const logger = require('./lib/logger');
const { db, closeDatabase } = require('./lib/database');
const sessionsDb = require('./lib/sessions-db');

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

    // Test event handler
    socket.on('test-event', (data) => {
        logger.info(`Test event from ${socket.id}: ${JSON.stringify(data)}`);
        socket.emit('test-response', { received: true, echo: data });
    });

    socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} - Reason: ${reason}`);
    });

    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });
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

            // Additional cleanup will be added later
            // - Kill PTY processes

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
