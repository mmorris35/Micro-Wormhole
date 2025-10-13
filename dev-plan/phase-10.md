# Phase 10: Inject Prompts into Claude Code Sessions

**Branch**: `phase-10-session-injection`
**Duration**: ~6 hours
**Prerequisites**: Phase 9 complete

## Phase Objectives
- Research Claude Code CLI interface for session interaction
- Implement prompt injection into running sessions
- Add input UI for sending messages to Claude
- Handle Claude's response and update conversation view
- Support file attachments with prompts
- Ensure proper authentication and permissions

## Phase Completion Criteria
- [ ] Claude Code CLI interaction method identified
- [ ] Prompt injection backend implemented
- [ ] Input box added to conversation viewer
- [ ] Messages sent successfully to active sessions
- [ ] Responses appear in real-time
- [ ] File attachment support
- [ ] Permission validation (only session owner can inject)
- [ ] All task branches merged to `phase-10-session-injection`
- [ ] Phase branch ready to merge to `main`

---

## Task 10.1: Research Claude Code CLI Interaction

**Branch**: `phase-10/task-10.1-cli-research`
**Estimated Time**: 1.5 hours

### Subtasks

#### 10.1.1: Investigate Claude Code binary interface
**Action**: Examine how Claude Code accepts input

**Research Steps**:
```bash
# Check Claude Code process arguments
ps aux | grep claude | grep -v grep

# Look for stdin/stdout/pipe mechanisms
lsof -p <claude-pid> | grep pipe

# Check for socket/IPC files
find ~/.claude -type s 2>/dev/null

# Check for API/control files
find ~/.vscode-server -name "*claude*" -type f 2>/dev/null

# Examine binary help
~/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude --help
```

**Questions to Answer**:
1. Does Claude accept stdin input?
2. Is there a socket/IPC mechanism?
3. Can we use `--resume <session-id>` to attach and send messages?
4. What format does Claude expect for input?
5. Does it use JSONL for stdin?

**Completion Criteria**:
- [ ] Input mechanism identified
- [ ] Input format documented
- [ ] Test command validated
- [ ] Limitations noted

#### 10.1.2: Test prompt injection manually
**Action**: Try injecting a message into an active session

**Test Approach**:
```bash
# Find an active Claude session
ps aux | grep "claude.*--resume" | head -1

# Try sending to stdin (if applicable)
echo '{"type":"user","content":"Hello from terminal"}' | ...

# Or try resuming session with new input
~/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude \
    --resume <session-id> \
    --input-format stream-json \
    <<< '{"type":"user","content":"Test message"}'
```

**Expected Outcomes**:
- Message appears in Claude Code UI (if VSCode open)
- Response added to JSONL file
- Or error message explaining why it won't work

**Completion Criteria**:
- [ ] Manual test attempted
- [ ] Results documented
- [ ] Feasibility determined
- [ ] Alternative approaches identified if direct method fails

#### 10.1.3: Document findings and approach
**Action**: Create technical document

**File**: `docs/CLAUDE_INJECTION.md`

**Content**:
```markdown
# Claude Code Prompt Injection

## Research Findings

[Date: ]
[Researcher: Claude]

### Claude Binary Interface

**Location**: `~/.vscode-server/extensions/anthropic.claude-code-<version>/resources/native-binary/claude`

**Arguments**:
- `--resume <session-id>` - Resume existing session
- `--input-format stream-json` - Input format
- `--output-format stream-json` - Output format
- `--debug-to-stderr` - Debug logging

### Input Mechanism

**Method**: [stdin / socket / IPC / API / none]

**Format**: [JSONL / JSON / text / other]

**Example**:
```
[working example or "NOT POSSIBLE"]
```

### Limitations

1. [Security restrictions]
2. [Process isolation]
3. [VSCode extension ownership]
4. [Authentication requirements]

### Recommended Approach

**Option A: Direct CLI Injection** (if possible)
- Pros: Direct, simple
- Cons: May conflict with VSCode extension

**Option B: JSONL File Append** (fallback)
- Pros: Simple, always works
- Cons: Read-only, no real interaction

**Option C: VSCode Extension API** (if needed)
- Pros: Official method
- Cons: Requires VSCode running, complex

### Implementation Plan

[Based on findings, describe which approach to implement]
```

