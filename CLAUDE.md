# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Web Monitor - A web application for monitoring and interacting with Claude Code sessions from any device (especially iOS) over a Tailscale network. Supports multiple concurrent sessions, real-time terminal output, session persistence, and running sessions as different Linux users.

## Development Workflow

### Executing Tasks

This project uses a granular, phase-based development plan. Reference specific tasks using the format:

```bash
Execute task 1.2.3  # Phase 1, Task 2, Subtask 3
Complete phase 4    # Execute entire Phase 4
```

All task specifications are in `dev-plan/phase-N.md` files with exact requirements, code, and completion criteria.

### Git Branching Strategy

**IMPORTANT**: Follow this branching model strictly:

1. **Phase branches**: `phase-N-description` (from `main`)
2. **Task branches**: `phase-N/task-N.M-description` (from phase branch)
3. Merge task branches to phase branch with `--squash`
4. Merge phase branches to `main` with merge commit

Example:
```bash
# Start Phase 1
git checkout main
git checkout -b phase-1-project-setup

# Work on Task 1.2
git checkout -b phase-1/task-1.2-eslint-setup
# ... do work ...
git checkout phase-1-project-setup
git merge phase-1/task-1.2-eslint-setup --squash
git commit -m "Task 1.2: Setup ESLint

- Installed ESLint
- Created .eslintrc.json
- Quality gates passed"

# Complete Phase 1
git checkout main
git merge phase-1-project-setup -m "Phase 1: Project Setup Complete

Completed tasks:
- 1.1: Initialize Node.js project
- 1.2: Setup ESLint
...

Phase completion criteria met:
✓ All dependencies installed
✓ ESLint configured
..."
```

### Quality Gates (MANDATORY)

Before completing ANY task, verify ALL of these:

1. **Linting**: `npm run lint` passes with zero errors
2. **Code Review**: Self-review completed
3. **Functional Test**: Feature works as specified
4. **Progress Updated**: Task marked `[x]` in `PROGRESS.md`
5. **Git Status**: `git status` shows clean working directory (including PROGRESS.md)
6. **Documentation**: Required docs/comments written

**Never skip quality gates**. Each task in `dev-plan/` specifies its own quality gate checklist.

## Project Architecture

### Core Components

**Backend (Node.js/Express):**
```
server.js                    # Main entry point, Express+Socket.io setup
lib/
  ├── logger.js              # Winston logging (console + daily rotate files)
  ├── database.js            # better-sqlite3 initialization, sessions table
  ├── sessions-db.js         # Session CRUD operations (data access layer)
  ├── pty-manager.js         # PTY process manager (node-pty wrapper)
  ├── users.js               # System user enumeration (/etc/passwd parsing)
  ├── session-scanner.js     # Claude Code session discovery and monitoring
  └── jsonl-parser.js        # Claude Code conversation history parser
```

**Frontend (Vanilla JS):**
```
public/
  ├── index.html             # UI structure (sidebar, terminal, modal)
  ├── style.css              # VSCode dark theme styling
  └── app.js                 # Socket.io client, xterm.js integration
```

### Claude Code Session Viewing

The application now supports viewing existing Claude Code sessions in addition to creating new PTY sessions.

**Session Types:**

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

**Architecture:**

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

**Socket.io Events:**

**Claude Session Events**:
- `claude:sessions:list` - Get all Claude sessions
- `claude:sessions:by-repo` - Get sessions grouped by repo
- `claude:session:watch` - Start watching session for updates
- `claude:session:unwatch` - Stop watching session
- `claude:conversation:read` - Read conversation with pagination
- `claude:session:summary` - Get session statistics
- `claude:session:updated` - Server broadcast when file changes

**File Integration:**

Files referenced in tool calls are clickable and open in Monaco Editor panel.

### Key Architectural Decisions

**Multi-User Process Spawning:**
- Sessions run as specific Linux users via `sudo -u username bash -l`
- Requires sudo configuration in `/etc/sudoers.d/claude-monitor`
- PTY processes spawned with node-pty, managed by `pty-manager.js`
- User validation happens via `/etc/passwd` parsing (only `/home/*` users)

