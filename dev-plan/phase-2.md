# Phase 2: Backend Core Infrastructure

**Branch**: `phase-2-backend-core`
**Duration**: ~4 hours
**Prerequisites**: Phase 1 completed

## Phase Objectives
- Create Express server with proper configuration
- Integrate Socket.io for WebSocket communication
- Setup static file serving for frontend
- Implement graceful shutdown handling
- Add health check and monitoring endpoints

## Phase Completion Criteria
- [ ] Express server starts on port 3456 and binds to 0.0.0.0
- [ ] Socket.io connected and emitting test events
- [ ] Static files served from public/ directory
- [ ] Server handles SIGTERM/SIGINT gracefully
- [ ] Health check endpoint returns proper status
- [ ] Server logs all important events
- [ ] All task branches merged to `phase-2-backend-core`
- [ ] Phase branch ready to merge to `main`

---

## Task 2.1: Create Express Server Foundation

**Branch**: `phase-2/task-2.1-express-server`
**Estimated Time**: 45 minutes

### Subtasks

#### 2.1.1: Create main server.js file
**Action**: Create `server.js` with basic Express setup:
```javascript
'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();
const logger = require('./lib/logger');

// Configuration
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Routes will be added in subsequent tasks
app.get('/', (req, res) => {
    res.send('Claude Code Monitor - Server Running');
});

// Start server
function startServer() {
    server.listen(PORT, HOST, () => {
        logger.info(`Server started in ${NODE_ENV} mode`);
        logger.info(`Listening on http://${HOST}:${PORT}`);
        logger.info('Press Ctrl+C to stop');
    });
}

// Export for testing
module.exports = { app, server, startServer };

// Start if run directly
if (require.main === module) {
    startServer();
}
```

**Completion Criteria**:
- `server.js` created in project root
- Uses environment variables
- Imports logger module
- Creates HTTP server with Express
- Exports for testing
- Only starts server if run directly

#### 2.1.2: Test server startup
**Commands**:
```bash
# Terminal 1: Start server
npm start

# Terminal 2: Test endpoint
curl http://localhost:3456

