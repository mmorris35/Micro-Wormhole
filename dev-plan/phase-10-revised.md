# Phase 10: Inject Prompts into Claude Code Sessions (PTY-Based Approach)

**Branch**: `phase-10-session-injection`
**Duration**: ~7 hours
**Prerequisites**: Phase 9 complete
**Approach**: PTY-based Claude control (AgentAPI method)

## Phase Objectives
- Create PTY-based Claude injector module
- Spawn independent Claude processes in pseudoterminals
- Send messages via terminal stdin (JSONL format)
- Parse responses from terminal stdout
- Add input UI for sending messages to Claude
- Handle Claude's response in real-time
- Support file attachments with prompts
- Ensure proper authentication and permissions

## Phase Completion Criteria
- [ ] PTY-based Claude injector module created
- [ ] Independent Claude processes spawn successfully
- [ ] Messages send to Claude via PTY stdin
- [ ] Responses parse from PTY stdout
- [ ] Input box added to conversation viewer
- [ ] Messages sent successfully to active sessions
- [ ] Responses appear in real-time
- [ ] File attachment support
- [ ] Permission validation (only session owner can inject)
- [ ] All task branches merged to `phase-10-session-injection`
- [ ] Phase branch ready to merge to `main`

## Key Architecture Changes from Original Plan

**Original Approach (Not Feasible)**:
- Inject into VSCode's running Claude process
- Problem: Process conflicts, no shared control

