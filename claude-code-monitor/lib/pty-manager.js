'use strict';

const pty = require('node-pty');
const logger = require('./logger');
const EventEmitter = require('events');
require('dotenv').config();

const PTY_COLS = parseInt(process.env.PTY_COLS) || 80;
const PTY_ROWS = parseInt(process.env.PTY_ROWS) || 24;
const PROCESS_KILL_TIMEOUT = parseInt(process.env.PROCESS_KILL_TIMEOUT) || 5000;

class PTYManager extends EventEmitter {
    constructor() {
        super();
        this.processes = new Map(); // sessionId -> ptyProcess
        this.buffers = new Map(); // sessionId -> circular buffer
        this.SESSION_OUTPUT_BUFFER_SIZE = parseInt(process.env.SESSION_OUTPUT_BUFFER_SIZE) || 1000;
    }

    /**
     * Spawn a new PTY process for a session
     * Uses sudo to run as specified user
     */
    spawn(sessionId, command, workingDirectory, runAsUser) {
        if (this.processes.has(sessionId)) {
            throw new Error(`Session ${sessionId} already has an active process`);
        }

        try {
            let ptyProcess;

            if (runAsUser && runAsUser !== process.env.USER) {
                // Spawn bash as different user using sudo
                logger.info(`Spawning PTY as user ${runAsUser} for session ${sessionId}`);

                ptyProcess = pty.spawn('sudo', ['-u', runAsUser, 'bash', '-l'], {
                    name: 'xterm-color',
                    cols: PTY_COLS,
                    rows: PTY_ROWS,
                    cwd: workingDirectory,
                    env: process.env
                });
            } else {
                // Spawn bash as current user (no sudo)
                logger.info(`Spawning PTY as current user for session ${sessionId}`);
                const shell = process.env.SHELL || 'bash';

                ptyProcess = pty.spawn(shell, ['-l'], {
                    name: 'xterm-color',
                    cols: PTY_COLS,
                    rows: PTY_ROWS,
                    cwd: workingDirectory,
                    env: process.env
                });
            }

            logger.info(`PTY spawned for session ${sessionId}: PID ${ptyProcess.pid}`);

            // Initialize circular buffer
            this.buffers.set(sessionId, []);

            // Handle data output
            ptyProcess.onData((data) => {
                this.addToBuffer(sessionId, data);
                this.emit('output', sessionId, data);
            });

            // Handle process exit
            ptyProcess.onExit(({ exitCode, signal }) => {
                logger.info(`PTY process exited for session ${sessionId}: code=${exitCode}, signal=${signal}`);
                const status = exitCode === 0 ? 'completed' : 'failed';
                this.emit('exit', sessionId, exitCode, status);
                this.processes.delete(sessionId);
            });

            this.processes.set(sessionId, ptyProcess);

            // Execute the command
            if (command) {
                ptyProcess.write(`${command}\r`);
            }

            return ptyProcess.pid;
        } catch (error) {
            logger.error(`Failed to spawn PTY for session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Write data to PTY process
     */
    write(sessionId, data) {
        const ptyProcess = this.processes.get(sessionId);
        if (!ptyProcess) {
            throw new Error(`No process found for session ${sessionId}`);
        }
        ptyProcess.write(data);
    }

    /**
     * Resize PTY terminal
     */
    resize(sessionId, cols, rows) {
        const ptyProcess = this.processes.get(sessionId);
        if (!ptyProcess) {
            throw new Error(`No process found for session ${sessionId}`);
        }
        ptyProcess.resize(cols, rows);
        logger.debug(`PTY resized for session ${sessionId}: ${cols}x${rows}`);
    }

    /**
     * Kill PTY process
     */
    kill(sessionId) {
        const ptyProcess = this.processes.get(sessionId);
        if (!ptyProcess) {
            return false;
        }

        logger.info(`Killing PTY process for session ${sessionId}`);

        // Try graceful shutdown with SIGTERM
        ptyProcess.kill('SIGTERM');

        // Force kill after timeout
        setTimeout(() => {
            if (this.processes.has(sessionId)) {
                logger.warn(`Force killing PTY process for session ${sessionId}`);
                ptyProcess.kill('SIGKILL');
            }
        }, PROCESS_KILL_TIMEOUT);

        return true;
    }

    /**
     * Get buffered output for a session
     */
    getBuffer(sessionId) {
        return this.buffers.get(sessionId) || [];
    }

    /**
     * Add data to circular buffer
     */
    addToBuffer(sessionId, data) {
        let buffer = this.buffers.get(sessionId);
        if (!buffer) {
            buffer = [];
            this.buffers.set(sessionId, buffer);
        }

        buffer.push(data);

        // Maintain max buffer size (circular buffer)
        if (buffer.length > this.SESSION_OUTPUT_BUFFER_SIZE) {
            buffer.shift();
        }
    }

    /**
     * Check if session has active process
     */
    hasProcess(sessionId) {
        return this.processes.has(sessionId);
    }

    /**
     * Get process info
     */
    getProcessInfo(sessionId) {
        const ptyProcess = this.processes.get(sessionId);
        if (!ptyProcess) {
            return null;
        }
        return {
            pid: ptyProcess.pid,
            cols: ptyProcess.cols,
            rows: ptyProcess.rows
        };
    }

    /**
     * Kill all processes (for shutdown)
     */
    killAll() {
        logger.info(`Killing all PTY processes: ${this.processes.size}`);
        for (const sessionId of this.processes.keys()) {
            this.kill(sessionId);
        }
    }
}

// Singleton instance
const ptyManager = new PTYManager();

module.exports = ptyManager;