**Session Lifecycle:**
```
1. User creates session via UI (selects user, command, working dir)
2. Server validates user exists
3. PTY process spawned: sudo -u <user> bash -l
4. Command executed in user's shell
5. Output streamed via Socket.io to all attached clients
6. Output buffered in circular buffer (last 1000 lines)
7. On exit: status updated in SQLite, clients notified
```

**Socket.io Room Architecture:**
- Each session has a Socket.io room (sessionId)
- Terminal output broadcast to room members only
- Clients join/leave rooms on attach/detach
- Enables multiple users viewing same session

**Database Schema (SQLite):**
```sql
sessions (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT,                      -- running|stopped|completed|failed
  command TEXT,
  working_directory TEXT,
  pid INTEGER,
  run_as_user TEXT NOT NULL         -- Linux username
)
```

### Critical Implementation Details

**PTY Process Management:**
- PTY processes stored in Map: `sessionId -> ptyProcess`
- Output buffers stored in Map: `sessionId -> array[1000]` (circular)
- Graceful shutdown: SIGTERM → wait 5s → SIGKILL
- Process exit triggers: database update, Socket.io broadcast, cleanup

**File Upload Flow:**
1. Client uploads via POST /api/upload/:sessionId (multer)
2. File saved to `uploads/` with unique name
3. Server validates session exists and status='running'
4. File copied to session working directory via sudo
5. Ownership set: `sudo -u <user> chown <user>:<user> <file>`
6. Temp file deleted from uploads/
7. Socket.io event broadcast to session room

**Frontend State Management:**
- `currentSessionId`: Active session
- `sessions`: Array of all sessions from database
- `terminal`: xterm.js Terminal instance
- Session list auto-updates via Socket.io events

## Tech Stack (NO SUBSTITUTIONS)

### Backend Dependencies
```json
{
  "express": "^4.18.0",
  "socket.io": "^4.6.0",
  "node-pty": "^1.0.0",
  "better-sqlite3": "^9.0.0",
  "dotenv": "^16.0.0",
  "winston": "^3.11.0",
  "winston-daily-rotate-file": "^4.7.0",
  "multer": "1.4.5-lts.1",
  "uuid": "^9.0.0"
}
```

**Note**: multer version 1.4.5 does not exist in npm registry. Using `1.4.5-lts.1` which fixes CVE-2022-24434 (executive decision made during Phase 1, Task 1.1).

### Frontend (CDN)
- socket.io-client@4.6.0
- xterm@5.3.0
- xterm-addon-fit@0.8.0

**Port**: 3456 (bind to 0.0.0.0 for Tailscale access)

## Commands

### Development
```bash
# Install dependencies
npm install

# Start server (development mode)
npm start

# Lint code
npm run lint

# Lint and auto-fix
npm run lint:fix
```

### Testing
```bash
# Manual testing: start server then open browser
npm start
# Navigate to http://localhost:3456

# Check health endpoint
curl http://localhost:3456/api/health

# View logs (if running as service)
sudo journalctl -u claude-monitor -f
```