**New Approach (PTY-Based)**:
- Spawn our own Claude process in PTY
- Use `--resume <session-id>` to load session state
- Send input via PTY stdin
- Parse output from PTY stdout
- Both processes (VSCode's and ours) read same JSONL file for state

**Why This Works**:
- ✅ No process conflicts (independent processes)
- ✅ Reuses existing node-pty infrastructure (Phase 3-7)
- ✅ Proven by AgentAPI implementation
- ✅ True bidirectional communication
- ✅ Same security model (sudo per-user)

---

## Task 10.1: Research Claude Code CLI Interaction

**Branch**: `phase-10/task-10.1-cli-research`
**Status**: ✅ **COMPLETE** (2025-10-14)

### Findings Summary

**Research completed** - See [docs/CLAUDE_INJECTION.md](/home/mmn/github/Micro-Wormhole/docs/CLAUDE_INJECTION.md) for full details.

**Key Findings**:
- Direct injection NOT FEASIBLE (process conflicts)
- PTY-based approach IS FEASIBLE (AgentAPI proof)
- Claude binary: `~/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude`
- Arguments: `--resume <id> --input-format stream-json --output-format stream-json --print`
- node-pty already available (Phase 3)
- PTY manager already exists (lib/pty-manager.js)

**Executive Decision**: Proceed with PTY-based approach (Method 4)

---

## Task 10.2: Implement PTY-Based Claude Injector

**Branch**: `phase-10/task-10.2-pty-injector`
**Estimated Time**: 3 hours

### Subtasks

#### 10.2.1: Create lib/claude-pty-injector.js module
**Action**: Create module to spawn and control Claude via PTY

**File**: `claude-code-monitor/lib/claude-pty-injector.js`

**Code**:
```javascript
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
```

**Completion Criteria**:
- [ ] Module created with PTY spawning logic
- [ ] Uses sudo to spawn as correct user
- [ ] Parses JSONL output from stdout
- [ ] EventEmitter for responses
- [ ] File attachment support
- [ ] Permission validation
- [ ] ESLint passes

#### 10.2.2: Add Socket.io events in server.js
**Action**: Update `claude-code-monitor/server.js` with injection events

**Code to add**:
```javascript
const claudePtyInjector = require('./lib/claude-pty-injector');

// Initialize Claude PTY session
socket.on('claude:pty:init', async ({ sessionId }) => {
    try {
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        // Spawn PTY session
        await claudePtyInjector.spawnClaudeSession(
            sessionId,
            session.username,
            session.repoPath
        );

        socket.emit('claude:pty:ready', { sessionId });
    } catch (error) {
        logger.error('Failed to initialize Claude PTY:', error);
        socket.emit('error', { message: 'Failed to initialize session: ' + error.message });
    }
});

// Send message to Claude PTY
socket.on('claude:message:send', async ({ sessionId, message, username }) => {
    try {
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        // Validate permission
        claudePtyInjector.validatePermission(username, session.username);

        // Initialize PTY if not already
        if (!claudePtyInjector.hasSession(sessionId)) {
            await claudePtyInjector.spawnClaudeSession(
                sessionId,
                session.username,
                session.repoPath
            );
        }

        // Send message
        await claudePtyInjector.sendMessage(sessionId, message);

        socket.emit('claude:message:sent', {
            sessionId,
            success: true,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to send message to Claude:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
});

// Send message with file attachment
socket.on('claude:message:send-with-file', async ({ sessionId, message, username, filePath }) => {
    try {
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        claudePtyInjector.validatePermission(username, session.username);

        if (!claudePtyInjector.hasSession(sessionId)) {
            await claudePtyInjector.spawnClaudeSession(
                sessionId,
                session.username,
                session.repoPath
            );
        }

        await claudePtyInjector.sendMessageWithFile(sessionId, message, filePath);

        socket.emit('claude:message:sent', { sessionId, success: true });

    } catch (error) {
        logger.error('Failed to send message with file:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
});

// Handle Claude response events
claudePtyInjector.on('message:assistant', (sessionId, message) => {
    // Broadcast to all clients watching this session
    io.to(`claude-${sessionId}`).emit('claude:message:response', {
        sessionId,
        message
    });

    // Also trigger session update (JSONL file will be updated by Claude)
    io.to(`claude-${sessionId}`).emit('claude:session:updated', { sessionId });
});

claudePtyInjector.on('message:error', (sessionId, error) => {
    io.to(`claude-${sessionId}`).emit('claude:message:error', {
        sessionId,
        error
    });
});

claudePtyInjector.on('session:closed', (sessionId, exitCode) => {
    io.to(`claude-${sessionId}`).emit('claude:pty:closed', {
        sessionId,
        exitCode
    });
});

// Cleanup on disconnect
socket.on('disconnect', () => {
    // Note: Keep PTY sessions alive even if client disconnects
    // They'll be cleaned up on server shutdown or explicit close
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing Claude PTY sessions');
    claudePtyInjector.closeAll();
    process.exit(0);
});
```

**Completion Criteria**:
- [ ] Socket.io events added
- [ ] Permission validation enforced
- [ ] PTY auto-initializes on first message
- [ ] Response events broadcast to clients
- [ ] Error handling complete
- [ ] Graceful shutdown handling
- [ ] ESLint passes

#### 10.2.3: Update sudo configuration
**Action**: Add claude binary to sudo permissions

**File**: `docs/SUDO_INJECTION_SETUP.md`

**Content**:
```markdown
# Sudo Configuration for Claude PTY Injection

To allow the web monitor to spawn Claude processes for injection, update the sudo configuration.

## Add to /etc/sudoers.d/claude-monitor

```bash
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add Claude binary to allowed commands:

```
# Existing lines...
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown, /home/*/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude

# Update existing rule (or add if not present)
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

## Test Configuration

```bash
# Test as claude-monitor user
sudo -u claude-monitor sudo -u mmn /home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.14-linux-x64/resources/native-binary/claude --help

# Should output Claude help text
```

## Security Notes

- Only claude-monitor service user can execute Claude binary
- Can only execute as users in CLAUDE_USERS alias
- No password required (for automated operation)
- Wildcards allow for version updates without config changes
- Each PTY spawned runs as the session owner (isolation)
```

**Completion Criteria**:
- [ ] Documentation created
- [ ] Sudo configuration documented
- [ ] Test steps included
- [ ] Security notes added

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] PTY-based injector works
- [ ] Claude spawns successfully
- [ ] Messages send via stdin
- [ ] Responses parse from stdout
- [ ] Permission validation enforced
- [ ] Sudo configuration documented
- [ ] Error handling robust
- [ ] Git status clean

