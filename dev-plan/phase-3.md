# Phase 3: Database & Session Management

**Branch**: `phase-3-session-management`
**Duration**: ~6 hours
**Prerequisites**: Phase 2 completed

## Phase Objectives
- Initialize SQLite database with sessions table
- Implement session data access layer
- Create PTY process manager for terminal emulation
- Implement session lifecycle (create, attach, detach, stop, delete)
- Add Socket.io event handlers for session operations
- Buffer terminal output for session history

## Phase Completion Criteria
- [ ] SQLite database initializes on startup
- [ ] Sessions table schema matches specification
- [ ] CRUD operations work for sessions
- [ ] PTY processes spawn and execute commands
- [ ] Terminal output buffered and broadcast via Socket.io
- [ ] Session lifecycle managed correctly
- [ ] Multiple sessions can run concurrently
- [ ] Sessions persist in database
- [ ] All task branches merged to `phase-3-session-management`
- [ ] Phase branch ready to merge to `main`

---

## Task 3.1: Initialize SQLite Database

**Branch**: `phase-3/task-3.1-database-init`
**Estimated Time**: 45 minutes

### Subtasks

#### 3.1.1: Create database utility module
**Action**: Create `lib/database.js`:
```javascript
'use strict';

const Database = require('better-sqlite3');
const path = require('path');
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
```

**Completion Criteria**:
- `lib/database.js` created
- Initializes better-sqlite3 database
- Creates sessions table with correct schema
- Enables foreign keys and WAL mode
- Exports db instance and close function
- Logs all database operations

#### 3.1.2: Update graceful shutdown to close database
**Action**: Edit `server.js` gracefulShutdown function:
```javascript
// Import at top
const { closeDatabase } = require('./lib/database');

// In gracefulShutdown function, after io.close():
        io.close(() => {
            logger.info('Socket.io connections closed');

            // Close database connection
            closeDatabase();

            // Additional cleanup will be added later
            // - Kill PTY processes

            logger.info('Graceful shutdown complete');
            process.exit(0);
        });
```

**Completion Criteria**:
- Database import added
- closeDatabase called in shutdown
- Database closes before process exit

#### 3.1.3: Test database initialization
**Action**: Create `test-database.js`:
```javascript
'use strict';

const { db } = require('./lib/database');
const logger = require('./lib/logger');

logger.info('Testing database operations...');

// Test table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").all();
logger.info(`Tables found: ${JSON.stringify(tables)}`);

// Test insert
const testSession = {
    id: 'test-' + Date.now(),
    name: 'Test Session',
    command: 'echo test',
    working_directory: '/tmp',
    run_as_user: process.env.USER || 'testuser'
};

try {
    const insert = db.prepare(`
        INSERT INTO sessions (id, name, command, working_directory, run_as_user)
        VALUES (@id, @name, @command, @working_directory, @run_as_user)
    `);
    insert.run(testSession);
    logger.info('Test session inserted');

    // Test select
    const select = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const session = select.get(testSession.id);
    logger.info(`Retrieved session: ${JSON.stringify(session)}`);

    // Test update
    const update = db.prepare('UPDATE sessions SET status = ? WHERE id = ?');
    update.run('completed', testSession.id);
    logger.info('Session status updated');

    // Test delete
    const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    deleteStmt.run(testSession.id);
    logger.info('Test session deleted');

    logger.info('✓ All database operations successful');
} catch (error) {
    logger.error('Database test failed:', error);
    process.exit(1);
}
```

**Commands**:
```bash
node test-database.js
```

**Expected output**:
- Tables found message
- Test session inserted/retrieved/updated/deleted
- "All database operations successful"

**Cleanup**:
```bash
rm test-database.js
```

**Completion Criteria**:
- Database initializes successfully
- Sessions table exists
- CRUD operations work
- Test cleaned up