**Completion Criteria**:
- [ ] Document created
- [ ] Findings recorded
- [ ] Approach selected
- [ ] Limitations clear

### Task Quality Gates
- [ ] Research thorough
- [ ] All methods tested
- [ ] Documentation complete
- [ ] Approach decided
- [ ] Git status clean

---

## Task 10.2: Implement Prompt Injection Backend

**Branch**: `phase-10/task-10.2-injection-backend`
**Estimated Time**: 2 hours

**Note**: Implementation depends on findings from Task 10.1. The code below assumes **Option A: Direct CLI** is possible. If not, adapt to the feasible approach.

### Subtasks

#### 10.2.1: Create lib/claude-injector.js module
**Action**: Create module to inject prompts into Claude sessions

**File**: `lib/claude-injector.js`

**Code** (adapt based on Task 10.1 findings):
```javascript
'use strict';

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class ClaudeInjector {
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
     * Inject a message into a Claude Code session
     *
     * @param {string} sessionId - Claude session ID
     * @param {string} username - User who owns the session
     * @param {string} message - Message to inject
     * @param {string} repoPath - Repository path (working directory)
     * @returns {Promise<object>} - Result with success status
     */
    async injectMessage(sessionId, username, message, repoPath) {
        try {
            const binaryPath = await this.getClaudeBinary(username);

            logger.info(`Injecting message into session ${sessionId} as ${username}`);

            // Format message as JSONL
            const inputMessage = JSON.stringify({
                type: 'user',
                content: message,
                timestamp: new Date().toISOString()
            });

            // Spawn Claude process with --resume
            const result = await this.spawnClaudeWithInput(
                binaryPath,
                sessionId,
                repoPath,
                username,
                inputMessage
            );

            logger.info(`Message injected successfully: ${sessionId}`);

            return {
                success: true,
                sessionId,
                message: 'Message injected',
                output: result.output
            };
        } catch (error) {
            logger.error('Failed to inject message:', error);
            throw error;
        }
    }

    /**
     * Spawn Claude process with input message
     */
    async spawnClaudeWithInput(binaryPath, sessionId, workingDir, username, input) {
        return new Promise((resolve, reject) => {
            const args = [
                '--resume', sessionId,
                '--input-format', 'stream-json',
                '--output-format', 'stream-json',
                '--debug-to-stderr'
            ];

            // Spawn as the session owner user via sudo
            const child = spawn('sudo', [
                '-u', username,
                binaryPath,
                ...args
            ], {
                cwd: workingDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
                logger.debug(`Claude stderr: ${data.toString()}`);
            });

            // Write input to stdin
            child.stdin.write(input + '\\n');
            child.stdin.end();

            // Wait for process to complete (or timeout)
            const timeout = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error('Claude injection timeout'));
            }, 30000); // 30 second timeout

            child.on('close', (code) => {
                clearTimeout(timeout);

                if (code === 0) {
                    resolve({
                        output: stdout,
                        stderr: stderr
                    });
                } else {
                    reject(new Error(`Claude exited with code ${code}: ${stderr}`));
                }
            });

            child.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Inject message with file attachment
     *
     * @param {string} sessionId - Session ID
     * @param {string} username - Username
     * @param {string} message - Message text
     * @param {string} repoPath - Repository path
     * @param {string} filePath - Path to file to attach
     * @returns {Promise<object>} - Result
     */
    async injectMessageWithFile(sessionId, username, message, repoPath, filePath) {
        try {
            // Read file content
            const fullPath = path.join(repoPath, filePath);
            const content = await fs.readFile(fullPath, 'utf8');

            // Format message with file context
            const messageWithFile = `${message}\\n\\nFile: ${filePath}\\n\`\`\`\\n${content}\\n\`\`\``;

            return await this.injectMessage(sessionId, username, messageWithFile, repoPath);
        } catch (error) {
            logger.error('Failed to inject message with file:', error);
            throw error;
        }
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
}

