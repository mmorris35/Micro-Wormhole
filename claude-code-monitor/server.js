'use strict';

const express = require('express');
const http = require('http');
require('dotenv').config();
const logger = require('./lib/logger');

// Configuration
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Routes will be added in subsequent tasks
app.get('/', (req, res) => {
    res.send('Claude Code Monitor - Server Running');
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
module.exports = { app, server, startServer };

// Start if run directly
if (require.main === module) {
    startServer();
}
