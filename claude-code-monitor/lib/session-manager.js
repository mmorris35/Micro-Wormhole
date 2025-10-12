'use strict';

const sessionsDb = require('./sessions-db');
const ptyManager = require('./pty-manager');
const logger = require('./logger');
const EventEmitter = require('events');
require('dotenv').config();

const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS) || 10;

class SessionManager extends EventEmitter {
    constructor() {
        super();
        this.connectedClients = new Map(); // sessionId -> Set of socketIds

        // Listen to PTY events and forward them
        ptyManager.on('output', (sessionId, data) => {
            this.emit('output', sessionId, data);
        });

        ptyManager.on('exit', (sessionId, exitCode, status) => {
            this.handleProcessExit(sessionId, exitCode, status);
        });
    }

    /**
     * Create a new session
     */
    async createSession({ name, command, workingDirectory, runAsUser }) {
        try {
            // Validate max sessions
            const activeSessions = sessionsDb.getSessionsByStatus('running');
            if (activeSessions.length >= MAX_SESSIONS) {
                throw new Error(`Maximum sessions limit reached (${MAX_SESSIONS})`);
            }

            // Create database record
            const session = sessionsDb.createSession({
                name,
                command,
                workingDirectory,
                runAsUser
            });

            logger.info(`Session created: ${session.id} - ${name}`);

            // Spawn PTY process
            const pid = ptyManager.spawn(
                session.id,
                command,
                workingDirectory,
                runAsUser
            );

            // Update PID in database
            sessionsDb.updateSessionPid(session.id, pid);

            // Initialize connected clients set
            this.connectedClients.set(session.id, new Set());

            // Return updated session
            return sessionsDb.getSession(session.id);
        } catch (error) {
            logger.error('Failed to create session:', error);
            throw error;
        }
    }

    /**
     * Attach a client to a session
     */
    attachSession(sessionId, socketId) {
        const session = sessionsDb.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // Add client to connected clients
        let clients = this.connectedClients.get(sessionId);
        if (!clients) {
            clients = new Set();
            this.connectedClients.set(sessionId, clients);
        }
        clients.add(socketId);

        logger.info(`Client ${socketId} attached to session ${sessionId}`);

        // Return buffered output
        const buffer = ptyManager.getBuffer(sessionId);
        return {
            session,
            buffer,
            connectedClients: clients.size
        };
    }

    /**
     * Detach a client from a session
     */
    detachSession(sessionId, socketId) {
        const clients = this.connectedClients.get(sessionId);
        if (clients) {
            clients.delete(socketId);
            logger.info(`Client ${socketId} detached from session ${sessionId}`);

            // Clean up if no clients connected
            if (clients.size === 0) {
                this.connectedClients.delete(sessionId);
            }
        }
        return true;
    }

    /**
     * Stop a session (send SIGTERM to PTY)
     */
    stopSession(sessionId) {
        const session = sessionsDb.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (ptyManager.hasProcess(sessionId)) {
            logger.info(`Stopping session ${sessionId}`);
            ptyManager.kill(sessionId);
            sessionsDb.updateSessionStatus(sessionId, 'stopped');
            this.emit('status', sessionId, 'stopped');
            return true;
        }

        return false;
    }

    /**
     * Delete a session (kill PTY and remove from DB)
     */
    deleteSession(sessionId) {
        const session = sessionsDb.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // Kill PTY process if running
        if (ptyManager.hasProcess(sessionId)) {
            logger.info(`Killing PTY for session ${sessionId}`);
            ptyManager.kill(sessionId);
        }

        // Remove from database
        sessionsDb.deleteSession(sessionId);

        // Clean up connected clients
        this.connectedClients.delete(sessionId);

        logger.info(`Session deleted: ${sessionId}`);
        this.emit('deleted', sessionId);

        return true;
    }

    /**
     * Get all sessions
     */
    getAllSessions() {
        return sessionsDb.getAllSessions();
    }

    /**
     * Get a single session
     */
    getSession(sessionId) {
        return sessionsDb.getSession(sessionId);
    }

    /**
     * Get connected clients for a session
     */
    getConnectedClients(sessionId) {
        const clients = this.connectedClients.get(sessionId);
        return clients ? Array.from(clients) : [];
    }

    /**
     * Write to PTY
     */
    writeToSession(sessionId, data) {
        if (!ptyManager.hasProcess(sessionId)) {
            throw new Error(`No active process for session ${sessionId}`);
        }
        ptyManager.write(sessionId, data);
    }

    /**
     * Resize PTY
     */
    resizeSession(sessionId, cols, rows) {
        if (!ptyManager.hasProcess(sessionId)) {
            throw new Error(`No active process for session ${sessionId}`);
        }
        ptyManager.resize(sessionId, cols, rows);
    }

    /**
     * Handle PTY process exit
     */
    handleProcessExit(sessionId, exitCode, status) {
        logger.info(`Session ${sessionId} process exited: ${status}`);

        // Update database status
        sessionsDb.updateSessionStatus(sessionId, status);

        // Emit status change
        this.emit('status', sessionId, status);
        this.emit('exit', sessionId, exitCode, status);
    }

    /**
     * Validate max sessions limit
     */
    validateMaxSessions() {
        const activeSessions = sessionsDb.getSessionsByStatus('running');
        return activeSessions.length < MAX_SESSIONS;
    }

    /**
     * Get session count by status
     */
    getSessionCount(status = null) {
        if (status) {
            return sessionsDb.getSessionsByStatus(status).length;
        }
        return sessionsDb.getAllSessions().length;
    }
}

// Singleton instance
const sessionManager = new SessionManager();

module.exports = sessionManager;
