# Phase 9: Claude Code Session Discovery & Viewing

**Branch**: `phase-9-claude-sessions`
**Duration**: ~8 hours
**Prerequisites**: Phase 8 complete

## Phase Objectives
- Discover existing Claude Code sessions from ~/.claude/projects/
- Parse JSONL conversation files
- Display sessions grouped by repository
- Show conversation history in browser
- Real-time tail of active sessions
- Integrate with existing UI (keep "create session" for PTY sessions)

## Phase Completion Criteria
- [ ] Backend scans ~/.claude/projects/ for all users
- [ ] Session metadata extracted (repo, session ID, status, last activity)
- [ ] JSONL parser reads conversation history
- [ ] UI displays Claude Code sessions separate from PTY sessions
- [ ] Clicking a Claude session shows conversation history
- [ ] Active sessions update in real-time
- [ ] File edits from conversation viewable in Monaco Editor
- [ ] All task branches merged to `phase-9-claude-sessions`
- [ ] Phase branch ready to merge to `main`

---

## Task 9.1: Create Claude Code Session Scanner Backend

**Branch**: `phase-9/task-9.1-session-scanner`
**Estimated Time**: 2 hours

### Subtasks

#### 9.1.1: Create lib/claude-session-scanner.js module
**Action**: Create new module to discover Claude Code sessions

**File**: `lib/claude-session-scanner.js`

**Code**:
```javascript
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
        return dirName.substring(1).replace(/-/g, '/');
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
            const lines = content.trim().split('\\n');
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

            // Read all project directories
            const projectDirs = await fs.readdir(claudeProjectsDir);

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

            for (const username of users) {
                const userSessions = await this.scanUserProjects(username);
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
        for (const [sessionId, watcher] of this.watchers) {
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
```

**Completion Criteria**:
- [ ] File created with all methods
- [ ] Scans ~/.claude/projects/ for all system users
- [ ] Decodes project directory names to repo paths
- [ ] Extracts session metadata
- [ ] Detects active sessions via ps grep
- [ ] Counts messages in JSONL files
- [ ] ESLint passes

#### 9.1.2: Add Socket.io events for Claude sessions
**Action**: Add event handlers to `server.js`

**File**: `server.js`

**Code to add** (after existing session events):
```javascript
const claudeScanner = require('./lib/claude-session-scanner');

// ===== Claude Code Session Events =====

// List all Claude Code sessions
socket.on('claude:sessions:list', async () => {
    try {
        await claudeScanner.scanAllSessions();
        const sessions = claudeScanner.getAllSessions();
        socket.emit('claude:sessions:list', { sessions });
    } catch (error) {
        logger.error('Failed to list Claude sessions:', error);
        socket.emit('error', { message: 'Failed to list Claude sessions' });
    }
});

// Get sessions grouped by repo
socket.on('claude:sessions:by-repo', async () => {
    try {
        await claudeScanner.scanAllSessions();
        const byRepo = claudeScanner.getSessionsByRepo();
        socket.emit('claude:sessions:by-repo', { byRepo });
    } catch (error) {
        logger.error('Failed to group Claude sessions:', error);
        socket.emit('error', { message: 'Failed to group Claude sessions' });
    }
});

// Start watching a Claude session
socket.on('claude:session:watch', ({ sessionId }) => {
    try {
        socket.join(`claude-${sessionId}`);
        claudeScanner.watchSession(sessionId, io);
        logger.info(`Client ${socket.id} watching Claude session ${sessionId}`);
    } catch (error) {
        logger.error('Failed to watch Claude session:', error);
        socket.emit('error', { message: 'Failed to watch session' });
    }
});

// Stop watching a Claude session
socket.on('claude:session:unwatch', ({ sessionId }) => {
    try {
        socket.leave(`claude-${sessionId}`);
        logger.info(`Client ${socket.id} stopped watching Claude session ${sessionId}`);
    } catch (error) {
        logger.error('Failed to unwatch Claude session:', error);
    }
});
```

**Update graceful shutdown**:
```javascript
// In shutdown handler, add:
claudeScanner.stopAllWatchers();
```

**Completion Criteria**:
- [ ] Socket.io events added for listing sessions
- [ ] Events for watching/unwatching sessions
- [ ] Scanner integrated with graceful shutdown
- [ ] ESLint passes

#### 9.1.3: Test session discovery
**Action**: Manual testing

