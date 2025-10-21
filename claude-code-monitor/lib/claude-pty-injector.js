'use strict';

const pty = require('node-pty');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const EventEmitter = require('events');

class ClaudePTYInjector extends EventEmitter {
    constructor() {
        super();
        this.processes = new Map(); // sessionId -> { pty, username, repoPath, createdAt }
    }

    /**
     * Get Claude binary path for a user
     */
    async getClaudeBinary(username) {
        try {
            const userHome = `/home/${username}`;
            const vscodeServerDir = path.join(userHome, '.vscode-server', 'extensions');

            // Find Claude extension directory
            const entries = await fs.readdir(vscodeServerDir);
            const claudeDirs = entries.filter(e => e.startsWith('anthropic.claude-code-'));

            if (claudeDirs.length === 0) {
                throw new Error('Claude Code extension not found');
            }

            // Use latest version (sorted alphabetically)
            const latestDir = claudeDirs.sort().pop();
            const binaryPath = path.join(
                vscodeServerDir,
                latestDir,
                'resources',
                'native-binary',
                'claude'
            );

            logger.info(`Found Claude extension directory: ${latestDir}`);

            // Verify binary exists and is executable
            await fs.access(binaryPath, fs.constants.X_OK);

            logger.info(`Claude binary verified: ${binaryPath}`);
            return binaryPath;
        } catch (error) {
            logger.error(`Failed to get Claude binary for ${username}:`, error);
            throw error;
        }
    }

    /**
     * Find newest Claude session JSONL in a repo directory
     *
     * @param {string} username - User who owns sessions
     * @param {string} repoPath - Repository path
     * @returns {Promise<string|null>} - Session ID or null
     */
    async findNewestSession(username, repoPath) {
        try {
            // Get repo directory name (e.g., "/home/mmn/github/Foo" -> "-home-mmn-github-Foo")
            const repoDir = repoPath.replace(/\//g, '-');
            const sessionDir = path.join(`/home/${username}/.claude/projects`, repoDir);

            // List all JSONL files
            const files = await fs.readdir(sessionDir);
            const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

            if (jsonlFiles.length === 0) {
                return null;
            }

            // Get stats for each file
            const fileStats = await Promise.all(
                jsonlFiles.map(async (file) => {
                    const filePath = path.join(sessionDir, file);
                    const stats = await fs.stat(filePath);
                    return {
                        sessionId: file.replace('.jsonl', ''),
                        mtime: stats.mtime
                    };
                })
            );

            // Sort by modification time (newest first)
            fileStats.sort((a, b) => b.mtime - a.mtime);

            return fileStats[0].sessionId;

        } catch (error) {
            logger.error(`Failed to find newest session in ${repoPath}:`, error);
            return null;
        }
    }

    /**
     * Spawn NEW Claude process in PTY for interactive session
     * Creates a brand new Claude session with full repo context
     *
     * @param {string} username - User who owns the session
     * @param {string} repoPath - Repository path (working directory)
     * @returns {Promise<string>} - The new session ID
     */
    async spawnNewClaudeSession(username, repoPath) {
        try {
            logger.info(`Creating NEW Claude session for user=${username}, repo=${repoPath}`);
            const binaryPath = await this.getClaudeBinary(username);

            const claudeArgs = [
                '--verbose',
                '--dangerously-skip-permissions',
                '--debug-to-stderr'
            ];

            const claudePty = pty.spawn('sudo', [
                '-u', username,
                binaryPath,
                ...claudeArgs
            ], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: repoPath,
                env: {
                    HOME: `/home/${username}`,
                    USER: username,
                    LOGNAME: username,
                    PATH: process.env.PATH,
                    SHELL: '/bin/bash'
                }
            });

            logger.info(`Claude PTY spawned: PID ${claudePty.pid}`);

            // Simple approach: wait for initialization, then find session
            return new Promise((resolve, reject) => {
                let bypassSent = false;

                // Auto-accept bypass prompt
                const dataHandler = (data) => {
                    if (!bypassSent && data.includes('Yes, I accept')) {
                        logger.info('Auto-accepting bypass permissions...');
                        setTimeout(() => {
                            claudePty.write('2\r');
                            bypassSent = true;
                            logger.info('Bypass accepted');
                        }, 500);
                    }
                };

                claudePty.onData(dataHandler);

                claudePty.onExit(({ exitCode }) => {
                    logger.error(`Claude PTY exited during init: code=${exitCode}`);
                    reject(new Error(`Claude exited during initialization: ${exitCode}`));
                });

                // Wait 8 seconds for warmup to complete
                setTimeout(async () => {
                    try {
                        // Find newest session JSONL in this repo
                        const sessionId = await this.findNewestSession(username, repoPath);

                        if (!sessionId) {
                            claudePty.kill();
                            return reject(new Error('Could not find new session JSONL file'));
                        }

                        logger.info(`Found new session: ${sessionId}`);

                        // Store process info
                        const processInfo = {
                            pty: claudePty,
                            username,
                            repoPath,
                            sessionId,
                            createdAt: new Date()
                        };

                        this.processes.set(sessionId, processInfo);

                        // Remove temp handler, add permanent one
                        claudePty.removeAllListeners('data');
                        claudePty.onData((data) => {
                            logger.debug(`Claude ${sessionId} output: ${data.substring(0, 100)}`);
                        });

                        claudePty.onExit(({ exitCode }) => {
                            logger.info(`Claude session ${sessionId} exited: ${exitCode}`);
                            this.processes.delete(sessionId);
                            this.emit('session:closed', sessionId, exitCode);
                        });

                        this.emit('session:ready', sessionId);
                        resolve(sessionId);

                    } catch (error) {
                        logger.error('Failed to find session:', error);
                        claudePty.kill();
                        reject(error);
                    }
                }, 8000);
            });

        } catch (error) {
            logger.error('Failed to spawn Claude session:', error);
            throw error;
        }
    }