const injector = new ClaudeInjector();
module.exports = injector;
```

**Completion Criteria**:
- [ ] Module created with injection logic
- [ ] Uses Claude binary with --resume
- [ ] Formats input as JSONL
- [ ] Spawns as correct user via sudo
- [ ] Includes timeout handling
- [ ] File attachment support
- [ ] Permission validation
- [ ] ESLint passes

#### 10.2.2: Add Socket.io events for message injection
**Action**: Update `server.js` with injection events

**Code to add**:
```javascript
const claudeInjector = require('./lib/claude-injector');

// Inject message into Claude session
socket.on('claude:message:send', async ({ sessionId, message, username }) => {
    try {
        // Get session metadata
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        // Validate permission
        try {
            claudeInjector.validatePermission(username, session.username);
        } catch (error) {
            return socket.emit('error', { message: error.message });
        }

        // Inject message
        const result = await claudeInjector.injectMessage(
            sessionId,
            session.username,
            message,
            session.repoPath
        );

        socket.emit('claude:message:sent', {
            sessionId,
            success: true,
            timestamp: new Date().toISOString()
        });

        // Notify all clients watching this session
        io.to(`claude-${sessionId}`).emit('claude:session:updated', { sessionId });

        logger.info(`Message injected into session ${sessionId}`);
    } catch (error) {
        logger.error('Failed to inject message:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
});

// Inject message with file attachment
socket.on('claude:message:send-with-file', async ({ sessionId, message, username, filePath }) => {
    try {
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        claudeInjector.validatePermission(username, session.username);

        const result = await claudeInjector.injectMessageWithFile(
            sessionId,
            session.username,
            message,
            session.repoPath,
            filePath
        );

        socket.emit('claude:message:sent', { sessionId, success: true });
        io.to(`claude-${sessionId}`).emit('claude:session:updated', { sessionId });
    } catch (error) {
        logger.error('Failed to inject message with file:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
});
```

**Completion Criteria**:
- [ ] Socket.io events added
- [ ] Permission validation enforced
- [ ] Session updates broadcast
- [ ] Error handling complete
- [ ] ESLint passes

#### 10.2.3: Update sudo configuration
**Action**: Add claude binary to sudo permissions

**File**: Create `docs/SUDO_INJECTION_SETUP.md`

**Content**:
```markdown
# Sudo Configuration for Claude Injection

To allow the web monitor to inject messages into Claude Code sessions, update the sudo configuration.

## Add to /etc/sudoers.d/claude-monitor

```bash
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add Claude binary to allowed commands:

```
# Existing lines...
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown, /home/*/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude

# Update existing rule
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

## Test Configuration

```bash
# Test as claude-monitor user
sudo -u claude-monitor sudo -u <username> /home/<username>/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude --help

# Should output Claude help text
```

## Security Notes

- Only claude-monitor service user can execute Claude binary
- Can only execute as users in CLAUDE_USERS alias
- No password required (for automated operation)
- Wildcards allow for version updates
```

**Completion Criteria**:
- [ ] Documentation created
- [ ] Sudo configuration documented
- [ ] Test steps included
- [ ] Security notes added

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] Injection backend works
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
**Action**: Update `public/index.html` and `public/app.js`

**HTML to add** (after conversation-container):
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
    </form>
</div>
```

**CSS to add**:
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
- [ ] Disabled state for inactive sessions
- [ ] CSS matches theme
- [ ] Mobile-responsive

#### 10.3.2: Implement message sending in app.js
**Action**: Add JavaScript for sending messages

**Code to add**:
```javascript
// ===== Claude Message Injection =====

let attachedFile = null;

function setupClaudeInput() {
    const inputForm = document.getElementById('claude-input-form');
    const messageInput = document.getElementById('claude-message-input');
    const attachFileBtn = document.getElementById('attach-file-btn');
    const attachedFileDiv = document.getElementById('attached-file');

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

function showFilePickerForAttachment() {
    const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
    if (!session) return;

    // Request file list from session repo
    socket.emit('file:list', {
        sessionId: 'claude-' + currentClaudeSessionId,
        path: '.',
        workingDir: session.repoPath
    });

    // Show file picker modal (reuse existing file browser)
    // Or implement simple prompt
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

// Socket.io handlers
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
        showNotification('Message sent to Claude!', 'success');

        // Conversation will auto-update via file watcher
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
        background: var(--success);
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
    }
}

function hideClaudeInput() {
    document.getElementById('claude-input-container').classList.add('hidden');
}
```

**Update `viewClaudeSession` function**:
```javascript
function viewClaudeSession(sessionId) {
    currentClaudeSessionId = sessionId;

    // ... existing code ...

    // Show input box
    showClaudeInput();
}
```

**Completion Criteria**:
- [ ] Message sending works
- [ ] Input clears after send
- [ ] Success notification shown
- [ ] File attachment works
- [ ] Disabled for inactive sessions
- [ ] Ctrl+Enter shortcut works
- [ ] ESLint passes

#### 10.3.3: Test message injection UI
**Action**: Manual testing

**Test Steps**:
1. Open Claude Code session
2. Type message in input box
3. Click "Send to Claude"
4. Verify message appears in conversation
5. Check JSONL file updated
6. Test with file attachment
7. Test on inactive session (should be disabled)
8. Test Ctrl+Enter shortcut

**Completion Criteria**:
- [ ] Messages send successfully
- [ ] Conversation updates in real-time
- [ ] File attachments work
- [ ] Inactive sessions disabled
- [ ] UI feedback clear
- [ ] No errors in console

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] Input UI works smoothly
- [ ] Message sending functional
- [ ] File attachment works
- [ ] Disabled state correct
- [ ] Mobile-responsive
- [ ] Git status clean

---

## Task 10.4: Handle Claude Responses and Real-Time Updates

**Branch**: `phase-10/task-10.4-response-handling`
**Estimated Time**: 1 hour

### Subtasks

#### 10.4.1: Implement response polling
**Action**: Poll for new messages after injection

**Code to add** (`app.js`):
```javascript
let pollingInterval = null;

function startPollingForUpdates(sessionId) {
    // Clear existing interval
    stopPollingForUpdates();

    // Poll every 2 seconds
    pollingInterval = setInterval(() => {
        if (currentClaudeSessionId === sessionId) {
            const lastMessage = claudeConversation[claudeConversation.length - 1];
            const afterTimestamp = lastMessage?.timestamp || null;

            socket.emit('claude:conversation:poll', {
                sessionId,
                afterTimestamp
            });
        } else {
            stopPollingForUpdates();
        }
    }, 2000);
}

function stopPollingForUpdates() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

socket.on('claude:conversation:new-messages', ({ sessionId, messages }) => {
    if (sessionId === currentClaudeSessionId && messages.length > 0) {
        // Append new messages to conversation
        claudeConversation.push(...messages);

        // Render new messages
        const container = document.getElementById('conversation-container');
        messages.forEach(msg => {
            const msgDiv = renderMessage(msg);
            container.appendChild(msgDiv);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

        // Show notification for Claude's response
        if (messages.some(m => m.type === 'assistant')) {
            showNotification('Claude responded!', 'info');
        }
    }
});

// Start polling when viewing session
function viewClaudeSession(sessionId) {
    // ... existing code ...

    startPollingForUpdates(sessionId);
}
```

**Completion Criteria**:
- [ ] Polling starts when viewing session
- [ ] New messages appended to conversation
- [ ] Auto-scrolls to show new messages
- [ ] Notification for Claude responses
- [ ] Polling stops when leaving session
- [ ] ESLint passes

#### 10.4.2: Add typing indicator
**Action**: Show when Claude is processing

**Code to add**:
```javascript
function showTypingIndicator() {
    const container = document.getElementById('conversation-container');

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

// Show indicator after sending message
socket.on('claude:message:sent', ({ sessionId }) => {
    if (sessionId === currentClaudeSessionId) {
        showTypingIndicator();
    }
});

// Hide when new messages arrive
socket.on('claude:conversation:new-messages', ({ messages }) => {
    hideTypingIndicator();
});
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

#### 10.4.3: Test end-to-end injection flow
**Action**: Complete workflow testing

**Test Steps**:
1. Send message to active Claude session
2. Verify message appears in conversation
3. Wait for typing indicator
4. See Claude's response appear
5. Verify response saved to JSONL file
6. Test with multiple consecutive messages
7. Test with file attachment

**Expected Results**:
- Messages inject successfully
- Claude processes and responds
- Responses appear in browser
- JSONL file updated
- No lag or hangs

**Completion Criteria**:
- [ ] End-to-end flow works
- [ ] Multiple messages work
- [ ] File attachments work
- [ ] No errors or crashes
- [ ] Performance acceptable

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] Response polling works
- [ ] Typing indicator smooth
- [ ] End-to-end flow complete
- [ ] Performance good
- [ ] Git status clean

---

## Task 10.5: Documentation and Testing

**Branch**: `phase-10/task-10.5-docs`
**Estimated Time**: 30 minutes

### Subtasks

#### 10.5.1: Update documentation
**Action**: Update CLAUDE.md and README

**Add to CLAUDE.md**:
```markdown
## Prompt Injection

You can send messages to active Claude Code sessions from the browser.

### Requirements:
- Session must be active (Claude process running)
- Must be session owner (username match)
- Sudo configuration for Claude binary

### Features:
- Send text messages
- Attach files from repository
- Real-time response display
- Typing indicator
- Auto-scroll to new messages

### Security:
- Permission validation (only owner can inject)
- Sudo isolation per user
- Process timeout (30 seconds)

### Socket.io Events:
- `claude:message:send` - Send text message
- `claude:message:send-with-file` - Send with file attachment
- `claude:message:sent` - Confirmation
- `claude:conversation:new-messages` - New messages received
```

**Update README**:
```markdown
## Features
- **Prompt Injection**: Send messages to active Claude Code sessions
- **Interactive Sessions**: Chat with Claude from the browser
- **File Attachments**: Include repo files in messages
```

**Completion Criteria**:
- [ ] CLAUDE.md updated
- [ ] README updated
- [ ] Examples clear

#### 10.5.2: Update PROGRESS.md
**Action**: Mark Phase 10 complete

**Completion Criteria**:
- [ ] PROGRESS.md updated
- [ ] Phase 10 marked complete
- [ ] All tasks checked

#### 10.5.3: Final testing
**Action**: Complete end-to-end test

**Test Checklist**:
- [ ] Discover Claude sessions
- [ ] View conversation
- [ ] Send message to active session
- [ ] See response
- [ ] Attach file
- [ ] Test permission denial (wrong user)
- [ ] Test inactive session (should disable input)
- [ ] Test on mobile device

**Completion Criteria**:
- [ ] All features work
- [ ] No regressions
- [ ] Mobile functional

### Task Quality Gates
- [ ] All documentation complete
- [ ] Testing thorough
- [ ] No known bugs
- [ ] Git status clean

---

## Phase 10 Merge to Main

```bash
git checkout main
git merge phase-10-session-injection -m "Phase 10: Prompt Injection into Claude Code Sessions

Completed all 5 tasks to enable sending messages to active Claude Code sessions.

## Completed Tasks:
- 10.1: Research Claude CLI interaction
- 10.2: Implement injection backend
- 10.3: Add input UI
- 10.4: Handle responses and updates
- 10.5: Documentation

## Features Added:
- Send text messages to active Claude sessions
- Attach files from repository
- Real-time response display
- Typing indicator animation
- Permission validation
- Sudo-based process isolation

Ready for v0.4.0 release.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

Phase 10 enables **interactive communication** with Claude Code sessions:

1. **CLI Research** - Identify Claude binary interface
2. **Injection Backend** - Spawn Claude with --resume and stdin
3. **Input UI** - Message box with send button and file attachment
4. **Response Handling** - Polling, typing indicator, auto-scroll
5. **Documentation** - Complete guides and testing

**Key Technical Details**:
- Uses `claude --resume <session-id>` with stdin input
- Spawns as session owner via sudo
- JSONL format for messages
- 30-second timeout per injection
- Permission validation (only owner can inject)
- Real-time polling for responses (2-second interval)

**Total Time**: ~6 hours
**New Files**: 2 (claude-injector.js, CLAUDE_INJECTION.md, SUDO_INJECTION_SETUP.md)
**Modified Files**: 3 (server.js, app.js, index.html, style.css)

This achieves your goal: **interact with Claude Code sessions from the browser, not just view them**!