---

## Task 10.3: Add Input UI for Message Injection

**Branch**: `phase-10/task-10.3-input-ui`
**Estimated Time**: 1.5 hours

### Subtasks

#### 10.3.1: Add message input box to conversation viewer

**(Content unchanged from original plan - UI is the same regardless of backend approach)**

**Action**: Update `claude-code-monitor/public/index.html`

**HTML to add** (after `conversation-container`):
```html
<!-- Claude Message Input (shown when viewing Claude session) -->
<div id="claude-input-container" class="claude-input-container hidden">
    <form id="claude-input-form" class="claude-input-form">
        <textarea
            id="claude-message-input"
            class="claude-message-input"
            placeholder="Type your message to Claude..."
            rows="3"
        ></textarea>
        <div class="claude-input-actions">
            <button type="button" id="attach-file-btn" class="btn-icon" title="Attach file">
                📎
            </button>
            <button type="submit" class="btn btn-primary">
                Send to Claude
            </button>
        </div>
        <div id="attached-file" class="attached-file hidden"></div>
        <div id="pty-status" class="pty-status hidden"></div>
    </form>
</div>
```

**CSS to add** to `claude-code-monitor/public/style.css`:
```css
/* Claude Message Input */
.claude-input-container {
    border-top: 2px solid var(--border);
    background: var(--bg-secondary);
    padding: 12px;
}

.claude-input-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.claude-message-input {
    width: 100%;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    min-height: 60px;
}

.claude-message-input:focus {
    outline: none;
    border-color: var(--accent);
}

.claude-input-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.attached-file {
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.attached-file .remove-file {
    cursor: pointer;
    color: var(--danger);
    font-weight: bold;
}

.pty-status {
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-secondary);
}

.pty-status.initializing {
    background: var(--warning);
    color: var(--bg-primary);
}

.pty-status.ready {
    background: var(--success);
    color: white;
}

/* Disable input for inactive sessions */
.claude-input-container.disabled {
    opacity: 0.5;
    pointer-events: none;
}

.claude-input-container.disabled::after {
    content: "Session is not active";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--warning);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: 600;
}
```

**Completion Criteria**:
- [ ] Input textarea added
- [ ] Send button styled
- [ ] File attachment button added
- [ ] PTY status indicator added
- [ ] Disabled state for inactive sessions
- [ ] CSS matches theme
- [ ] Mobile-responsive

#### 10.3.2: Implement message sending in app.js

**Action**: Add JavaScript for PTY-based message sending

