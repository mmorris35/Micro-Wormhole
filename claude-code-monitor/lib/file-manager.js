'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');

const MAX_FILE_SIZE = 1048576; // 1MB limit for display

/**
 * File Manager - Handle file operations for sessions
 */
class FileManager {
    constructor() {
        this.watchers = new Map(); // sessionId -> FSWatcher
    }

    /**
     * Validate path is within session working directory
     */
    validatePath(sessionWorkingDir, requestedPath) {
        const resolvedPath = path.resolve(sessionWorkingDir, requestedPath);
        const normalizedBase = path.resolve(sessionWorkingDir);

        if (!resolvedPath.startsWith(normalizedBase)) {
            throw new Error('Path traversal attempt detected');
        }

        return resolvedPath;
    }

    /**
     * List files in directory
     */
    async listFiles(sessionWorkingDir, relativePath = '.') {
        try {
            const fullPath = this.validatePath(sessionWorkingDir, relativePath);

            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            const files = [];

            for (const entry of entries) {
                // Skip hidden files and node_modules
                if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }

                const filePath = path.join(relativePath, entry.name);
                const stats = await fs.stat(path.join(fullPath, entry.name));

                files.push({
                    name: entry.name,
                    path: filePath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    modified: stats.mtime
                });
            }

            // Sort: directories first, then alphabetically
            files.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            return files;
        } catch (error) {
            logger.error('Failed to list files:', error);
            throw error;
        }
    }

    /**
     * Read file contents
     */
    async readFile(sessionWorkingDir, filePath) {
        try {
            const fullPath = this.validatePath(sessionWorkingDir, filePath);

            // Check file exists and is a file
            const stats = await fs.stat(fullPath);
            if (!stats.isFile()) {
                throw new Error('Not a file');
            }

            // Check file size
            if (stats.size > MAX_FILE_SIZE) {
                throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
            }

            // Check if binary file
            const buffer = await fs.readFile(fullPath);
            if (this.isBinary(buffer)) {
                throw new Error('Binary files not supported');
            }

            const content = buffer.toString('utf8');

            return {
                path: filePath,
                content: content,
                size: stats.size,
                modified: stats.mtime
            };
        } catch (error) {
            logger.error('Failed to read file:', error);
            throw error;
        }
    }

    /**
     * Check if file is binary
     */
    isBinary(buffer) {
        const chunkSize = Math.min(buffer.length, 8000);
        for (let i = 0; i < chunkSize; i++) {
            const byte = buffer[i];
            if (byte === 0) return true; // NULL byte indicates binary
        }
        return false;
    }

    /**
     * Watch directory for changes
     */
    watchDirectory(sessionId, sessionWorkingDir, io) {
        try {
            // Stop existing watcher if any
            this.stopWatching(sessionId);

            logger.info(`Starting file watch for session ${sessionId}: ${sessionWorkingDir}`);

            const watcher = fsSync.watch(sessionWorkingDir, { recursive: true }, (eventType, filename) => {
                if (!filename) return;

                // Ignore hidden files and node_modules
                if (filename.startsWith('.') || filename.includes('node_modules')) {
                    return;
                }

                logger.debug(`File ${eventType}: ${filename} in session ${sessionId}`);

                // Emit to all clients in session room
                io.to(sessionId).emit('file:changed', {
                    sessionId,
                    filename,
                    eventType
                });
            });

            this.watchers.set(sessionId, watcher);
        } catch (error) {
            logger.error(`Failed to watch directory for session ${sessionId}:`, error);
        }
    }

    /**
     * Stop watching directory
     */
    stopWatching(sessionId) {
        const watcher = this.watchers.get(sessionId);
        if (watcher) {
            watcher.close();
            this.watchers.delete(sessionId);
            logger.info(`Stopped file watch for session ${sessionId}`);
        }
    }

    /**
     * Stop all watchers (for shutdown)
     */
    stopAllWatchers() {
        logger.info(`Stopping all file watchers: ${this.watchers.size}`);
        for (const [, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();
    }
}

// Singleton instance
const fileManager = new FileManager();

module.exports = fileManager;