#### 3.1.4: Add database check to health endpoint
**Action**: Update `/api/health` in `server.js`:
```javascript
// Import at top
const { db } = require('./lib/database');

// In /api/health endpoint:
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
        },
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
        },
        socketio: {
            connected: io.engine.clientsCount
        },
        database: {
            open: db.open,
            sessions: db.prepare('SELECT COUNT(*) as count FROM sessions').get().count
        },
        environment: NODE_ENV
    };
```

**Completion Criteria**:
- Health endpoint includes database status
- Shows connection state and session count

#### 3.1.5: Test health endpoint with database info
**Commands**:
```bash
npm start
curl http://localhost:3456/api/health | jq
```

**Expected**:
- database.open: true
- database.sessions: 0 (or count of existing sessions)

**Completion Criteria**:
- Database info in health check
- Session count accurate

#### 3.1.6: Run ESLint
**Commands**:
```bash
npm run lint lib/database.js server.js
```

**Completion Criteria**:
- ESLint passes

### Task 3.1 Quality Gates
- [ ] `lib/database.js` created and working
- [ ] Sessions table schema correct
- [ ] Database closes on shutdown
- [ ] CRUD operations tested
- [ ] Health endpoint shows database status
- [ ] ESLint passes on new files

### Task 3.1 Completion
```bash
git add lib/database.js server.js
git commit -m "Task 3.1: Initialize SQLite database"
git checkout phase-3-session-management
git merge phase-3/task-3.1-database-init --squash
git commit -m "Task 3.1: Initialize SQLite database

- Created lib/database.js with better-sqlite3
- Created sessions table with correct schema
- Enabled WAL mode and foreign keys
- Added closeDatabase to graceful shutdown
- Added database info to health endpoint
- Tested CRUD operations
- Quality gates passed"
```

---

## Task 3.2: Implement Session Data Layer

**Branch**: `phase-3/task-3.2-session-data-layer`
**Estimated Time**: 1 hour

### Subtasks

#### 3.2.1: Create session data access module
**Action**: Create `lib/sessions-db.js`:
```javascript
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
```

**Completion Criteria**:
- All CRUD functions implemented
- Uses crypto.randomUUID() for IDs
- Prepared statements for security
- Error handling and logging
- Helper queries (by status, by user)

#### 3.2.2: Create unit tests for session data layer
**Action**: Create `test-sessions-db.js`:
```javascript
'use strict';

const sessionsDb = require('./lib/sessions-db');
const logger = require('./lib/logger');

logger.info('Testing session data layer...\n');

let testSessionId = null;

try {
    // Test 1: Create session
    logger.info('Test 1: Create session');
    const session = sessionsDb.createSession({
        name: 'Test Session',
        command: 'echo test',
        workingDirectory: '/tmp',
        runAsUser: process.env.USER || 'testuser'
    });
    testSessionId = session.id;
    logger.info(`✓ Created session: ${session.id}`);
    console.assert(session.name === 'Test Session', 'Session name mismatch');
    console.assert(session.status === 'running', 'Session status should be running');

    // Test 2: Get session by ID
    logger.info('\nTest 2: Get session by ID');
    const retrieved = sessionsDb.getSession(testSessionId);
    logger.info(`✓ Retrieved session: ${retrieved.id}`);
    console.assert(retrieved.id === testSessionId, 'Session ID mismatch');

    // Test 3: Get all sessions
    logger.info('\nTest 3: Get all sessions');
    const all = sessionsDb.getAllSessions();
    logger.info(`✓ Found ${all.length} sessions`);
    console.assert(all.length >= 1, 'Should have at least 1 session');

    // Test 4: Update session PID
    logger.info('\nTest 4: Update session PID');
    const pidUpdated = sessionsDb.updateSessionPid(testSessionId, 12345);
    logger.info(`✓ PID updated: ${pidUpdated}`);
    console.assert(pidUpdated === true, 'PID update should return true');

    // Test 5: Update session status
    logger.info('\nTest 5: Update session status');
    const statusUpdated = sessionsDb.updateSessionStatus(testSessionId, 'completed');
    logger.info(`✓ Status updated: ${statusUpdated}`);
    const updated = sessionsDb.getSession(testSessionId);
    console.assert(updated.status === 'completed', 'Status should be completed');

    // Test 6: Get sessions by status
    logger.info('\nTest 6: Get sessions by status');
    const completed = sessionsDb.getSessionsByStatus('completed');
    logger.info(`✓ Found ${completed.length} completed sessions`);
    console.assert(completed.length >= 1, 'Should have at least 1 completed session');

    // Test 7: Get sessions by user
    logger.info('\nTest 7: Get sessions by user');
    const userSessions = sessionsDb.getSessionsByUser(process.env.USER || 'testuser');
    logger.info(`✓ Found ${userSessions.length} sessions for user`);

    // Test 8: Delete session
    logger.info('\nTest 8: Delete session');
    const deleted = sessionsDb.deleteSession(testSessionId);
    logger.info(`✓ Session deleted: ${deleted}`);
    console.assert(deleted === true, 'Delete should return true');
    const notFound = sessionsDb.getSession(testSessionId);
    console.assert(notFound === undefined, 'Session should not exist after deletion');

    logger.info('\n✓ All session data layer tests passed!');
} catch (error) {
    logger.error('Test failed:', error);
    // Cleanup
    if (testSessionId) {
        try {
            sessionsDb.deleteSession(testSessionId);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    process.exit(1);
}
```