### Production Deployment
```bash
# Install as systemd service
sudo ./install-service.js

# Service management
sudo systemctl start claude-monitor
sudo systemctl stop claude-monitor
sudo systemctl restart claude-monitor
sudo systemctl status claude-monitor

# View logs
sudo journalctl -u claude-monitor -f
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

**Critical Variables:**
- `PORT=3456` - Server port
- `HOST=0.0.0.0` - Bind address (for Tailscale)
- `NODE_ENV=development|production`
- `MAX_SESSIONS=10` - Concurrent session limit
- `SESSION_OUTPUT_BUFFER_SIZE=1000` - Lines buffered per session
- `UPLOAD_MAX_FILE_SIZE=104857600` - 100MB limit
- `DB_PATH=./sessions.db` - SQLite database location

See `ENV_VARS.md` for complete reference.

## Multi-User Setup (CRITICAL)

**Required for production use:**

1. Create service user:
```bash
sudo useradd -r -s /bin/bash -d /opt/claude-monitor -m claude-monitor
```

2. Configure sudo (replace with actual usernames):
```bash
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add:
```
User_Alias CLAUDE_USERS = user1, user2, user3
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

3. Test sudo configuration:
```bash
sudo -u claude-monitor sudo -u user1 bash -c 'whoami'
# Should output: user1
```

**See `SUDO_SETUP.md` for comprehensive guide.**

## Socket.io Event Reference

### Client → Server

**PTY Session Events:**
- `users:list` - Get system users (returns usernames from /home/*)
- `session:create` - { name, command, workingDirectory, runAsUser }
- `session:list` - Get all sessions
- `session:attach` - { sessionId } (joins room, gets buffered output)
- `session:detach` - { sessionId } (leaves room)
- `session:stop` - { sessionId } (SIGTERM to PTY)
- `session:delete` - { sessionId } (kill PTY, delete from DB)
- `terminal:input` - { sessionId, data } (write to PTY stdin)
- `terminal:resize` - { sessionId, cols, rows } (resize PTY)

**Claude Code Session Events:**
- `claude:sessions:list` - Get all Claude Code sessions
- `claude:sessions:by-repo` - Get sessions grouped by repository
- `claude:session:watch` - { sessionId } (start watching for updates)
- `claude:session:unwatch` - { sessionId } (stop watching)
- `claude:conversation:read` - { sessionId, offset, limit } (read conversation)
- `claude:session:summary` - { sessionId } (get session statistics)

**File Events:**
- `file:list` - { sessionId, path } (list directory contents)
- `file:read` - { sessionId, path, workingDir } (read file contents)
- `file:watch:start` - { sessionId } (start watching directory)
- `file:watch:stop` - { sessionId } (stop watching directory)

### Server → Client

**PTY Session Events:**
- `users:list` - { users: string[] }
- `session:list` - { sessions: Session[] }
- `session:created` - { session: Session }
- `session:status` - { sessionId, status }
- `session:deleted` - { sessionId }
- `terminal:output` - { sessionId, data } (PTY stdout/stderr)
- `file:uploaded` - { sessionId, filename, path }

**Claude Code Session Events:**
- `claude:sessions:list` - { sessions: ClaudeSession[] }
- `claude:sessions:by-repo` - { byRepo: { [repoPath]: ClaudeSession[] } }
- `claude:conversation:read` - { sessionId, messages, total, hasMore }
- `claude:session:updated` - { sessionId } (file changed notification)
- `claude:session:summary` - { sessionId, messageCount, userMessageCount, assistantMessageCount, toolUseCount }

**File Events:**
- `file:list` - { sessionId, files: FileEntry[] }
- `file:contents` - { sessionId, path, content, size, modified }
- `file:changed` - { sessionId, filename, eventType }

**Error Events:**
- `error` - { message }

## Common Patterns

### Adding a New Socket.io Event

1. Add server handler in `server.js`:
```javascript
socket.on('event:name', (params) => {
    try {
        // Validate params
        // Perform operation
        // Emit response
        socket.emit('response:event', { data });
    } catch (error) {
        logger.error('Event handler failed:', error);
        socket.emit('error', { message: error.message });
    }
});
```

2. Add client handler in `public/app.js`:
```javascript
socket.on('response:event', (data) => {
    // Update UI state
    // Render changes
});
```

3. Update this documentation

### Creating a New Module

Place in `lib/` directory with:
- JSDoc comments for functions
- Winston logger import: `const logger = require('./logger');`
- Proper error handling with try-catch
- Module exports at bottom
- Run `npm run lint` after creation

### Database Operations

Use prepared statements via `sessions-db.js`:
```javascript
const sessionsDb = require('./lib/sessions-db');

// Create
const session = sessionsDb.createSession({ name, command, workingDirectory, runAsUser });

// Read
const session = sessionsDb.getSession(id);
const all = sessionsDb.getAllSessions();

// Update
sessionsDb.updateSessionStatus(id, 'completed');
sessionsDb.updateSessionPid(id, 12345);