**Test Steps**:
1. Start server: `npm start`
2. Open browser console
3. Test Socket.io events:
```javascript
socket.emit('claude:sessions:list');
socket.on('claude:sessions:list', (data) => console.log('Sessions:', data));
```

**Expected Output**:
- Should see list of Claude sessions
- Should include session metadata (repo, status, message count)
- Should detect active sessions

**Completion Criteria**:
- [ ] Sessions discovered for all users
- [ ] Metadata correct (repo paths decoded)
- [ ] Active status detection works
- [ ] No errors in server logs

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] Session scanner finds existing Claude sessions
- [ ] Socket.io events work correctly
- [ ] File watchers can be started/stopped
- [ ] Code reviewed for security issues
- [ ] Git status clean

---

## Task 9.2: Create JSONL Parser for Conversation History

**Branch**: `phase-9/task-9.2-jsonl-parser`
**Estimated Time**: 1.5 hours

### Subtasks

#### 9.2.1: Create lib/claude-jsonl-parser.js module
**Action**: Create parser for Claude Code JSONL format

**File**: `lib/claude-jsonl-parser.js`

**Code**:
```javascript
'use strict';

const fs = require('fs').promises;
const logger = require('./logger');

class ClaudeJSONLParser {
    /**
     * Parse a single JSONL line
     */
    parseLine(line) {
        try {
            return JSON.parse(line);
        } catch (error) {
            logger.error('Failed to parse JSONL line:', error);
            return null;
        }
    }

    /**
     * Read entire JSONL file
     */
    async readSession(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\\n');

            const messages = lines
                .filter(line => line.trim().length > 0)
                .map(line => this.parseLine(line))
                .filter(msg => msg !== null);

            return messages;
        } catch (error) {
            logger.error(`Failed to read session ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Read last N messages from session
     */
    async readRecentMessages(filePath, count = 50) {
        try {
            const allMessages = await this.readSession(filePath);
            return allMessages.slice(-count);
        } catch (error) {
            logger.error('Failed to read recent messages:', error);
            throw error;
        }
    }

    /**
     * Read messages with pagination
     */
    async readMessagesPage(filePath, offset = 0, limit = 50) {
        try {
            const allMessages = await this.readSession(filePath);
            const start = Math.max(0, offset);
            const end = Math.min(allMessages.length, offset + limit);

            return {
                messages: allMessages.slice(start, end),
                total: allMessages.length,
                offset: start,
                limit,
                hasMore: end < allMessages.length
            };
        } catch (error) {
            logger.error('Failed to read message page:', error);
            throw error;
        }
    }

    /**
     * Extract tool calls from messages
     */
    extractToolCalls(messages) {
        const toolCalls = [];

        for (const msg of messages) {
            if (msg.type === 'assistant' && msg.content) {
                for (const block of msg.content) {
                    if (block.type === 'tool_use') {
                        toolCalls.push({
                            id: block.id,
                            name: block.name,
                            input: block.input,
                            timestamp: msg.timestamp
                        });
                    }
                }
            }
        }

        return toolCalls;
    }

    /**
     * Extract file operations from messages
     */
    extractFileOperations(messages) {
        const operations = [];

        for (const msg of messages) {
            if (msg.type === 'assistant' && msg.content) {
                for (const block of msg.content) {
                    if (block.type === 'tool_use') {
                        const toolName = block.name;

                        if (['Read', 'Write', 'Edit', 'Glob', 'Grep'].includes(toolName)) {
                            operations.push({
                                tool: toolName,
                                file: block.input?.file_path || block.input?.pattern || 'unknown',
                                timestamp: msg.timestamp,
                                id: block.id
                            });
                        }
                    }
                }
            }
        }

        return operations;
    }

    /**
     * Get session summary statistics
     */
    async getSessionSummary(filePath) {
        try {
            const messages = await this.readSession(filePath);
            const toolCalls = this.extractToolCalls(messages);
            const fileOps = this.extractFileOperations(messages);

            return {
                totalMessages: messages.length,
                userMessages: messages.filter(m => m.type === 'user').length,
                assistantMessages: messages.filter(m => m.type === 'assistant').length,
                toolCalls: toolCalls.length,
                fileOperations: fileOps.length,
                firstMessage: messages[0]?.timestamp,
                lastMessage: messages[messages.length - 1]?.timestamp
            };
        } catch (error) {
            logger.error('Failed to get session summary:', error);
            throw error;
        }
    }

    /**
     * Stream new messages (for real-time updates)
     */
    async getNewMessages(filePath, afterTimestamp) {
        try {
            const messages = await this.readSession(filePath);

            if (!afterTimestamp) {
                return messages;
            }

            return messages.filter(msg => {
                return msg.timestamp && new Date(msg.timestamp) > new Date(afterTimestamp);
            });
        } catch (error) {
            logger.error('Failed to get new messages:', error);
            throw error;
        }
    }
}