**Code to add** to `claude-code-monitor/public/app.js`:
```javascript
// ===== Claude PTY Message Injection =====

let attachedFile = null;
let ptyReady = false;

function setupClaudeInput() {
    const inputForm = document.getElementById('claude-input-form');
    const messageInput = document.getElementById('claude-message-input');
    const attachFileBtn = document.getElementById('attach-file-btn');

    // Send message form
    inputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendClaudeMessage();
    });

    // Attach file button
    attachFileBtn.addEventListener('click', () => {
        showFilePickerForAttachment();
    });

    // Allow Ctrl+Enter to send
    messageInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            sendClaudeMessage();
        }
    });
}

function sendClaudeMessage() {
    const messageInput = document.getElementById('claude-message-input');
    const message = messageInput.value.trim();

    if (!message && !attachedFile) {
        return;
    }

    if (!currentClaudeSessionId) {
        alert('No Claude session selected');
        return;
    }

    const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
    if (!session) {
        alert('Session not found');
        return;
    }

    if (!session.isActive) {
        alert('Cannot send message to inactive session');
        return;
    }

    // Show sending indicator
    messageInput.disabled = true;
    messageInput.placeholder = 'Sending...';
    setPtyStatus('Sending message...', 'initializing');

    // Emit message
    if (attachedFile) {
        socket.emit('claude:message:send-with-file', {
            sessionId: currentClaudeSessionId,
            message: message || 'See attached file',
            username: session.username,
            filePath: attachedFile
        });
    } else {
        socket.emit('claude:message:send', {
            sessionId: currentClaudeSessionId,
            message: message,
            username: session.username
        });
    }
}

function setPtyStatus(message, status) {
    const statusDiv = document.getElementById('pty-status');
    statusDiv.textContent = message;
    statusDiv.className = `pty-status ${status}`;
    statusDiv.classList.remove('hidden');

    if (status === 'ready' || status === 'error') {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    }
}

function showFilePickerForAttachment() {
    const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
    if (!session) return;

    // Simple prompt for file path (can be enhanced with file browser)
    const filePath = prompt('Enter file path to attach (relative to repo root):');
    if (filePath) {
        attachFile(filePath);
    }
}

function attachFile(filePath) {
    attachedFile = filePath;

    const attachedFileDiv = document.getElementById('attached-file');
    attachedFileDiv.classList.remove('hidden');
    attachedFileDiv.innerHTML = `
        <span>📎 ${escapeHtml(filePath)}</span>
        <span class="remove-file" onclick="removeAttachedFile()">×</span>
    `;
}

function removeAttachedFile() {
    attachedFile = null;
    document.getElementById('attached-file').classList.add('hidden');
}

// Socket.io handlers for PTY injection

socket.on('claude:pty:ready', ({ sessionId }) => {
    if (sessionId === currentClaudeSessionId) {
        ptyReady = true;
        setPtyStatus('PTY ready - you can send messages', 'ready');
        logger.info(`Claude PTY ready for session ${sessionId}`);
    }
});

socket.on('claude:message:sent', ({ sessionId, success }) => {
    if (sessionId === currentClaudeSessionId) {
        // Clear input
        const messageInput = document.getElementById('claude-message-input');
        messageInput.value = '';
        messageInput.disabled = false;
        messageInput.placeholder = 'Type your message to Claude...';

        // Remove attachment
        removeAttachedFile();

        // Show success feedback
        setPtyStatus('Message sent!', 'ready');
        showNotification('Message sent to Claude!', 'success');

        // Show typing indicator
        showTypingIndicator();
    }
});

socket.on('claude:message:response', ({ sessionId, message }) => {
    if (sessionId === currentClaudeSessionId) {
        // Hide typing indicator
        hideTypingIndicator();

        // Add message to conversation view
        const container = document.getElementById('conversation-container');
        const msgDiv = renderMessage(message);
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        // Show notification
        showNotification('Claude responded!', 'info');

        logger.info(`Claude response received for session ${sessionId}`);
    }
});

socket.on('claude:message:error', ({ sessionId, error }) => {
    if (sessionId === currentClaudeSessionId) {
        hideTypingIndicator();
        setPtyStatus('Error: ' + error.message, 'error');
        showNotification('Error: ' + error.message, 'error');
    }
});

socket.on('claude:pty:closed', ({ sessionId, exitCode }) => {
    if (sessionId === currentClaudeSessionId) {
        ptyReady = false;
        setPtyStatus('PTY session closed', 'error');
        logger.warn(`Claude PTY closed for session ${sessionId}, exit code: ${exitCode}`);
    }
});

function showNotification(message, type = 'info') {
    // Simple notification (can be enhanced)
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        z-index: 10000;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showClaudeInput() {
    const inputContainer = document.getElementById('claude-input-container');
    inputContainer.classList.remove('hidden');

    const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
    if (session && !session.isActive) {
        inputContainer.classList.add('disabled');
    } else {
        inputContainer.classList.remove('disabled');
        ptyReady = false; // Will be set to true when PTY initializes
    }
}

function hideClaudeInput() {
    document.getElementById('claude-input-container').classList.add('hidden');
}

// Initialize when app loads
document.addEventListener('DOMContentLoaded', () => {
    setupClaudeInput();
});
```