// Delete
sessionsDb.deleteSession(id);
```

**Never use `db.exec()` or raw SQL outside `sessions-db.js`.**

## Troubleshooting

**Session creation fails:**
- Check user exists: `id username`
- Verify sudo config: `sudo -u claude-monitor sudo -u username bash -c 'whoami'`
- Check logs: `sudo journalctl -u claude-monitor -f`

**File upload fails:**
- Verify session status='running'
- Check working directory exists: `ls -ld /path/to/dir`
- Verify sudo permissions for cp and chown

**Terminal shows no output:**
- Check PTY process running: `ps aux | grep node.*pty`
- Verify Socket.io connection in browser console
- Check circular buffer has data (see logs)

**Port 3456 already in use:**
```bash
sudo netstat -tulpn | grep 3456
# Kill process or change PORT in .env
```

See `TROUBLESHOOTING.md` for comprehensive guide.

## Progress Tracking

**CRITICAL**: Always update `PROGRESS.md` after completing tasks/phases.

The file tracks:
- Current phase status (⏳ Not Started, 🚧 In Progress, ✅ Complete)
- Individual task completion checkboxes
- Completion dates
- Current status summary

**Workflow**:
1. Before starting task: Mark `🚧` in PROGRESS.md
2. After completing task: Mark `[x]` in PROGRESS.md and commit with task
3. After completing phase: Update dates, mark ✅, commit with phase merge

Example:
```markdown
## Phase 1: Project Setup 🚧
- [x] 1.1 Initialize Node.js project
- [x] 1.2 Setup ESLint
- 🚧 1.3 Create directory structure
...
```

See `PROGRESS.md` for complete tracking template with instructions.

## Documentation Structure

- `DEV_PLAN.md` - Phase overview and navigation
- `dev-plan/phase-N.md` - Detailed task specifications
- `README.md` - User-facing setup guide
- `INSTALLATION.md` - Production deployment
- `SUDO_SETUP.md` - Multi-user configuration
- `TROUBLESHOOTING.md` - Common issues
- `ENV_VARS.md` - Environment variable reference
- `CHANGELOG.md` - Version history

## Critical Rules

1. **Never substitute packages** - Use exact versions from issue #1 (see exception handling below)
2. **Always run quality gates** - Especially ESLint before committing
3. **Follow git workflow** - Phase branches → Task branches → Squash merge
4. **Update PROGRESS.md** - Mark tasks complete immediately after finishing, commit with task
5. **Test sudo operations** - Verify user switching works before marking complete
6. **Buffer terminal output** - Maintain circular buffer (1000 lines max)
7. **Graceful PTY shutdown** - SIGTERM then SIGKILL after 5s
8. **Validate users** - Check `/etc/passwd` before spawning PTY
9. **Clean up temp files** - Delete from `uploads/` after copy
10. **Use Socket.io rooms** - Broadcast terminal output to session room only
11. **Log everything** - Use winston logger, not console.log

### Exception Handling: When Reality Conflicts with Rules

**IMPORTANT**: If you encounter a situation where you cannot follow the development plan or critical rules due to external factors (package doesn't exist, API changed, etc.):

1. **STOP immediately** - Do not proceed with substitutions or workarounds
2. **Document the conflict** - Clearly explain what the plan requires vs. what reality allows
3. **Present options** - List 2-3 possible solutions with pros/cons
4. **Ask for executive decision** - Prompt the user to make the final call
5. **Update documentation** - Once decision is made, update all affected plan docs and this file

Example conflicts that require escalation:
- Package version doesn't exist in registry
- Required API endpoint deprecated/removed
- Security vulnerability in specified version
- Breaking changes in dependency
- File/directory structure conflicts

**Do not attempt to "fix" these issues autonomously. Always escalate to user.**

## Issue #1 Reference

The complete specification is in GitHub issue #1. When in doubt about requirements, implementation details, or architecture decisions, refer to issue #1 as the source of truth.

Key specification file: See issue body for HTML structure, CSS styling, JavaScript patterns, and exact Socket.io event formats.