const parser = new ClaudeJSONLParser();
module.exports = parser;
```

**Completion Criteria**:
- [ ] File created with all methods
- [ ] Parses JSONL lines safely
- [ ] Reads entire session file
- [ ] Supports pagination
- [ ] Extracts tool calls
- [ ] Identifies file operations
- [ ] Generates session summary
- [ ] ESLint passes

#### 9.2.2: Add Socket.io events for reading conversations
**Action**: Add event handlers to `server.js`

**Code to add**:
```javascript
const jsonlParser = require('./lib/claude-jsonl-parser');

// Read full conversation
socket.on('claude:conversation:read', async ({ sessionId, offset, limit }) => {
    try {
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        const page = await jsonlParser.readMessagesPage(
            session.filePath,
            offset || 0,
            limit || 50
        );

        socket.emit('claude:conversation:read', { sessionId, ...page });
    } catch (error) {
        logger.error('Failed to read conversation:', error);
        socket.emit('error', { message: 'Failed to read conversation' });
    }
});

// Get session summary
socket.on('claude:session:summary', async ({ sessionId }) => {
    try {
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        const summary = await jsonlParser.getSessionSummary(session.filePath);
        socket.emit('claude:session:summary', { sessionId, summary });
    } catch (error) {
        logger.error('Failed to get session summary:', error);
        socket.emit('error', { message: 'Failed to get session summary' });
    }
});

// Get new messages since timestamp
socket.on('claude:conversation:poll', async ({ sessionId, afterTimestamp }) => {
    try {
        const session = claudeScanner.getSession(sessionId);
        if (!session) {
            return socket.emit('error', { message: 'Session not found' });
        }

        const newMessages = await jsonlParser.getNewMessages(
            session.filePath,
            afterTimestamp
        );

        if (newMessages.length > 0) {
            socket.emit('claude:conversation:new-messages', {
                sessionId,
                messages: newMessages
            });
        }
    } catch (error) {
        logger.error('Failed to poll for new messages:', error);
    }
});
```

**Completion Criteria**:
- [ ] Events added for reading conversations
- [ ] Pagination support works
- [ ] Summary statistics returned
- [ ] Polling for new messages works
- [ ] ESLint passes

#### 9.2.3: Test JSONL parsing
**Action**: Manual testing

**Test Steps**:
1. Use browser console to test events
2. Request conversation for known session ID
3. Verify pagination works
4. Check summary statistics

**Completion Criteria**:
- [ ] JSONL files parse correctly
- [ ] Pagination returns correct ranges
- [ ] Tool calls extracted properly
- [ ] File operations identified
- [ ] No parsing errors

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] JSONL parser handles malformed lines gracefully
- [ ] Pagination works correctly
- [ ] Summary statistics accurate
- [ ] Socket.io events work
- [ ] Git status clean

---

## Task 9.3: Update UI to Display Claude Code Sessions

**Branch**: `phase-9/task-9.3-session-ui`
**Estimated Time**: 2 hours

### Subtasks

#### 9.3.1: Add session type tabs to sidebar
**Action**: Update `public/index.html` to add tab switcher

**Code to add** (in sidebar, after sidebar-header):
```html
<!-- Session Type Tabs -->
<div class="session-tabs">
    <button id="tab-pty-sessions" class="session-tab active" data-tab="pty">
        <span>🖥️ PTY Sessions</span>
    </button>
    <button id="tab-claude-sessions" class="session-tab" data-tab="claude">
        <span>🤖 Claude Code</span>
    </button>
</div>

<!-- PTY Sessions List (existing) -->
<div id="pty-sessions-container" class="sessions-container active">
    <div class="session-list" id="session-list">
        <!-- PTY session items -->
    </div>
</div>

<!-- Claude Sessions List (new) -->
<div id="claude-sessions-container" class="sessions-container hidden">
    <div id="claude-sessions-by-repo">
        <!-- Will be populated by JavaScript -->
    </div>