**Commands**:
```bash
node test-sessions-db.js
```

**Expected output**:
- All 8 tests pass
- "All session data layer tests passed!"

**Cleanup**:
```bash
rm test-sessions-db.js
```

**Completion Criteria**:
- All tests pass
- CRUD operations verified
- Test file removed

#### 3.2.3: Add session management endpoint for testing
**Action**: Add to `server.js`:
```javascript
// Import at top
const sessionsDb = require('./lib/sessions-db');

// Add before 404 handler
// Session management endpoints (for testing)
if (NODE_ENV === 'development') {
    app.get('/api/sessions', (req, res) => {
        try {
            const sessions = sessionsDb.getAllSessions();
            res.json({ sessions });
        } catch (error) {
            logger.error('Error getting sessions:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/sessions', (req, res) => {
        try {
            const { name, command, workingDirectory, runAsUser } = req.body;
            const session = sessionsDb.createSession({
                name,
                command,
                workingDirectory,
                runAsUser: runAsUser || process.env.USER
            });
            res.json({ session });
        } catch (error) {
            logger.error('Error creating session:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/sessions/:id', (req, res) => {
        try {
            const deleted = sessionsDb.deleteSession(req.params.id);
            if (deleted) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Session not found' });
            }
        } catch (error) {
            logger.error('Error deleting session:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
```

**Completion Criteria**:
- Test endpoints only in development
- GET /api/sessions lists all sessions
- POST /api/sessions creates session
- DELETE /api/sessions/:id deletes session

#### 3.2.4: Test session endpoints
**Commands**:
```bash
# Start server
npm start

# Create session
curl -X POST http://localhost:3456/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","command":"echo hi","workingDirectory":"/tmp","runAsUser":"'$USER'"}'

# List sessions
curl http://localhost:3456/api/sessions | jq

# Delete session (use ID from create response)
curl -X DELETE http://localhost:3456/api/sessions/SESSION_ID
```

**Expected**:
- POST returns created session with UUID
- GET returns array of sessions
- DELETE returns success

**Completion Criteria**:
- All endpoints work correctly
- Sessions persist in database

#### 3.2.5: Run ESLint
**Commands**:
```bash
npm run lint lib/sessions-db.js server.js
```

**Completion Criteria**:
- ESLint passes

### Task 3.2 Quality Gates
- [ ] `lib/sessions-db.js` created with all functions
- [ ] All unit tests pass
- [ ] Test endpoints work correctly
- [ ] Sessions persist in database
- [ ] ESLint passes on new files