# Stop server with Ctrl+C
```

**Expected output**:
- Server logs show startup message
- curl returns: "Claude Code Monitor - Server Running"
- Request logged in console and log file

**Completion Criteria**:
- Server starts without errors
- Responds to HTTP requests
- Logs appear in console and files
- Server stops cleanly with Ctrl+C

#### 2.1.3: Add error handling middleware
**Action**: Add to `server.js` before `startServer()`:
```javascript
// 404 handler
app.use((req, res) => {
    logger.warn(`404 - Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`, { stack: err.stack });
    res.status(err.status || 500).json({
        error: NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});
```

**Completion Criteria**:
- 404 handler added before startServer
- Error handler logs and responds appropriately
- Development mode shows error details
- Production mode hides error details

#### 2.1.4: Test error handling
**Commands**:
```bash
# Start server
npm start

# Test 404
curl http://localhost:3456/nonexistent

# Stop server
```

**Expected output**:
- 404 response with JSON error
- Warning logged for 404

**Completion Criteria**:
- 404 returns proper JSON response
- Error logged correctly

#### 2.1.5: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes with zero errors

### Task 2.1 Quality Gates
- [ ] `server.js` created with Express setup
- [ ] Server starts and responds to requests
- [ ] Logging middleware works
- [ ] Error handling implemented
- [ ] ESLint passes on server.js
- [ ] Manual testing successful

### Task 2.1 Completion
```bash
git add server.js
git commit -m "Task 2.1: Create Express server foundation"
git checkout phase-2-backend-core
git merge phase-2/task-2.1-express-server --squash
git commit -m "Task 2.1: Create Express server foundation

- Created server.js with Express and HTTP server
- Added request logging middleware
- Implemented 404 and error handlers
- Tested server startup and requests
- Quality gates passed"
```

---

## Task 2.2: Setup Socket.io with Express

**Branch**: `phase-2/task-2.2-socketio-setup`
**Estimated Time**: 1 hour

### Subtasks

#### 2.2.1: Initialize Socket.io server
**Action**: Add Socket.io to `server.js` after Express setup:
```javascript
// After: const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: '*', // Since this is on private Tailscale network
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

// Socket.io connection handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id} from ${socket.handshake.address}`);

    // Send welcome message
    socket.emit('message', { text: 'Connected to Claude Code Monitor' });

    socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} - Reason: ${reason}`);
    });

    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });
});

// Export io for use in other modules
module.exports = { app, server, io, startServer };
```

**Completion Criteria**:
- Socket.io initialized with server
- CORS configured for Tailscale network
- Connection/disconnect handlers implemented
- Error handler added
- io exported for later use

#### 2.2.2: Create Socket.io test endpoint
**Action**: Add test route before error handlers in `server.js`:
```javascript
// Socket.io test endpoint
app.get('/api/test-socket', (req, res) => {
    const connectedClients = io.engine.clientsCount;
    res.json({
        status: 'ok',
        connectedClients: connectedClients,
        message: 'Socket.io is working'
    });
});
```

**Completion Criteria**:
- Test endpoint added
- Returns client count

#### 2.2.3: Create Socket.io client test file
**Action**: Create `test-socketio-client.html` in project root:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Socket.io Test Client</title>
    <style>
        body {
            font-family: monospace;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        #log {
            border: 1px solid #3e3e42;
            padding: 10px;
            margin-top: 20px;
            height: 400px;
            overflow-y: auto;
        }
        .log-entry {
            margin: 5px 0;
        }
        .log-connect { color: #4ec9b0; }
        .log-disconnect { color: #ce9178; }
        .log-error { color: #f48771; }
        .log-message { color: #d4d4d4; }
        button {
            padding: 10px 20px;
            margin: 5px;
            background: #007acc;
            color: white;
            border: none;
            cursor: pointer;
        }
        button:hover {
            background: #005a9e;
        }
    </style>
</head>
<body>
    <h1>Socket.io Test Client</h1>
    <div>
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()">Disconnect</button>
        <button onclick="sendTest()">Send Test Message</button>
        <button onclick="clearLog()">Clear Log</button>
    </div>
    <div id="log"></div>

    <script src="https://cdn.jsdelivr.net/npm/socket.io-client@4.6.0/dist/socket.io.min.js"></script>
    <script>
        let socket = null;

        function addLog(message, type = 'message') {
            const log = document.getElementById('log');
            const entry = document.createElement('div');
            entry.className = `log-entry log-${type}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }

        function connect() {
            if (socket) {
                addLog('Already connected', 'error');
                return;
            }

            socket = io('http://localhost:3456');

            socket.on('connect', () => {
                addLog(`Connected with ID: ${socket.id}`, 'connect');
            });

            socket.on('disconnect', (reason) => {
                addLog(`Disconnected: ${reason}`, 'disconnect');
                socket = null;
            });

            socket.on('message', (data) => {
                addLog(`Message received: ${JSON.stringify(data)}`, 'message');
            });

            socket.on('error', (error) => {
                addLog(`Error: ${error}`, 'error');
            });
        }

        function disconnect() {
            if (socket) {
                socket.disconnect();
                addLog('Disconnecting...', 'disconnect');
            } else {
                addLog('Not connected', 'error');
            }
        }

        function sendTest() {
            if (socket) {
                socket.emit('test-event', { message: 'Hello from client' });
                addLog('Sent test message', 'message');
            } else {
                addLog('Not connected', 'error');
            }
        }

        function clearLog() {
            document.getElementById('log').innerHTML = '';
        }

        // Auto-connect on load
        window.onload = () => {
            addLog('Test client loaded. Click Connect to start.', 'message');
        };
    </script>
</body>
</html>
```

**Completion Criteria**:
- Test client HTML created
- Contains Socket.io client from CDN
- Has connect/disconnect/send functionality
- UI styled for visibility

#### 2.2.4: Test Socket.io connection
**Commands**:
```bash
# Terminal 1: Start server
npm start

# Terminal 2: Open test client
# Open test-socketio-client.html in browser
# Or use: python3 -m http.server 8000 and open http://localhost:8000/test-socketio-client.html
```

**Manual test steps**:
1. Open test client in browser
2. Click "Connect" button
3. Verify connection message appears
4. Check server logs for connection message
5. Click "Send Test Message"
6. Click "Disconnect"
7. Verify disconnect logged on server

**Expected results**:
- Client shows connection ID
- Server logs show client connect/disconnect
- Test endpoint shows 1 connected client when active

**Completion Criteria**:
- Socket.io connects successfully
- Client receives welcome message
- Server logs connection events
- Disconnect works properly

#### 2.2.5: Add test event handler to server
**Action**: Add inside `io.on('connection', ...)` handler in `server.js`:
```javascript
    // Test event handler
    socket.on('test-event', (data) => {
        logger.info(`Test event from ${socket.id}: ${JSON.stringify(data)}`);
        socket.emit('test-response', { received: true, echo: data });
    });
```

**Completion Criteria**:
- Test event handler added
- Echoes received data back to client

#### 2.2.6: Test bidirectional communication
**Commands**:
```bash
# Start server and open test client
# Click Connect
# Click Send Test Message
# Verify response appears in log
```

**Expected**:
- Client sends test-event
- Server logs received message
- Client receives test-response

**Completion Criteria**:
- Bidirectional communication works
- Events logged correctly

#### 2.2.7: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes

### Task 2.2 Quality Gates
- [ ] Socket.io initialized and integrated with Express
- [ ] Connection/disconnect handlers work
- [ ] Test client connects successfully
- [ ] Bidirectional communication verified
- [ ] ESLint passes on server.js
- [ ] Server logs all Socket.io events

### Task 2.2 Completion
```bash
# Clean up test file (don't commit it)
rm test-socketio-client.html

git add server.js
git commit -m "Task 2.2: Setup Socket.io with Express"
git checkout phase-2-backend-core
git merge phase-2/task-2.2-socketio-setup --squash
git commit -m "Task 2.2: Setup Socket.io with Express

- Initialized Socket.io server with HTTP server
- Configured CORS for Tailscale network
- Implemented connection/disconnect handlers
- Added test event handlers
- Added Socket.io test endpoint
- Verified bidirectional communication
- Quality gates passed"
```

---

## Task 2.3: Configure Static File Serving

**Branch**: `phase-2/task-2.3-static-files`
**Estimated Time**: 30 minutes

### Subtasks

#### 2.3.1: Add static file middleware
**Action**: Add to `server.js` after existing middleware:
```javascript
// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    maxAge: NODE_ENV === 'production' ? '1d' : 0
}));
```

**Completion Criteria**:
- Static middleware added
- Serves from public/ directory
- Cache disabled in development
- Cache enabled in production

#### 2.3.2: Update root route
**Action**: Replace root GET handler in `server.js`:
```javascript
// Remove or comment out:
// app.get('/', (req, res) => {
//     res.send('Claude Code Monitor - Server Running');
// });

// Static middleware now serves public/index.html automatically
```

**Completion Criteria**:
- Old root route removed
- Static middleware handles root

#### 2.3.3: Test static file serving
**Commands**:
```bash
# Start server
npm start

# Test in browser or curl
curl http://localhost:3456/
curl http://localhost:3456/style.css
curl http://localhost:3456/app.js
```

**Expected output**:
- `/` returns public/index.html content
- `/style.css` returns CSS content
- `/app.js` returns JavaScript content
- All files logged in server logs

**Completion Criteria**:
- All static files served correctly
- index.html serves as default
- MIME types correct
- Requests logged

#### 2.3.4: Add Cache-Control headers middleware
**Action**: Add before static middleware in `server.js`:
```javascript
// Cache control for static assets
app.use((req, res, next) => {
    if (req.url.match(/\.(html|css|js)$/)) {
        if (NODE_ENV === 'production') {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        } else {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
    next();
});
```

**Completion Criteria**:
- Cache headers set based on environment
- Development: no cache
- Production: 1 day cache

#### 2.3.5: Test cache headers
**Commands**:
```bash
# Check headers
curl -I http://localhost:3456/style.css
```

**Expected**:
- In development: `Cache-Control: no-cache, no-store, must-revalidate`
- In production: `Cache-Control: public, max-age=86400`

**Completion Criteria**:
- Cache headers present
- Correct for environment

#### 2.3.6: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes

### Task 2.3 Quality Gates
- [ ] Static file middleware configured
- [ ] public/index.html serves as default
- [ ] All static assets accessible
- [ ] Cache headers set correctly
- [ ] ESLint passes on server.js
- [ ] Manual testing successful

### Task 2.3 Completion
```bash
git add server.js
git commit -m "Task 2.3: Configure static file serving"
git checkout phase-2-backend-core
git merge phase-2/task-2.3-static-files --squash
git commit -m "Task 2.3: Configure static file serving

- Added express.static middleware for public/
- Configured cache control headers
- Removed redundant root route
- Tested static file serving
- Verified cache headers by environment
- Quality gates passed"
```

---

## Task 2.4: Implement Graceful Shutdown

**Branch**: `phase-2/task-2.4-graceful-shutdown`
**Estimated Time**: 45 minutes

### Subtasks

#### 2.4.1: Create shutdown handler function
**Action**: Add to `server.js` before module.exports:
```javascript
// Graceful shutdown handler
let isShuttingDown = false;

function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.warn('Shutdown already in progress...');
        return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Close HTTP server (stops accepting new connections)
    server.close(() => {
        logger.info('HTTP server closed');

        // Close all Socket.io connections
        io.close(() => {
            logger.info('Socket.io connections closed');

            // Additional cleanup will be added in Phase 3
            // - Close database connections
            // - Kill PTY processes

            logger.info('Graceful shutdown complete');
            process.exit(0);
        });
    });

    // Force shutdown after timeout
    const shutdownTimeout = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000); // 10 second timeout

    shutdownTimeout.unref();
}
```

**Completion Criteria**:
- Shutdown function created
- Closes HTTP server
- Closes Socket.io connections
- Has timeout for force shutdown
- Prevents multiple shutdown calls

#### 2.4.2: Register signal handlers
**Action**: Add to `server.js` after `startServer()` function:
```javascript
// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', { reason, promise });
    gracefulShutdown('UNHANDLED_REJECTION');
});
```

**Completion Criteria**:
- SIGTERM handler registered
- SIGINT handler registered (Ctrl+C)
- Uncaught exception handler added
- Unhandled rejection handler added

#### 2.4.3: Add shutdown endpoint for testing
**Action**: Add test endpoint in `server.js`:
```javascript
// Shutdown test endpoint (remove in production)
if (NODE_ENV === 'development') {
    app.post('/api/shutdown', (req, res) => {
        res.json({ message: 'Shutdown initiated' });
        setTimeout(() => gracefulShutdown('API_REQUEST'), 100);
    });
}
```

**Completion Criteria**:
- Shutdown endpoint only in development
- Returns response before shutting down
- Uses setTimeout to allow response to send

#### 2.4.4: Test graceful shutdown with SIGINT
**Commands**:
```bash
# Start server
npm start

# Press Ctrl+C
```

**Expected output**:
```
SIGINT received. Starting graceful shutdown...
HTTP server closed
Socket.io connections closed
Graceful shutdown complete
```

**Completion Criteria**:
- Server shuts down cleanly
- All shutdown messages logged
- Process exits with code 0

#### 2.4.5: Test graceful shutdown with connected clients
**Commands**:
```bash
# Terminal 1: Start server
npm start

# Terminal 2: Connect with curl (keeps connection open)
curl http://localhost:3456/ &

# Terminal 1: Press Ctrl+C
```

**Expected**:
- Server waits for connection to close
- Shuts down gracefully
- Logs show orderly shutdown

**Completion Criteria**:
- Existing connections handled
- Shutdown completes successfully

#### 2.4.6: Test shutdown timeout
**Action**: Temporarily modify shutdown timeout to 2 seconds for testing:
```javascript
const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
}, 2000); // 2 seconds for testing
```

**Commands**:
```bash
# Start server and immediately send SIGTERM multiple times
npm start
# In another terminal:
kill -TERM $(pgrep -f "node server.js")
```

**Expected**:
- First signal triggers shutdown
- Subsequent signals ignored
- May timeout if shutdown takes too long (expected for test)

**Cleanup**: Restore timeout to 10000ms

**Completion Criteria**:
- Timeout mechanism works
- Forced shutdown triggers if needed
- Restored to 10 seconds

#### 2.4.7: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes

### Task 2.4 Quality Gates
- [ ] Graceful shutdown function implemented
- [ ] Signal handlers registered
- [ ] HTTP server closes gracefully
- [ ] Socket.io closes gracefully
- [ ] Timeout mechanism works
- [ ] Error handlers log and shutdown
- [ ] ESLint passes on server.js
- [ ] Manual testing successful

### Task 2.4 Completion
```bash
git add server.js
git commit -m "Task 2.4: Implement graceful shutdown"
git checkout phase-2-backend-core
git merge phase-2/task-2.4-graceful-shutdown --squash
git commit -m "Task 2.4: Implement graceful shutdown

- Created gracefulShutdown function
- Registered SIGTERM and SIGINT handlers
- Added uncaught exception handlers
- Implemented shutdown timeout
- Added development shutdown endpoint
- Tested shutdown with active connections
- Quality gates passed"
```

---

## Task 2.5: Add Health Check and Monitoring

**Branch**: `phase-2/task-2.5-health-check`
**Estimated Time**: 30 minutes

### Subtasks

#### 2.5.1: Create health check endpoint
**Action**: Add to `server.js` before 404 handler:
```javascript
// Health check endpoint
app.get('/api/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

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
        environment: NODE_ENV
    };

    res.json(health);
});

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}
```

**Completion Criteria**:
- Health endpoint returns JSON
- Includes uptime, memory, Socket.io stats
- formatUptime helper function created

#### 2.5.2: Test health check endpoint
**Commands**:
```bash
# Start server
npm start

# Check health
curl http://localhost:3456/api/health | jq
```

**Expected output**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": {
    "seconds": 45,
    "formatted": "45s"
  },
  "memory": {
    "rss": "35 MB",
    "heapUsed": "15 MB",
    "heapTotal": "20 MB"
  },
  "socketio": {
    "connected": 0
  },
  "environment": "development"
}
```

**Completion Criteria**:
- Endpoint returns valid JSON
- All fields present
- Memory values reasonable
- Connected clients count accurate

#### 2.5.3: Create status endpoint
**Action**: Add to `server.js`:
```javascript
// Status endpoint with version info
app.get('/api/status', (req, res) => {
    const packageJson = require('./package.json');

    res.json({
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        node: process.version,
        status: 'running'
    });
});
```

**Completion Criteria**:
- Status endpoint created
- Returns package info and Node version

#### 2.5.4: Test status endpoint
**Commands**:
```bash
curl http://localhost:3456/api/status | jq
```

**Expected output**:
```json
{
  "name": "claude-code-monitor",
  "version": "0.1.0",
  "description": "Web application for monitoring Claude Code sessions over Tailscale network",
  "node": "v20.x.x",
  "status": "running"
}
```

**Completion Criteria**:
- Returns correct package info
- Node version displayed

#### 2.5.5: Add startup banner
**Action**: Update `startServer()` function in `server.js`:
```javascript
function startServer() {
    server.listen(PORT, HOST, () => {
        const packageJson = require('./package.json');

        logger.info('='.repeat(60));
        logger.info(`${packageJson.name} v${packageJson.version}`);
        logger.info('='.repeat(60));
        logger.info(`Environment: ${NODE_ENV}`);
        logger.info(`Node version: ${process.version}`);
        logger.info(`Listening on: http://${HOST}:${PORT}`);
        logger.info(`Health check: http://${HOST}:${PORT}/api/health`);
        logger.info(`Status: http://${HOST}:${PORT}/api/status`);
        logger.info('='.repeat(60));
        logger.info('Server ready. Press Ctrl+C to stop');
    });
}
```

**Completion Criteria**:
- Startup banner added
- Shows version, environment, endpoints
- Formatted with borders

#### 2.5.6: Test startup banner
**Command**:
```bash
npm start
```

**Expected output**:
```
============================================================
claude-code-monitor v0.1.0
============================================================
Environment: development
Node version: v20.x.x
Listening on: http://0.0.0.0:3456
Health check: http://0.0.0.0:3456/api/health
Status: http://0.0.0.0:3456/api/status
============================================================
Server ready. Press Ctrl+C to stop
```

**Completion Criteria**:
- Banner displays correctly
- All information present

#### 2.5.7: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes

### Task 2.5 Quality Gates
- [ ] Health check endpoint implemented
- [ ] Health returns uptime and memory info
- [ ] Status endpoint shows package info
- [ ] Startup banner displays correctly
- [ ] ESLint passes on server.js
- [ ] All endpoints tested manually

### Task 2.5 Completion
```bash
git add server.js
git commit -m "Task 2.5: Add health check and monitoring"
git checkout phase-2-backend-core
git merge phase-2/task-2.5-health-check --squash
git commit -m "Task 2.5: Add health check and monitoring

- Created /api/health endpoint with system stats
- Added /api/status endpoint with version info
- Implemented uptime formatting helper
- Added detailed startup banner
- Tested all monitoring endpoints
- Quality gates passed"
```

---

## Phase 2 Completion

### Phase 2 Integration Test
Before merging to main, verify all phase 2 components work together:

```bash
# On phase-2-backend-core branch

# 1. Start server
npm start

# 2. Test in separate terminal:

# Test static files
curl http://localhost:3456/ | grep "Claude Code Monitor"

# Test health check
curl http://localhost:3456/api/health | jq '.status'

# Test status
curl http://localhost:3456/api/status | jq '.name'

# Test Socket.io (use test client or script)
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:3456');
socket.on('connect', () => {
    console.log('Socket.io connected:', socket.id);
    socket.disconnect();
});
"

# 3. Test graceful shutdown
# Press Ctrl+C and verify clean shutdown

# 4. Run linting
npm run lint

# 5. Check git status
git status  # Should be clean
```

### Expected Results
- Server starts with banner
- Static files served correctly
- Health and status endpoints return valid JSON
- Socket.io connects successfully
- Graceful shutdown works
- ESLint passes on all files
- Git working directory clean

### Phase 2 Quality Gates Checklist
- [ ] All tasks (2.1 - 2.5) completed and merged to phase branch
- [ ] Express server running on port 3456
- [ ] Socket.io connected and functional
- [ ] Static files served from public/
- [ ] Health check endpoint working
- [ ] Graceful shutdown tested
- [ ] `npm run lint` passes with zero errors
- [ ] Integration test passed
- [ ] No uncommitted changes

### Merge to Main
```bash
git checkout main
git merge phase-2-backend-core -m "Phase 2: Backend Core Infrastructure Complete

Completed tasks:
- 2.1: Create Express server foundation
- 2.2: Setup Socket.io with Express
- 2.3: Configure static file serving
- 2.4: Implement graceful shutdown
- 2.5: Add health check and monitoring

Phase completion criteria met:
✓ Express server running on port 3456
✓ Socket.io connected and functional
✓ Static files served correctly
✓ Graceful shutdown implemented
✓ Health check and status endpoints working
✓ All quality gates passed

Ready for Phase 3: Database & Session Management"

git push origin main
```

### Update PROGRESS.md
```bash
git checkout main

# Update PROGRESS.md to mark Phase 2 complete and prepare Phase 3
cat >> PROGRESS.md << 'EOF'

## Phase 2: Backend Core Infrastructure ✅
- [x] 2.1 Create Express server foundation
- [x] 2.2 Setup Socket.io with Express
- [x] 2.3 Configure static file serving
- [x] 2.4 Implement graceful shutdown
- [x] 2.5 Add health check and monitoring

**Completed**: YYYY-MM-DD
**Branch**: phase-2-backend-core (merged to main)

## Phase 3: Database & Session Management 🔜
- [ ] 3.1 Initialize SQLite database
- [ ] 3.2 Implement session data layer
- [ ] 3.3 Create PTY process manager
- [ ] 3.4 Implement session lifecycle handlers
- [ ] 3.5 Add Socket.io session events

**Status**: Not started
EOF

git add PROGRESS.md
git commit -m "Update progress: Phase 2 complete"
git push origin main
```

---

## Next Steps

After Phase 2 completion:
1. Create Phase 3 branch: `git checkout -b phase-3-session-management`
2. Read [phase-3.md](phase-3.md) for session management implementation
3. Execute Task 3.1 to begin database setup