</div>
```

**CSS to add** (`public/style.css`):
```css
/* Session Type Tabs */
.session-tabs {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
}

.session-tab {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
}

.session-tab:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.session-tab.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}

.sessions-container {
    display: none;
    flex: 1;
    overflow-y: auto;
}

.sessions-container.active {
    display: block;
}

/* Claude Sessions Styling */
.claude-repo-group {
    margin-bottom: 16px;
}

.claude-repo-header {
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-left: 3px solid var(--accent);
    font-weight: 600;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.claude-repo-header:hover {
    background: var(--bg-secondary);
}

.claude-repo-path {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 2px;
}

.claude-session-item {
    padding: 10px 12px 10px 24px;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
}

.claude-session-item:hover {
    background: var(--bg-tertiary);
}

.claude-session-item.active {
    background: var(--accent);
    color: white;
}

.claude-session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.claude-session-id {
    font-family: monospace;
    font-size: 11px;
    color: var(--text-secondary);
}

.claude-session-status {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
}

.claude-session-status.active {
    background: var(--success);
    color: white;
}

.claude-session-status.inactive {
    background: var(--text-secondary);
    color: white;
}

.claude-session-info {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--text-secondary);
}

.claude-session-badge {
    display: flex;
    align-items: center;
    gap: 4px;
}
```

**Completion Criteria**:
- [ ] Tab switcher added to sidebar
- [ ] Two containers for PTY and Claude sessions
- [ ] CSS styling matches existing theme
- [ ] Tabs switch between containers
- [ ] ESLint passes (HTML valid)

#### 9.3.2: Add JavaScript for Claude session rendering
**Action**: Update `public/app.js` to render Claude sessions

**Code to add**:
```javascript
// ===== Claude Code Session State =====
let claudeSessions = [];
let currentClaudeSessionId = null;
let claudeConversation = [];
let currentSessionType = 'pty'; // 'pty' or 'claude'

// ===== Tab Switching =====