### Task 3.2 Completion
```bash
git add lib/sessions-db.js server.js
git commit -m "Task 3.2: Implement session data layer"
git checkout phase-3-session-management
git merge phase-3/task-3.2-session-data-layer --squash
git commit -m "Task 3.2: Implement session data layer

- Created lib/sessions-db.js with CRUD operations
- Implemented create, get, update, delete functions
- Added helper queries (by status, by user)
- Created and passed unit tests
- Added test endpoints for development
- Quality gates passed"
```

---

## Task 3.3: Create PTY Process Manager

**Branch**: `phase-3/task-3.3-pty-manager`
**Estimated Time**: 1.5 hours

### Subtasks

#### 3.3.1: Create PTY process manager module
**Action**: Create `lib/pty-manager.js`:
```javascript
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
     * Note: Phase 6 will add sudo support for running as different users
     */
    spawn(sessionId, command, workingDirectory, runAsUser = null) {
        if (this.processes.has(sessionId)) {
            throw new Error(`Session ${sessionId} already has an active process`);
        }

        try {
            // For Phase 3, we'll spawn directly without sudo
            // Phase 6 will add: ['sudo', '-u', runAsUser, 'bash', '-l']
            const shell = process.env.SHELL || 'bash';
            const ptyProcess = pty.spawn(shell, ['-l'], {
                name: 'xterm-color',
                cols: PTY_COLS,
                rows: PTY_ROWS,
                cwd: workingDirectory,
                env: process.env
            });

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
```

**Completion Criteria**:
- PTYManager class with EventEmitter
- spawn() creates PTY process
- write() sends input to process
- resize() adjusts terminal size
- kill() gracefully terminates process
- Circular buffer for output history
- Singleton export

#### 3.3.2: Update graceful shutdown to kill PTY processes
**Action**: Edit `server.js` gracefulShutdown:
```javascript
// Import at top
const ptyManager = require('./lib/pty-manager');

// In gracefulShutdown, after closeDatabase():
            // Close database connection
            closeDatabase();

            // Kill all PTY processes
            ptyManager.killAll();

            logger.info('Graceful shutdown complete');
```

**Completion Criteria**:
- PTY manager imported
- killAll() called on shutdown

#### 3.3.3: Create PTY manager test script
**Action**: Create `test-pty-manager.js`:
```javascript
'use strict';

const ptyManager = require('./lib/pty-manager');
const logger = require('./lib/logger');

logger.info('Testing PTY Manager...\n');

const testSessionId = 'test-' + Date.now();

// Listen to events
ptyManager.on('output', (sessionId, data) => {
    process.stdout.write(data);
});

ptyManager.on('exit', (sessionId, exitCode, status) => {
    logger.info(`\nProcess exited: code=${exitCode}, status=${status}`);
    logger.info('✓ PTY Manager test complete');
    process.exit(0);
});

// Spawn PTY process
try {
    logger.info('Spawning PTY process...');
    const pid = ptyManager.spawn(testSessionId, 'echo "Hello from PTY" && echo "Second line" && exit', process.cwd());
    logger.info(`PID: ${pid}\n`);

    // Test buffer after a delay
    setTimeout(() => {
        const buffer = ptyManager.getBuffer(testSessionId);
        logger.info(`\nBuffer contains ${buffer.length} entries`);

        // Test process info
        const info = ptyManager.getProcessInfo(testSessionId);
        if (info) {
            logger.info(`Process info: PID=${info.pid}, Size=${info.cols}x${info.rows}`);
        }
    }, 1000);

} catch (error) {
    logger.error('PTY Manager test failed:', error);
    process.exit(1);
}

// Timeout
setTimeout(() => {
    logger.warn('Test timeout - forcing exit');
    ptyManager.kill(testSessionId);
    setTimeout(() => process.exit(1), 500);
}, 5000);
```

