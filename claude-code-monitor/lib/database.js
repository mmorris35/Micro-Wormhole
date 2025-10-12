'use strict';

const Database = require('better-sqlite3');
const logger = require('./logger');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './sessions.db';

// Initialize database
const db = new Database(DB_PATH, {
    verbose: (message) => logger.debug(`Database: ${message}`)
});

// Enable foreign keys and WAL mode for better concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

logger.info(`Database initialized: ${DB_PATH}`);

// Create sessions table
const createSessionsTable = () => {
    const sql = `
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'running' CHECK(status IN ('running', 'stopped', 'completed', 'failed')),
            command TEXT,
            working_directory TEXT,
            pid INTEGER,
            run_as_user TEXT NOT NULL
        )
    `;

    try {
        db.exec(sql);
        logger.info('Sessions table ready');
    } catch (error) {
        logger.error('Failed to create sessions table:', error);
        throw error;
    }
};

// Initialize schema
createSessionsTable();

// Graceful database shutdown
function closeDatabase() {
    try {
        db.close();
        logger.info('Database connection closed');
    } catch (error) {
        logger.error('Error closing database:', error);
    }
}

module.exports = { db, closeDatabase };