**Update `viewClaudeSession` function**:
```javascript
function viewClaudeSession(sessionId) {
    currentClaudeSessionId = sessionId;

    // ... existing code ...

    // Show input box
    showClaudeInput();

    // PTY will auto-initialize on first message send
}
```

**Completion Criteria**:
- [ ] Message sending works via PTY
- [ ] Input clears after send
- [ ] Success notification shown
- [ ] File attachment works
- [ ] Disabled for inactive sessions
- [ ] Ctrl+Enter shortcut works
- [ ] PTY status indicator updates
- [ ] Response events handled
- [ ] ESLint passes

#### 10.3.3: Add typing indicator

**Action**: Show when Claude is processing response

**Code to add**:
```javascript
function showTypingIndicator() {
    const container = document.getElementById('conversation-container');

    // Remove existing indicator
    hideTypingIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'conversation-message assistant';
    indicator.innerHTML = `
        <div class="message-header">
            <span class="message-role">🤖 Claude</span>
        </div>
        <div class="typing-dots">
            <span></span><span></span><span></span>
        </div>
    `;

    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}
```

**CSS to add**:
```css
/* Typing Indicator */
.typing-dots {
    display: flex;
    gap: 4px;
    padding: 8px;
}

.typing-dots span {
    width: 8px;
    height: 8px;
    background: var(--text-secondary);
    border-radius: 50%;
    animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 60%, 100% {
        opacity: 0.3;
        transform: translateY(0);
    }
    30% {
        opacity: 1;
        transform: translateY(-8px);
    }
}
```

**Completion Criteria**:
- [ ] Typing indicator shows after send
- [ ] Hides when response received
- [ ] Animation smooth
- [ ] ESLint passes

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] Input UI works smoothly
- [ ] Message sending functional via PTY
- [ ] File attachment works
- [ ] Disabled state correct
- [ ] PTY status indicator updates
- [ ] Typing indicator works
- [ ] Mobile-responsive
- [ ] Git status clean

---

## Task 10.4: End-to-End Testing

**Branch**: `phase-10/task-10.4-testing`
**Estimated Time**: 1.5 hours

### Subtasks

#### 10.4.1: Test PTY spawning
**Action**: Verify Claude PTY spawns correctly

**Test Steps**:
1. Open Claude Code session viewer
2. Send first message
3. Check server logs for PTY spawn
4. Verify Claude process running: `ps aux | grep "claude.*--resume"`
5. Confirm process running as correct user
6. Check PTY status indicator shows "ready"

**Expected Results**:
- PTY spawns successfully
- Process runs as session owner
- Claude binary executes with correct args
- Status indicator updates

**Completion Criteria**:
- [ ] PTY spawns successfully
- [ ] Correct user context
- [ ] No errors in logs
- [ ] Status indicator works

#### 10.4.2: Test message injection
**Action**: Send messages and verify receipt

**Test Steps**:
1. Type message in input box
2. Click "Send to Claude"
3. Verify typing indicator appears
4. Wait for response
5. Check response appears in UI
6. Verify JSONL file updated
7. Send multiple consecutive messages

**Expected Results**:
- Messages send successfully
- Claude processes and responds
- Responses appear in browser
- JSONL file updated
- Multiple messages work

**Completion Criteria**:
- [ ] Messages inject successfully
- [ ] Claude responds
- [ ] Responses display
- [ ] JSONL updated
- [ ] Multiple messages work

#### 10.4.3: Test file attachments
**Action**: Send message with file

**Test Steps**:
1. Click attach file button
2. Enter file path (e.g., "README.md")
3. Type message
4. Send message
5. Verify file content included in message
6. Check Claude's response references file

**Expected Results**:
- File attaches successfully
- Content included in message
- Claude responds with file context

**Completion Criteria**:
- [ ] File attachment works
- [ ] Content properly formatted
- [ ] Claude receives file

#### 10.4.4: Test permission validation
**Action**: Verify only owner can inject