**Commands**:
```bash
node test-pty-manager.js
```

**Expected output**:
- "Spawning PTY process..."
- PID displayed
- "Hello from PTY" output
- "Second line" output
- "Process exited: code=0, status=completed"
- Buffer and process info logged

**Cleanup**:
```bash
rm test-pty-manager.js
```

**Completion Criteria**:
- PTY spawns and executes command
- Output captured and buffered
- Process exits with correct status
- Test cleaned up

#### 3.3.4: Run ESLint
**Commands**:
```bash
npm run lint lib/pty-manager.js server.js
```

**Completion Criteria**:
- ESLint passes

### Task 3.3 Quality Gates
- [ ] `lib/pty-manager.js` created and working
- [ ] PTY processes spawn successfully
- [ ] Output buffered correctly
- [ ] Process exit handled
- [ ] killAll integrated with shutdown
- [ ] ESLint passes on new files
- [ ] Manual test successful

### Task 3.3 Completion
```bash
git add lib/pty-manager.js server.js
git commit -m "Task 3.3: Create PTY process manager"
git checkout phase-3-session-management
git merge phase-3/task-3.3-pty-manager --squash
git commit -m "Task 3.3: Create PTY process manager

- Created lib/pty-manager.js with PTYManager class
- Implemented spawn, write, resize, kill methods
- Added circular buffer for output history
- Integrated killAll with graceful shutdown
- Tested PTY spawning and execution
- Quality gates passed"
```

---

*Due to length constraints, I'll continue with tasks 3.4 and 3.5 in a more condensed format. The pattern should be clear from tasks 3.1-3.3.*

## Task 3.4: Implement Session Lifecycle Handlers

**Branch**: `phase-3/task-3.4-session-lifecycle`
**Estimated Time**: 1.5 hours

### Implementation Overview
Create `lib/session-manager.js` that:
- Combines sessions-db and pty-manager
- Implements: createSession(), attachSession(), stopSession(), deleteSession()
- Maintains Map of connected clients per session
- Handles session state transitions
- Validates max sessions limit

### Key Functions
```javascript
// lib/session-manager.js structure:
- createSession({ name, command, workingDirectory, runAsUser })
- attachSession(sessionId, socketId)
- detachSession(sessionId, socketId)
- stopSession(sessionId)
- deleteSession(sessionId)
- getConnectedClients(sessionId)
- validateMaxSessions()
```

### Quality Gates
- [ ] session-manager.js created
- [ ] All lifecycle functions implemented
- [ ] Client tracking works
- [ ] Max sessions enforced
- [ ] ESLint passes
- [ ] Unit tested

---

## Task 3.5: Add Socket.io Session Events

**Branch**: `phase-3/task-3.5-socketio-events`
**Estimated Time**: 1.5 hours

### Implementation Overview
Update `server.js` Socket.io handlers to:
- Handle `session:create`, `session:list`, `session:attach`, `session:detach`
- Handle `session:stop`, `session:delete`
- Handle `terminal:input`, `terminal:resize`
- Emit `terminal:output`, `session:status`, `session:created`, `session:deleted`
- Broadcast to session rooms

### Quality Gates
- [ ] All Socket.io events implemented
- [ ] Room-based broadcasting works
- [ ] Terminal I/O functional
- [ ] Session lifecycle complete
- [ ] ESLint passes
- [ ] Integration tested

---

## Phase 3 Completion

### Integration Test
```bash
# Start server
npm start

# Use Socket.io test client to:
# 1. Create session
# 2. List sessions
# 3. Attach to session
# 4. Send terminal input
# 5. Receive terminal output
# 6. Stop session
# 7. Delete session
```

### Merge to Main
```bash
git checkout main
git merge phase-3-session-management -m "Phase 3: Database & Session Management Complete"
git push origin main
```

### Next: [Phase 4 - Frontend UI](phase-4.md)
