'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();
const logger = require('./lib/logger');

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

// Start server
function startServer() {
    server.listen(PORT, HOST, () => {
        logger.info(`Server started in ${NODE_ENV} mode`);
        logger.info(`Listening on http://${HOST}:${PORT}`);
        logger.info('Press Ctrl+C to stop');
    });
}

// Export for testing
module.exports = { app, server, io, startServer };

// Start if run directly
if (require.main === module) {
    startServer();
}