**Test Steps**:
1. Try to send message to another user's session
2. Verify permission denied error
3. Check error message clear
4. Verify no message sent

**Expected Results**:
- Permission check works
- Error message displayed
- No unauthorized injection

**Completion Criteria**:
- [ ] Permission validation works
- [ ] Error handling correct
- [ ] Security enforced

#### 10.4.5: Test inactive session handling
**Action**: Verify disabled for inactive sessions

**Test Steps**:
1. View inactive Claude session
2. Check input box disabled
3. Verify warning displayed
4. Attempt to send (should fail)

**Expected Results**:
- Input disabled
- Warning clear
- No messages sent

**Completion Criteria**:
- [ ] Disabled state works
- [ ] Warning displayed
- [ ] No errors

### Task Quality Gates
- [ ] All test scenarios pass
- [ ] PTY spawning reliable
- [ ] Message injection works
- [ ] File attachments work
- [ ] Permission validation secure
- [ ] Inactive sessions handled
- [ ] No crashes or errors
- [ ] Performance acceptable
- [ ] Git status clean

---

## Task 10.5: Documentation and Completion

**Branch**: `phase-10/task-10.5-docs`
**Estimated Time**: 30 minutes

### Subtasks

#### 10.5.1: Update documentation
**Action**: Update CLAUDE.md and README

**Add to CLAUDE.md**:
```markdown
## Prompt Injection (PTY-Based)

You can send messages to Claude Code sessions from the browser using PTY-based injection.

### Architecture:
- Spawns independent Claude process in pseudoterminal (PTY)
- Uses `--resume <session-id>` to load session state
- Sends messages via PTY stdin (JSONL format)
- Parses responses from PTY stdout
- No process conflicts with VSCode's Claude instance

### Requirements:
- Session must be active (have JSONL file)
- Must be session owner (username match)
- Sudo configuration for Claude binary
- node-pty (already installed in Phase 3)

### Features:
- Send text messages
- Attach files from repository
- Real-time response display via PTY output
- Typing indicator
- Auto-scroll to new messages
- PTY status indicator

### Security:
- Permission validation (only owner can inject)
- Sudo isolation per user
- Independent PTY process per session
- Process lifecycle management (auto-cleanup)

### Socket.io Events:
- `claude:pty:init` - Initialize PTY session (optional, auto-initializes on first message)
- `claude:message:send` - Send text message
- `claude:message:send-with-file` - Send with file attachment
- `claude:message:sent` - Confirmation
- `claude:message:response` - Claude's response received
- `claude:message:error` - Error occurred
- `claude:pty:ready` - PTY session ready
- `claude:pty:closed` - PTY session closed

### Technical Notes:
- Based on AgentAPI approach (github.com/coder/agentapi)
- Reuses existing PTY infrastructure from Phase 3-7
- Both VSCode and PTY processes read same JSONL file for state
- PTY spawned on-demand (first message)
- Graceful shutdown handling
```

**Update README**:
```markdown
## Features
- **Prompt Injection**: Send messages to Claude Code sessions via PTY
- **Interactive Sessions**: Chat with Claude from the browser
- **File Attachments**: Include repo files in messages
- **Real-time Responses**: See Claude's responses as they arrive
- **PTY-Based**: Independent Claude processes, no conflicts
```

**Completion Criteria**:
- [ ] CLAUDE.md updated
- [ ] README updated
- [ ] Architecture documented
- [ ] Examples clear

#### 10.5.2: Update PROGRESS.md
**Action**: Mark Phase 10 complete