function switchSessionTab(tabType) {
    currentSessionType = tabType;

    // Update tab buttons
    document.querySelectorAll('.session-tab').forEach(tab => {
        if (tab.dataset.tab === tabType) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update containers
    document.querySelectorAll('.sessions-container').forEach(container => {
        container.classList.remove('active');
    });

    if (tabType === 'pty') {
        document.getElementById('pty-sessions-container').classList.add('active');
    } else {
        document.getElementById('claude-sessions-container').classList.add('active');
        loadClaudeSessions();
    }
}

// ===== Claude Session Rendering =====

function renderClaudeSessions(sessionsData) {
    const container = document.getElementById('claude-sessions-by-repo');
    container.innerHTML = '';

    const repos = Object.keys(sessionsData).sort();

    if (repos.length === 0) {
        container.innerHTML = '<p style="padding:12px;color:#808080">No Claude Code sessions found</p>';
        return;
    }

    repos.forEach(repoPath => {
        const sessions = sessionsData[repoPath];
        const repoName = sessions[0].repoName;

        const repoGroup = document.createElement('div');
        repoGroup.className = 'claude-repo-group';

        const repoHeader = document.createElement('div');
        repoHeader.className = 'claude-repo-header';
        repoHeader.innerHTML = `
            <div>
                <div>📁 ${escapeHtml(repoName)}</div>
                <div class="claude-repo-path">${escapeHtml(repoPath)}</div>
            </div>
            <span>${sessions.length} session${sessions.length === 1 ? '' : 's'}</span>
        `;

        const sessionsList = document.createElement('div');
        sessionsList.className = 'claude-sessions-list';

        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'claude-session-item';
            if (session.id === currentClaudeSessionId) {
                item.classList.add('active');
            }

            const shortId = session.id.substring(0, 8);
            const statusClass = session.isActive ? 'active' : 'inactive';
            const statusText = session.isActive ? 'active' : 'inactive';
            const lastModified = formatTime(session.lastModified);

            item.innerHTML = `
                <div class="claude-session-header">
                    <span class="claude-session-id">${escapeHtml(shortId)}</span>
                    <span class="claude-session-status ${statusClass}">${statusText}</span>
                </div>
                <div class="claude-session-info">
                    <span class="claude-session-badge">💬 ${session.messageCount}</span>
                    <span class="claude-session-badge">👤 ${escapeHtml(session.username)}</span>
                    <span class="claude-session-badge">🕐 ${lastModified}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                viewClaudeSession(session.id);
            });

            sessionsList.appendChild(item);
        });

        repoGroup.appendChild(repoHeader);
        repoGroup.appendChild(sessionsList);
        container.appendChild(repoGroup);
    });
}

function loadClaudeSessions() {
    socket.emit('claude:sessions:by-repo');
}

function viewClaudeSession(sessionId) {
    currentClaudeSessionId = sessionId;

    // Update active state in sidebar
    document.querySelectorAll('.claude-session-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    // Request conversation
    socket.emit('claude:conversation:read', { sessionId, offset: 0, limit: 100 });

    // Start watching for updates
    socket.emit('claude:session:watch', { sessionId });
}

// ===== Socket.io Handlers =====

socket.on('claude:sessions:by-repo', ({ byRepo }) => {
    renderClaudeSessions(byRepo);
});

socket.on('claude:conversation:read', ({ sessionId, messages, total, hasMore }) => {
    if (sessionId !== currentClaudeSessionId) return;

    claudeConversation = messages;
    renderClaudeConversation(messages);
});

socket.on('claude:session:updated', ({ sessionId }) => {
    if (sessionId === currentClaudeSessionId) {
        // Reload conversation
        socket.emit('claude:conversation:read', {
            sessionId,
            offset: 0,
            limit: 100
        });
    }
});

// ===== Event Listeners =====

document.getElementById('tab-pty-sessions').addEventListener('click', () => {
    switchSessionTab('pty');
});

document.getElementById('tab-claude-sessions').addEventListener('click', () => {
    switchSessionTab('claude');
});
```

**Completion Criteria**:
- [ ] Tab switching works
- [ ] Claude sessions load on tab click
- [ ] Sessions grouped by repository
- [ ] Active/inactive status displayed
- [ ] Message count shown
- [ ] Click to view session works
- [ ] ESLint passes

#### 9.3.3: Create conversation viewer in main area
**Action**: Add conversation display to replace terminal when viewing Claude sessions

**Code to add** (in `public/app.js`):
```javascript
function renderClaudeConversation(messages) {
    // Hide terminal, show conversation viewer
    terminalContainer.classList.add('hidden');
    noSessionDiv.classList.add('hidden');

    // Create or get conversation container
    let convContainer = document.getElementById('conversation-container');
    if (!convContainer) {
        convContainer = document.createElement('div');
        convContainer.id = 'conversation-container';
        convContainer.className = 'conversation-container';
        document.querySelector('.main-area').appendChild(convContainer);
    }

    convContainer.classList.remove('hidden');
    convContainer.innerHTML = '';

    // Update title
    const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
    if (session) {
        terminalTitle.textContent = `${session.repoName} - ${session.id.substring(0, 8)}`;
    }

    // Render messages
    messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `conversation-message ${msg.type}`;

        if (msg.type === 'user') {
            msgDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-role">👤 User</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-content">${renderMessageContent(msg.content)}</div>
            `;
        } else if (msg.type === 'assistant') {
            msgDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-role">🤖 Claude</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-content">${renderMessageContent(msg.content)}</div>
            `;
        }

        convContainer.appendChild(msgDiv);
    });

    // Scroll to bottom
    convContainer.scrollTop = convContainer.scrollHeight;
}

function renderMessageContent(content) {
    if (typeof content === 'string') {
        return escapeHtml(content);
    }

    if (Array.isArray(content)) {
        return content.map(block => {
            if (block.type === 'text') {
                return `<p>${escapeHtml(block.text)}</p>`;
            } else if (block.type === 'tool_use') {
                return `
                    <div class="tool-use">
                        <div class="tool-name">🔧 ${escapeHtml(block.name)}</div>
                        <pre class="tool-input">${escapeHtml(JSON.stringify(block.input, null, 2))}</pre>
                    </div>
                `;
            } else if (block.type === 'tool_result') {
                return `
                    <div class="tool-result">
                        <div class="tool-result-header">📋 Tool Result</div>
                        <pre class="tool-result-content">${escapeHtml(block.content || '')}</pre>
                    </div>
                `;
            }
            return '';
        }).join('');
    }

    return escapeHtml(JSON.stringify(content));
}
```

**CSS to add**:
```css
/* Conversation Viewer */
.conversation-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: var(--bg-primary);
}

.conversation-message {
    margin-bottom: 24px;
    padding: 12px;
    border-radius: 6px;
    background: var(--bg-secondary);
}

.conversation-message.user {
    border-left: 3px solid var(--info);
}

.conversation-message.assistant {
    border-left: 3px solid var(--accent);
}

.message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
}

.message-role {
    font-weight: 600;
    color: var(--text-primary);
}

.message-time {
    color: var(--text-secondary);
}

.message-content {
    color: var(--text-primary);
    line-height: 1.6;
}

.message-content p {
    margin: 8px 0;
}

.tool-use, .tool-result {
    margin: 12px 0;
    padding: 12px;
    background: var(--bg-primary);
    border-radius: 4px;
    border: 1px solid var(--border);
}

.tool-name {
    font-weight: 600;
    color: var(--warning);
    margin-bottom: 8px;
}

.tool-input, .tool-result-content {
    background: var(--bg-tertiary);
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    font-family: monospace;
    font-size: 12px;
    color: var(--text-primary);
}

.tool-result-header {
    font-weight: 600;
    color: var(--success);
    margin-bottom: 8px;
}
```

**Completion Criteria**:
- [ ] Conversation container created
- [ ] Messages render with proper styling
- [ ] User vs assistant messages distinguished
- [ ] Tool calls displayed
- [ ] Tool results shown
- [ ] Auto-scrolls to bottom
- [ ] ESLint passes

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] Tab switching works smoothly
- [ ] Sessions render by repository
- [ ] Conversation displays correctly
- [ ] Tool calls visible
- [ ] Real-time updates work
- [ ] Git status clean

---

## Task 9.4: Integrate File Viewing from Conversation

**Branch**: `phase-9/task-9.4-file-integration`
**Estimated Time**: 1.5 hours

### Subtasks

#### 9.4.1: Extract file paths from tool calls
**Action**: Update conversation rendering to make file paths clickable

**Code to update** (in `renderMessageContent`):
```javascript
function renderMessageContent(content) {
    // ... existing code ...

    else if (block.type === 'tool_use') {
        const filePath = extractFilePath(block);
        const fileLink = filePath ?
            `<button class="file-link" onclick="openFileFromConversation('${escapeHtml(filePath)}')">📄 ${escapeHtml(filePath)}</button>` :
            '';

        return `
            <div class="tool-use">
                <div class="tool-name">🔧 ${escapeHtml(block.name)}</div>
                ${fileLink}
                <pre class="tool-input">${escapeHtml(JSON.stringify(block.input, null, 2))}</pre>
            </div>
        `;
    }

    // ... rest of code ...
}

function extractFilePath(toolBlock) {
    const input = toolBlock.input || {};
    return input.file_path || input.path || null;
}

function openFileFromConversation(filePath) {
    if (!currentClaudeSessionId) return;

    const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
    if (!session) return;

    // Use repo path as working directory
    const workingDir = session.repoPath;

    // Open file in Monaco Editor
    openFileInMonaco(filePath, workingDir);
}

function openFileInMonaco(filePath, workingDir) {
    // Read file using existing file manager
    socket.emit('file:read', {
        sessionId: 'claude-viewer',  // Pseudo session ID
        path: filePath,
        workingDir: workingDir
    });

    // Show editor panel
    showEditorPanel();
}
```

**Completion Criteria**:
- [ ] File paths extracted from tool calls
- [ ] Clickable file links added
- [ ] Files open in Monaco Editor
- [ ] Works with existing editor panel
- [ ] ESLint passes

#### 9.4.2: Update file manager to support direct paths
**Action**: Modify `lib/file-manager.js` to work without session ID

**Code to update**:
```javascript
// In file-manager.js, update readFile to accept workingDir directly
async readFileWithPath(workingDir, filePath) {
    try {
        const fullPath = this.validatePath(workingDir, filePath);
        // ... rest of existing readFile logic ...
    } catch (error) {
        logger.error('Failed to read file:', error);
        throw error;
    }
}
```

**Update server.js**:
```javascript
socket.on('file:read', async ({ sessionId, path, workingDir }) => {
    try {
        let fileData;

        if (workingDir) {
            // Direct path read (for Claude conversation viewer)
            fileData = await fileManager.readFileWithPath(workingDir, path);
        } else {
            // Session-based read (existing PTY sessions)
            const session = sessionsDb.getSession(sessionId);
            if (!session) {
                return socket.emit('error', { message: 'Session not found' });
            }
            fileData = await fileManager.readFile(session.working_directory, path);
        }

        socket.emit('file:contents', { sessionId, ...fileData });
    } catch (error) {
        logger.error('Failed to read file:', error);
        socket.emit('error', { message: error.message });
    }
});
```

**Completion Criteria**:
- [ ] File manager supports direct paths
- [ ] Socket.io event updated
- [ ] Works with both PTY and Claude sessions
- [ ] ESLint passes

#### 9.4.3: Test file viewing from conversation
**Action**: Manual testing

**Test Steps**:
1. Open Claude Code session in browser
2. Find tool call with file path (Read, Write, Edit)
3. Click file link
4. Verify Monaco Editor opens with file content
5. Test with multiple files

**Completion Criteria**:
- [ ] File links are clickable
- [ ] Monaco Editor opens
- [ ] Correct file content displayed
- [ ] Multiple files work
- [ ] No errors in console

### Task Quality Gates
- [ ] ESLint passes with zero errors
- [ ] File extraction works
- [ ] Monaco Editor integration works
- [ ] Files from conversation viewable
- [ ] No breaking changes to PTY sessions
- [ ] Git status clean

---

## Task 9.5: Documentation and Testing

**Branch**: `phase-9/task-9.5-docs-testing`
**Estimated Time**: 1 hour

### Subtasks

#### 9.5.1: Update CLAUDE.md with new architecture
**Action**: Document Claude Code session viewing

**Add to CLAUDE.md**:
```markdown
## Claude Code Session Viewing

The application now supports viewing existing Claude Code sessions in addition to creating new PTY sessions.

### Session Types:

1. **PTY Sessions** (original feature):
   - Create new bash/command sessions
   - Real-time terminal with xterm.js
   - File upload support
   - Run as different Linux users

2. **Claude Code Sessions** (new feature):
   - View existing Claude Code conversations
   - Browse by repository
   - See conversation history
   - View file operations
   - Click to open files in Monaco Editor
   - Real-time updates for active sessions

### Architecture:

**Session Discovery**:
- Scans `~/.claude/projects/` for all users
- Parses JSONL conversation files
- Detects active processes via `ps` grep
- Groups sessions by repository

**JSONL Parser**:
- Reads conversation history
- Extracts tool calls
- Identifies file operations
- Supports pagination

**Real-Time Updates**:
- fs.watch monitors JSONL files
- Socket.io broadcasts updates
- New messages appear automatically

### Socket.io Events:

**Claude Session Events**:
- `claude:sessions:list` - Get all Claude sessions
- `claude:sessions:by-repo` - Get sessions grouped by repo
- `claude:session:watch` - Start watching session for updates
- `claude:session:unwatch` - Stop watching session
- `claude:conversation:read` - Read conversation with pagination
- `claude:session:summary` - Get session statistics
- `claude:session:updated` - Server broadcast when file changes

### File Integration:

Files referenced in tool calls are clickable and open in Monaco Editor panel.
```

**Completion Criteria**:
- [ ] CLAUDE.md updated
- [ ] Architecture documented
- [ ] Socket.io events listed
- [ ] Examples provided

#### 9.5.2: Update README.md
**Action**: Add Claude Code viewing to features

**Update README.md**:
```markdown
## Features

- **Multi-Session Management**: Run multiple PTY sessions simultaneously
- **Claude Code Viewer**: Browse and view existing Claude Code conversations
- **Session Discovery**: Automatically finds Claude sessions across all users
- **Repository Grouping**: Sessions organized by Git repository
- **Conversation History**: Full message history with tool calls
- **File Integration**: Click files in conversations to view in editor
- **Real-Time Updates**: Active sessions update automatically
- **Multi-User Support**: Each session runs as a specific Linux user
- **Real-Time Terminal**: WebSocket-based terminal with xterm.js
- **File Upload**: Drag-and-drop, paste, or button upload (iOS compatible)
- **Monaco Editor**: View and browse files with syntax highlighting
- **Session Persistence**: SQLite database tracks PTY sessions
- **Responsive UI**: Works on desktop, tablet, and mobile devices
```

**Completion Criteria**:
- [ ] README features updated
- [ ] Claude Code viewing highlighted
- [ ] Clear and concise

#### 9.5.3: End-to-end testing
**Action**: Test complete workflow

**Test Steps**:
1. Start server
2. Access via Tailscale IP
3. Switch to "Claude Code" tab
4. Verify sessions appear grouped by repo
5. Click a session
6. Verify conversation loads
7. Click a file link
8. Verify Monaco Editor opens with file
9. Check active session updates in real-time
10. Test on mobile device

**Completion Criteria**:
- [ ] All features work end-to-end
- [ ] No console errors
- [ ] Mobile-responsive
- [ ] Real-time updates work
- [ ] File viewing works

#### 9.5.4: Update PROGRESS.md
**Action**: Mark Phase 9 complete

**Update PROGRESS.md**:
```markdown
## Phase 9: Claude Code Session Discovery & Viewing ✅

**Status**: Complete
**Branch**: `phase-9-claude-sessions`
**Started**: [date]
**Completed**: [date]

### Tasks:
- [x] 9.1 Create session scanner backend
- [x] 9.2 Create JSONL parser
- [x] 9.3 Update UI for Claude sessions
- [x] 9.4 Integrate file viewing
- [x] 9.5 Documentation and testing

### Completion Criteria:
- [x] Sessions discovered from ~/.claude/projects/
- [x] JSONL conversations parsed
- [x] UI displays Claude sessions by repo
- [x] Conversation history viewable
- [x] File operations clickable
- [x] Monaco Editor integration
- [x] Real-time updates functional
- [x] Documentation updated
- [x] All task branches merged
- [x] Phase ready to merge to main
```

**Completion Criteria**:
- [ ] PROGRESS.md updated
- [ ] All tasks marked complete
- [ ] Phase marked complete

### Task Quality Gates
- [ ] All documentation updated
- [ ] README accurate
- [ ] CLAUDE.md comprehensive
- [ ] End-to-end testing complete
- [ ] No regressions in existing features
- [ ] Git status clean

---

## Phase 9 Merge to Main

**After all tasks complete**:

```bash
git checkout main
git merge phase-9-claude-sessions -m "Phase 9: Claude Code Session Discovery & Viewing Complete

Completed all 5 tasks to add Claude Code session viewing alongside existing PTY session management.

## Completed Tasks:
- 9.1: Create session scanner backend
  - ClaudeSessionScanner class scans ~/.claude/projects/
  - Detects active sessions via ps grep
  - Groups sessions by repository
  - File watchers for real-time updates

- 9.2: Create JSONL parser
  - ClaudeJSONLParser reads conversation files
  - Supports pagination
  - Extracts tool calls and file operations
  - Session summary statistics

- 9.3: Update UI for Claude sessions
  - Tab switcher between PTY and Claude sessions
  - Sessions grouped by repository
  - Conversation viewer with message history
  - Tool calls and results displayed

- 9.4: Integrate file viewing
  - File paths extracted from tool calls
  - Clickable file links
  - Opens in Monaco Editor
  - Works with existing editor panel

- 9.5: Documentation and testing
  - CLAUDE.md updated
  - README features updated
  - End-to-end testing complete
  - PROGRESS.md updated

## Features Added:
- Browse existing Claude Code sessions by repository
- View full conversation history with tool calls
- Real-time updates for active sessions
- Click files in conversations to view in editor
- Session status (active/inactive) detection
- Message count and last activity display
- Pagination support for large conversations
- Integrated with Monaco Editor panel

## Technical Details:
- Session discovery via ~/.claude/projects/ directory scanning
- JSONL format parsing for conversation history
- fs.watch for real-time file monitoring
- Socket.io events for session management
- Dual-mode UI (PTY sessions + Claude sessions)
- Tab-based navigation

Ready for v0.3.0 release.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

Phase 9 adds comprehensive Claude Code session viewing to the application:

1. **Backend Session Discovery** - Scans ~/.claude/projects/, detects active sessions
2. **JSONL Parser** - Reads conversation history with pagination
3. **Dual-Mode UI** - Tabs for PTY sessions vs Claude sessions
4. **Conversation Viewer** - Full message history with tool calls
5. **File Integration** - Click files to open in Monaco Editor

**Total Time**: ~8 hours
**New Files**: 2 (session-scanner.js, jsonl-parser.js)
**Modified Files**: 3 (server.js, app.js, index.html, style.css)
**Socket.io Events**: 7 new events
**Lines of Code**: ~1000 lines

This achieves your goal: viewing THIS Claude Code session (and all others) in the browser!