    /**
     * Send message to Claude via PTY using bracketed paste mode
     * Based on AgentAPI implementation
     *
     * @param {string} sessionId - Session ID
     * @param {string} message - Message text
     * @returns {Promise<void>}
     */
    async sendMessage(sessionId, message) {
        const processInfo = this.processes.get(sessionId);

        if (!processInfo) {
            throw new Error(`Claude PTY session ${sessionId} not found. Create session first.`);
        }

        try {
            logger.info(`Sending message to Claude PTY session ${sessionId}`);
            logger.debug(`Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

            // Use bracketed paste mode (AgentAPI method)
            // Format: 'x\b' + '\x1b[200~' + message + '\x1b[201~'
            const formatted = 'x\b\x1b[200~' + message + '\x1b[201~';

            processInfo.pty.write(formatted);

            logger.info(`Message sent via bracketed paste to session ${sessionId}`);
            this.emit('message:sent', sessionId, message);

        } catch (error) {
            logger.error(`Failed to send message to Claude PTY ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Close a Claude PTY session
     *
     * @param {string} sessionId - Session ID to close
     */
    closeSession(sessionId) {
        const processInfo = this.processes.get(sessionId);
        if (!processInfo) {
            logger.warn(`Cannot close session ${sessionId}: not found`);
            return;
        }

        logger.info(`Closing Claude PTY session ${sessionId}`);

        try {
            processInfo.pty.kill();
        } catch (error) {
            logger.error(`Error killing PTY for ${sessionId}:`, error);
        }

        this.processes.delete(sessionId);
        this.emit('session:closed', sessionId, 0);
    }

    /**
     * Check if session exists
     */
    hasSession(sessionId) {
        return this.processes.has(sessionId);
    }

    /**
     * Get session info
     */
    getSessionInfo(sessionId) {
        const processInfo = this.processes.get(sessionId);
        if (!processInfo) {
            return null;
        }

        return {
            sessionId,
            username: processInfo.username,
            repoPath: processInfo.repoPath,
            createdAt: processInfo.createdAt,
            pid: processInfo.pty.pid
        };
    }

    /**
     * Get all active session IDs
     */
    getActiveSessions() {
        return Array.from(this.processes.keys());
    }

    /**
     * Close all PTY sessions (for shutdown)
     */
    closeAll() {
        logger.info(`Closing all Claude PTY sessions: ${this.processes.size}`);
        for (const sessionId of this.processes.keys()) {
            this.closeSession(sessionId);
        }
    }
}

const injector = new ClaudePTYInjector();
module.exports = injector;