**Update PROGRESS.md**:
```markdown
## Phase 10: Prompt Injection (PTY-Based) ✅

**Status**: Complete
**Branch**: `phase-10-session-injection`
**Started**: 2025-10-14
**Completed**: 2025-10-14

**Approach**: PTY-based Claude control (AgentAPI method)

### Tasks:
- [x] 10.1 Research Claude Code CLI interaction - Completed 2025-10-14
- [x] 10.2 Implement PTY-based injection backend - Completed 2025-10-14
- [x] 10.3 Add input UI - Completed 2025-10-14
- [x] 10.4 End-to-end testing - Completed 2025-10-14
- [x] 10.5 Documentation - Completed 2025-10-14

### Implementation Notes:
- Uses PTY-based approach (inspired by AgentAPI)
- Spawns independent Claude processes (no VSCode conflicts)
- Leverages existing node-pty infrastructure from Phase 3
- Full bidirectional communication
- Permission-validated, sudo-isolated per user
```

**Completion Criteria**:
- [ ] PROGRESS.md updated
- [ ] Phase 10 marked complete
- [ ] All tasks checked

### Task Quality Gates
- [ ] All documentation complete
- [ ] PROGRESS.md updated
- [ ] No known bugs
- [ ] Git status clean

---

## Phase 10 Merge to Main

```bash
# Merge task branches to phase branch (squash)
git checkout phase-10-session-injection
git merge phase-10/task-10.2-pty-injector --squash
git commit -m "Task 10.2: PTY-based Claude injector"
git merge phase-10/task-10.3-input-ui --squash
git commit -m "Task 10.3: Input UI for injection"
git merge phase-10/task-10.4-testing --squash
git commit -m "Task 10.4: End-to-end testing"
git merge phase-10/task-10.5-docs --squash
git commit -m "Task 10.5: Documentation"

# Merge phase to main
git checkout main
git merge phase-10-session-injection -m "Phase 10: PTY-Based Prompt Injection into Claude Code Sessions

Completed all 5 tasks to enable sending messages to Claude Code sessions using PTY-based approach.

## Completed Tasks:
- 10.1: Research Claude CLI interaction (PTY approach discovered)
- 10.2: Implement PTY-based injection backend
- 10.3: Add input UI with typing indicator
- 10.4: End-to-end testing
- 10.5: Documentation

## Features Added:
- Send text messages to Claude sessions via PTY
- Attach files from repository
- Real-time response display via PTY stdout
- Typing indicator animation
- PTY status indicator
- Permission validation (only owner can inject)
- Sudo-based process isolation
- Independent Claude processes (no VSCode conflicts)

## Technical Approach:
- PTY-based control (inspired by AgentAPI)
- Spawns Claude with --resume <session-id>
- Sends messages via stdin (JSONL format)
- Parses responses from stdout
- Leverages existing node-pty infrastructure (Phase 3)
- No process conflicts with VSCode's Claude instance

Ready for v0.4.0 release.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

Phase 10 enables **interactive communication** with Claude Code sessions using PTY-based approach:

1. **CLI Research** (Task 10.1) - Identified PTY approach as feasible ✅
2. **PTY Injector Backend** (Task 10.2) - Spawn Claude in PTY, send via stdin, parse stdout
3. **Input UI** (Task 10.3) - Message box, file attachment, typing indicator, PTY status
4. **Testing** (Task 10.4) - End-to-end verification of PTY injection
5. **Documentation** (Task 10.5) - Complete guides

**Key Technical Decisions**:
- ✅ **PTY-Based Approach**: Spawns independent Claude processes (no VSCode conflicts)
- ✅ **AgentAPI Inspiration**: Proven implementation demonstrates feasibility
- ✅ **Existing Infrastructure**: Reuses node-pty and PTY patterns from Phase 3-7
- ✅ **True Bidirectional**: Full send/receive via PTY I/O

**Advantages Over Original Plan**:
- No process conflicts (independent instances)
- Leverages existing PTY manager
- Proven by AgentAPI implementation
- True interaction (not passive JSONL append)

**Total Time**: ~7 hours
**New Files**: 2 (claude-pty-injector.js, SUDO_INJECTION_SETUP.md)
**Modified Files**: 4 (server.js, app.js, index.html, style.css)
**Updated Docs**: CLAUDE_INJECTION.md (added Method 4)

This achieves the goal: **interact with Claude Code sessions from the browser using PTY-based control**!
