'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');
const { getSystemUsers } = require('./users');

class ClaudeSessionScanner {
    constructor() {
        this.sessions = new Map(); // sessionId -> session metadata
        this.watchers = new Map(); // sessionId -> FSWatcher
    }

    /**
     * Decode Claude project directory name to repo path
     * Example: "-home-mmn-github-Micro-Wormhole" -> "/home/mmn/github/Micro-Wormhole"
     */
    decodeProjectPath(dirName) {
        if (!dirName.startsWith('-')) return null;
        return '/' + dirName.substring(1).replace(/-/g, '/');
    }

    /**
     * Encode repo path to Claude project directory name
     * Example: "/home/mmn/github/Micro-Wormhole" -> "-home-mmn-github-Micro-Wormhole"
     */
    encodeProjectPath(repoPath) {
        return '-' + repoPath.replace(/\//g, '-');
    }

    /**
     * Extract repo name from full path
     * Example: "/home/mmn/github/Micro-Wormhole" -> "Micro-Wormhole"
     */
    getRepoName(repoPath) {
        const parts = repoPath.split('/');
        return parts[parts.length - 1];
    }

    /**
     * Check if a Claude Code session is currently active
     */
    async isSessionActive(sessionId) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const { stdout } = await execAsync(`ps aux | grep "claude.*--resume ${sessionId}" | grep -v grep`);
            return stdout.trim().length > 0;
        } catch (error) {
            // grep returns exit code 1 when no match
            return false;
        }
    }

    /**
     * Get session file stats (size, last modified)
     */
    async getSessionStats(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                modified: stats.mtime,
                created: stats.birthtime
            };
        } catch (error) {
            logger.error(`Failed to get stats for ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Count messages in a JSONL session file
     */
    async countMessages(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n');
            return lines.filter(line => line.trim().length > 0).length;
        } catch (error) {
            logger.error(`Failed to count messages in ${filePath}:`, error);
            return 0;
        }
    }

    /**
     * Scan a user's ~/.claude/projects directory
     */
    async scanUserProjects(username) {
        const sessions = [];

        try {
            const userHome = `/home/${username}`;
            const claudeProjectsDir = path.join(userHome, '.claude', 'projects');

            // Check if directory exists
            try {
                await fs.access(claudeProjectsDir);
            } catch {
                logger.debug(`No Claude projects directory for user ${username}`);
                return sessions;
            }

            logger.debug(`Scanning Claude projects for user ${username}: ${claudeProjectsDir}`);

            // Read all project directories
            const projectDirs = await fs.readdir(claudeProjectsDir);
            logger.debug(`Found ${projectDirs.length} project directories for user ${username}`);

            for (const projectDir of projectDirs) {
                const projectPath = path.join(claudeProjectsDir, projectDir);
                const stats = await fs.stat(projectPath);

                if (!stats.isDirectory()) continue;

                const repoPath = this.decodeProjectPath(projectDir);
                if (!repoPath) continue;

                const repoName = this.getRepoName(repoPath);

                // Read all .jsonl files in this project
                const files = await fs.readdir(projectPath);
                const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

                logger.debug(`Found ${jsonlFiles.length} .jsonl files in ${repoPath}`);

                for (const jsonlFile of jsonlFiles) {
                    const sessionId = jsonlFile.replace('.jsonl', '');
                    const sessionFilePath = path.join(projectPath, jsonlFile);

                    const fileStats = await this.getSessionStats(sessionFilePath);
                    if (!fileStats) continue;

                    const isActive = await this.isSessionActive(sessionId);
                    const messageCount = await this.countMessages(sessionFilePath);

                    const session = {
                        id: sessionId,
                        username,
                        repoPath,
                        repoName,
                        filePath: sessionFilePath,
                        isActive,
                        messageCount,
                        fileSize: fileStats.size,
                        lastModified: fileStats.modified,
                        created: fileStats.created,
                        type: 'claude-code'
                    };

                    sessions.push(session);
                    this.sessions.set(sessionId, session);
                }
            }

            logger.info(`Scanned ${sessions.length} Claude Code sessions for user ${username}`);
        } catch (error) {
            logger.error(`Failed to scan projects for user ${username}:`, error);
        }

        return sessions;
    }

    /**
     * Scan all system users for Claude Code sessions
     */
    async scanAllSessions() {
        const allSessions = [];

        try {
            const users = getSystemUsers();
            logger.info(`Scanning Claude Code sessions for ${users.length} users`);

            for (const user of users) {
                const userSessions = await this.scanUserProjects(user.username);
                allSessions.push(...userSessions);
            }

            logger.info(`Found ${allSessions.length} total Claude Code sessions`);
        } catch (error) {
            logger.error('Failed to scan all sessions:', error);
        }

        return allSessions;
    }

    /**
     * Watch a session file for changes
     */
    watchSession(sessionId, io) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            logger.warn(`Cannot watch unknown session: ${sessionId}`);
            return;
        }

        // Stop any existing watcher
        this.stopWatching(sessionId);

        try {
            logger.info(`Watching Claude session ${sessionId}: ${session.filePath}`);

            const watcher = fsSync.watch(session.filePath, (eventType) => {
                if (eventType === 'change') {
                    logger.debug(`Claude session file changed: ${sessionId}`);

                    // Notify clients that session was updated
                    io.to(`claude-${sessionId}`).emit('claude:session:updated', {
                        sessionId,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            this.watchers.set(sessionId, watcher);
        } catch (error) {
            logger.error(`Failed to watch session ${sessionId}:`, error);
        }
    }

    /**
     * Stop watching a session
     */
    stopWatching(sessionId) {
        const watcher = this.watchers.get(sessionId);
        if (watcher) {
            watcher.close();
            this.watchers.delete(sessionId);
            logger.info(`Stopped watching Claude session ${sessionId}`);
        }
    }

    /**
     * Stop all watchers
     */
    stopAllWatchers() {
        logger.info(`Stopping all Claude session watchers: ${this.watchers.size}`);
        for (const [, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();
    }

    /**
     * Get session by ID
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * Group sessions by repository
     */
    getSessionsByRepo() {
        const byRepo = new Map();

        for (const session of this.sessions.values()) {
            if (!byRepo.has(session.repoPath)) {
                byRepo.set(session.repoPath, []);
            }
            byRepo.get(session.repoPath).push(session);
        }

        return Object.fromEntries(byRepo);
    }
}

const scanner = new ClaudeSessionScanner();
module.exports = scanner;
