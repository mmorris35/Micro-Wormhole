'use strict';

const { db } = require('./database');
const logger = require('./logger');
const crypto = require('crypto');

/**
 * Session Data Access Layer
 */

// Create new session
function createSession({ name, command, workingDirectory, runAsUser }) {
    const id = crypto.randomUUID();

    const sql = `
        INSERT INTO sessions (id, name, command, working_directory, run_as_user, status)
        VALUES (?, ?, ?, ?, ?, 'running')
    `;

    try {
        const stmt = db.prepare(sql);
        stmt.run(id, name, command, workingDirectory, runAsUser);
        logger.info(`Session created: ${id} - ${name}`);
        return getSession(id);
    } catch (error) {
        logger.error(`Failed to create session: ${error.message}`);
        throw error;
    }
}

// Get session by ID
function getSession(id) {
    const sql = 'SELECT * FROM sessions WHERE id = ?';
    const stmt = db.prepare(sql);
    return stmt.get(id);
}

// Get all sessions
function getAllSessions() {
    const sql = 'SELECT * FROM sessions ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    return stmt.all();
}

// Update session status
function updateSessionStatus(id, status) {
    const sql = 'UPDATE sessions SET status = ? WHERE id = ?';

    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(status, id);
        if (result.changes > 0) {
            logger.info(`Session ${id} status updated to: ${status}`);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`Failed to update session status: ${error.message}`);
        throw error;
    }
}

// Update session PID
function updateSessionPid(id, pid) {
    const sql = 'UPDATE sessions SET pid = ? WHERE id = ?';

    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(pid, id);
        return result.changes > 0;
    } catch (error) {
        logger.error(`Failed to update session PID: ${error.message}`);
        throw error;
    }
}

// Delete session
function deleteSession(id) {
    const sql = 'DELETE FROM sessions WHERE id = ?';

    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(id);
        if (result.changes > 0) {
            logger.info(`Session deleted: ${id}`);
            return true;
        }
        return false;
    } catch (error) {
        logger.error(`Failed to delete session: ${error.message}`);
        throw error;
    }
}

// Get sessions by status
function getSessionsByStatus(status) {
    const sql = 'SELECT * FROM sessions WHERE status = ? ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    return stmt.all(status);
}

// Get sessions by user
function getSessionsByUser(runAsUser) {
    const sql = 'SELECT * FROM sessions WHERE run_as_user = ? ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    return stmt.all(runAsUser);
}

module.exports = {
    createSession,
    getSession,
    getAllSessions,
    updateSessionStatus,
    updateSessionPid,
    deleteSession,
    getSessionsByStatus,
    getSessionsByUser
};
