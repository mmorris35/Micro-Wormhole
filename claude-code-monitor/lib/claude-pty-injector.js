'use strict';

const pty = require('node-pty');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const EventEmitter = require('events');

class ClaudePTYInjector extends EventEmitter {
    constructor() {
        super();
        this.processes = new Map(); // sessionId -> { pty, buffer, pending }
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

            // Verify binary exists and is executable
            await fs.access(binaryPath, fs.constants.X_OK);

            return binaryPath;
        } catch (error) {
            logger.error(`Failed to get Claude binary for ${username}:`, error);
            throw error;
        }
    }

    /**
     * Spawn Claude process in PTY for session
     *
     * @param {string} sessionId - Claude session ID
     * @param {string} username - User who owns the session
     * @param {string} repoPath - Repository path (working directory)
     * @returns {Promise<void>}
     */
    async spawnClaudeSession(sessionId, username, repoPath) {
        if (this.processes.has(sessionId)) {
            logger.warn(`Claude PTY already exists for session ${sessionId}`);
            return;
        }

        try {
            const binaryPath = await this.getClaudeBinary(username);

            logger.info(`Spawning Claude PTY for session ${sessionId} as ${username}`);

            // Spawn Claude in PTY as session owner
            const claudePty = pty.spawn('sudo', [
                '-u', username,
                binaryPath,
                '--resume', sessionId,
                '--input-format', 'stream-json',
                '--output-format', 'stream-json',
                '--print',
                '--debug-to-stderr'
            ], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: repoPath,
                env: process.env
            });

            // Track process
            const processInfo = {
                pty: claudePty,
                buffer: '',
                pending: [],
                sessionId,
                username,
                repoPath
            };

            this.processes.set(sessionId, processInfo);

            // Handle data output (JSONL responses)
            claudePty.onData((data) => {
                this.handleClaudeOutput(sessionId, data);
            });

            // Handle process exit
            claudePty.onExit(({ exitCode, signal }) => {
                logger.info(`Claude PTY exited for session ${sessionId}: code=${exitCode}, signal=${signal}`);
                this.emit('session:closed', sessionId, exitCode);
                this.processes.delete(sessionId);
            });

            // Give Claude a moment to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            logger.info(`Claude PTY ready for session ${sessionId}: PID ${claudePty.pid}`);

            this.emit('session:ready', sessionId);

        } catch (error) {
            logger.error(`Failed to spawn Claude PTY for session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Handle output from Claude PTY
     */
    handleClaudeOutput(sessionId, data) {
        const processInfo = this.processes.get(sessionId);
        if (!processInfo) return;

        processInfo.buffer += data;

        // Parse JSONL lines
        const lines = processInfo.buffer.split('\n');

        // Keep last incomplete line in buffer
        processInfo.buffer = lines.pop() || '';

        // Process complete lines
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            try {
                const message = JSON.parse(trimmed);

                // Emit different events based on message type
                if (message.type === 'assistant') {
                    logger.info(`Claude response received for session ${sessionId}`);
                    this.emit('message:assistant', sessionId, message);
                } else if (message.type === 'error') {
                    logger.error(`Claude error in session ${sessionId}:`, message);
                    this.emit('message:error', sessionId, message);
                } else {
                    this.emit('message:other', sessionId, message);
                }

            } catch (error) {
                // Not valid JSON, might be debug output or stderr
                logger.debug(`Non-JSON output from Claude PTY ${sessionId}: ${trimmed}`);
            }
        });
    }

    /**
     * Send message to Claude via PTY
     *
     * @param {string} sessionId - Session ID
     * @param {string} message - Message text
     * @returns {Promise<void>}
     */
    async sendMessage(sessionId, message) {
        const processInfo = this.processes.get(sessionId);

        if (!processInfo) {
            // Session not spawned yet, spawn it first
            throw new Error('Claude PTY session not initialized. Call spawnClaudeSession first.');
        }

        try {
            // Format as JSONL user message
            const messageObj = {
                type: 'user',
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: message
                    }
                ],
                timestamp: new Date().toISOString(),
                uuid: uuidv4()
            };

            const jsonLine = JSON.stringify(messageObj);

            logger.info(`Sending message to Claude PTY session ${sessionId}`);
            logger.debug(`Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

            // Write to PTY stdin
            processInfo.pty.write(jsonLine + '\n');

            this.emit('message:sent', sessionId, messageObj);

        } catch (error) {
            logger.error(`Failed to send message to Claude PTY ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Send message with file attachment
     *
     * @param {string} sessionId - Session ID
     * @param {string} message - Message text
     * @param {string} filePath - Relative path to file in repo
     * @returns {Promise<void>}
     */
    async sendMessageWithFile(sessionId, message, filePath) {
        const processInfo = this.processes.get(sessionId);
        if (!processInfo) {
            throw new Error('Claude PTY session not initialized');
        }

        try {
            // Read file content
            const fullPath = path.join(processInfo.repoPath, filePath);
            const content = await fs.readFile(fullPath, 'utf8');

            // Format message with file context
            const messageWithFile = `${message}\n\nFile: ${filePath}\n\`\`\`\n${content}\n\`\`\``;

            return await this.sendMessage(sessionId, messageWithFile);
        } catch (error) {
            logger.error('Failed to send message with file:', error);
            throw error;
        }
    }

    /**
     * Close Claude PTY session
     */
    closeSession(sessionId) {
        const processInfo = this.processes.get(sessionId);
        if (!processInfo) {
            return false;
        }

        logger.info(`Closing Claude PTY session ${sessionId}`);

        // Send EOF to stdin
        processInfo.pty.write('\x04'); // Ctrl+D

        // Force kill after timeout
        setTimeout(() => {
            if (this.processes.has(sessionId)) {
                logger.warn(`Force killing Claude PTY session ${sessionId}`);
                processInfo.pty.kill('SIGKILL');
            }
        }, 5000);

        return true;
    }

    /**
     * Check if session has active PTY
     */
    hasSession(sessionId) {
        return this.processes.has(sessionId);
    }

    /**
     * Validate user has permission to inject into session
     */
    validatePermission(username, sessionOwner) {
        // Only session owner can inject messages
        if (username !== sessionOwner) {
            throw new Error('Permission denied: not session owner');
        }
        return true;
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
