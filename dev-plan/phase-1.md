# Phase 1: Project Setup

**Branch**: `phase-1-project-setup`
**Duration**: ~2 hours
**Prerequisites**: None

## Phase Objectives
- Initialize Node.js project with proper configuration
- Install all required dependencies (NO SUBSTITUTIONS)
- Configure code quality tools (ESLint, Prettier)
- Create directory structure
- Setup environment variables
- Configure logging infrastructure

## Phase Completion Criteria
- [ ] `package.json` exists with all required dependencies
- [ ] ESLint runs without errors on any created files
- [ ] Directory structure matches specification
- [ ] `.env.example` file created with all required variables
- [ ] Winston logger configured and tested
- [ ] All task branches merged to `phase-1-project-setup`
- [ ] Phase branch ready to merge to `main`

---

## Task 1.1: Initialize Node.js Project

**Branch**: `phase-1/task-1.1-nodejs-init`
**Estimated Time**: 20 minutes

### Subtasks

#### 1.1.1: Create project directory and initialize npm
**Commands**:
```bash
cd /home/mmn/github/Micro-Wormhole
mkdir claude-code-monitor
cd claude-code-monitor
npm init -y
```

**Completion Criteria**:
- Directory `claude-code-monitor` exists
- `package.json` file created

#### 1.1.2: Update package.json metadata
**Action**: Edit `package.json` and set:
```json
{
  "name": "claude-code-monitor",
  "version": "0.1.0",
  "description": "Web application for monitoring Claude Code sessions over Tailscale network",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "keywords": ["claude-code", "monitoring", "terminal", "websocket"],
  "author": "",
  "license": "MIT",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Completion Criteria**:
- All fields updated correctly
- Node version requirement set to >=20.0.0

#### 1.1.3: Install backend dependencies
**Commands**:
```bash
npm install express@^4.18.0 socket.io@^4.6.0 node-pty@^1.0.0 better-sqlite3@^9.0.0 dotenv@^16.0.0 winston@^3.11.0 winston-daily-rotate-file@^4.7.0 multer@^1.4.5 uuid@^9.0.0
```

**Expected packages.json dependencies**:
```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "multer": "^1.4.5",
    "node-pty": "^1.0.0",
    "socket.io": "^4.6.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.0"
  }
}
```

**Completion Criteria**:
- All dependencies installed successfully
- `node_modules/` directory exists
- `package-lock.json` created
- No installation errors or warnings

#### 1.1.4: Create .gitignore
**Action**: Create `.gitignore` file with:
```
# Dependencies
node_modules/

# Environment
.env

# Database
sessions.db
sessions.db-journal

# Logs
logs/
*.log

# Uploads
uploads/

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
```

**Completion Criteria**:
- `.gitignore` file created
- Contains all specified patterns

### Task 1.1 Quality Gates
- [ ] `package.json` has correct structure and all dependencies
- [ ] `npm install` completes without errors
- [ ] `.gitignore` covers all necessary patterns
- [ ] Git status shows only tracked files

### Task 1.1 Completion
```bash
git add package.json package-lock.json .gitignore
git commit -m "Task 1.1: Initialize Node.js project with dependencies"
git checkout phase-1-project-setup
git merge phase-1/task-1.1-nodejs-init --squash
git commit -m "Task 1.1: Initialize Node.js project

- Created package.json with metadata
- Installed all backend dependencies
- Created .gitignore file
- Quality gates passed"
```

---

## Task 1.2: Setup ESLint and Code Formatting

**Branch**: `phase-1/task-1.2-eslint-setup`
**Estimated Time**: 30 minutes

### Subtasks

#### 1.2.1: Install ESLint and dependencies
**Commands**:
```bash
npm install --save-dev eslint@^8.0.0
```

**Completion Criteria**:
- ESLint installed in devDependencies
- `package.json` updated

#### 1.2.2: Initialize ESLint configuration
**Action**: Create `.eslintrc.json` with:
```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "indent": ["error", 4],
    "linebreak-style": ["error", "unix"],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-unused-vars": ["warn"],
    "no-console": "off",
    "no-undef": "error"
  }
}
```

**Completion Criteria**:
- `.eslintrc.json` file created
- Configuration matches specification

#### 1.2.3: Add ESLint scripts to package.json
**Action**: Add to `scripts` section in `package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

**Completion Criteria**:
- Scripts added correctly
- `npm run lint` command works (may show no files to lint yet)

#### 1.2.4: Create .eslintignore
**Action**: Create `.eslintignore` file with:
```
node_modules/
logs/
uploads/
*.db
*.log
```

**Completion Criteria**:
- `.eslintignore` file created
- Ignores match .gitignore patterns

#### 1.2.5: Test ESLint configuration
**Action**: Create temporary test file `test-lint.js`:
```javascript
const test = 'hello';
console.log(test);
```

**Commands**:
```bash
npm run lint test-lint.js
rm test-lint.js
```

**Completion Criteria**:
- ESLint runs without errors on test file
- Test file deleted after verification

### Task 1.2 Quality Gates
- [ ] ESLint installed in devDependencies
- [ ] `.eslintrc.json` configuration valid
- [ ] `npm run lint` executes successfully
- [ ] `.eslintignore` matches gitignore patterns

### Task 1.2 Completion
```bash
git add package.json .eslintrc.json .eslintignore
git commit -m "Task 1.2: Configure ESLint and code quality tools"
git checkout phase-1-project-setup
git merge phase-1/task-1.2-eslint-setup --squash
git commit -m "Task 1.2: Setup ESLint and code formatting

- Installed ESLint with recommended config
- Created .eslintrc.json configuration
- Added lint scripts to package.json
- Created .eslintignore file
- Quality gates passed"
```

---

## Task 1.3: Create Directory Structure

**Branch**: `phase-1/task-1.3-directory-structure`
**Estimated Time**: 15 minutes

### Subtasks

#### 1.3.1: Create public directory
**Commands**:
```bash
mkdir -p public
```

**Completion Criteria**:
- `public/` directory exists

#### 1.3.2: Create placeholder files
**Action**: Create empty files with comments:

**public/index.html**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Monitor</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- UI will be implemented in Phase 4 -->
    <h1>Claude Code Monitor</h1>
    <p>Frontend coming soon...</p>
    <script src="app.js"></script>
</body>
</html>
```

**public/style.css**:
```css
/* CSS will be implemented in Phase 4 */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 20px;
    background: #1e1e1e;
    color: #d4d4d4;
}
```

**public/app.js**:
```javascript
'use strict';

// Frontend logic will be implemented in Phase 4
console.log('Claude Code Monitor - Frontend Loading...');
```

**Completion Criteria**:
- All three files created in `public/` directory
- Files contain placeholder content
- HTML file is valid
- JavaScript has 'use strict'

#### 1.3.3: Create logs directory with .gitkeep
**Commands**:
```bash
mkdir -p logs
touch logs/.gitkeep
```

**Completion Criteria**:
- `logs/` directory exists
- `.gitkeep` file present to track empty directory

#### 1.3.4: Create uploads directory with .gitkeep
**Commands**:
```bash
mkdir -p uploads
touch uploads/.gitkeep
```

**Completion Criteria**:
- `uploads/` directory exists
- `.gitkeep` file present

#### 1.3.5: Verify directory structure
**Command**:
```bash
tree -L 2 -a
```

**Expected output**:
```
.
├── .eslintignore
├── .eslintrc.json
├── .gitignore
├── logs
│   └── .gitkeep
├── node_modules
│   └── [...]
├── package.json
├── package-lock.json
├── public
│   ├── app.js
│   ├── index.html
│   └── style.css
└── uploads
    └── .gitkeep
```

**Completion Criteria**:
- Directory structure matches specification
- All placeholder files present

### Task 1.3 Quality Gates
- [ ] All directories created
- [ ] Placeholder files have valid syntax
- [ ] `npm run lint` passes on public/app.js
- [ ] Directory structure matches expected layout

### Task 1.3 Completion
```bash
git add public/ logs/.gitkeep uploads/.gitkeep
git commit -m "Task 1.3: Create directory structure and placeholder files"
git checkout phase-1-project-setup
git merge phase-1/task-1.3-directory-structure --squash
git commit -m "Task 1.3: Create directory structure

- Created public/ directory with placeholder files
- Created logs/ directory with .gitkeep
- Created uploads/ directory with .gitkeep
- Verified structure matches specification
- Quality gates passed"
```

---

## Task 1.4: Configure Environment Variables

**Branch**: `phase-1/task-1.4-environment-config`
**Estimated Time**: 20 minutes

### Subtasks

#### 1.4.1: Create .env.example file
**Action**: Create `.env.example` with:
```env
# Server Configuration
PORT=3456
HOST=0.0.0.0
NODE_ENV=development

# Session Configuration
MAX_SESSIONS=10
SESSION_OUTPUT_BUFFER_SIZE=1000

# File Upload Configuration
UPLOAD_MAX_FILE_SIZE=104857600
UPLOAD_DIR=./uploads

# Logging Configuration
LOG_LEVEL=info
LOG_DIR=./logs
LOG_MAX_FILES=14d
LOG_MAX_SIZE=20m

# Database Configuration
DB_PATH=./sessions.db

# Process Configuration
PROCESS_KILL_TIMEOUT=5000
PTY_COLS=80
PTY_ROWS=24
```

**Completion Criteria**:
- `.env.example` file created
- Contains all configuration variables
- Comments explain each section
- Values match specification from issue #1

#### 1.4.2: Create default .env file
**Commands**:
```bash
cp .env.example .env
```

**Completion Criteria**:
- `.env` file created
- Contains same content as `.env.example`
- File is git-ignored (verify with `git status`)

#### 1.4.3: Document environment variables
**Action**: Create `ENV_VARS.md` with:
```markdown
# Environment Variables

## Server Configuration

### PORT
- **Type**: Number
- **Default**: 3456
- **Description**: Port number for HTTP server
- **Required**: Yes

### HOST
- **Type**: String
- **Default**: 0.0.0.0
- **Description**: Bind address (0.0.0.0 for all interfaces, accessible via Tailscale)
- **Required**: Yes

### NODE_ENV
- **Type**: String
- **Default**: development
- **Options**: development, production
- **Description**: Node environment mode
- **Required**: Yes

## Session Configuration

### MAX_SESSIONS
- **Type**: Number
- **Default**: 10
- **Description**: Maximum number of concurrent sessions allowed
- **Required**: Yes

### SESSION_OUTPUT_BUFFER_SIZE
- **Type**: Number
- **Default**: 1000
- **Description**: Number of terminal output lines to buffer per session
- **Required**: Yes

## File Upload Configuration

### UPLOAD_MAX_FILE_SIZE
- **Type**: Number (bytes)
- **Default**: 104857600 (100MB)
- **Description**: Maximum file upload size in bytes
- **Required**: Yes

### UPLOAD_DIR
- **Type**: String (path)
- **Default**: ./uploads
- **Description**: Temporary directory for file uploads
- **Required**: Yes

## Logging Configuration

### LOG_LEVEL
- **Type**: String
- **Default**: info
- **Options**: error, warn, info, debug
- **Description**: Winston logging level
- **Required**: Yes

### LOG_DIR
- **Type**: String (path)
- **Default**: ./logs
- **Description**: Directory for log files
- **Required**: Yes

### LOG_MAX_FILES
- **Type**: String
- **Default**: 14d
- **Description**: Maximum log file retention (14 days)
- **Required**: Yes

### LOG_MAX_SIZE
- **Type**: String
- **Default**: 20m
- **Description**: Maximum log file size before rotation
- **Required**: Yes

## Database Configuration

### DB_PATH
- **Type**: String (path)
- **Default**: ./sessions.db
- **Description**: Path to SQLite database file
- **Required**: Yes

## Process Configuration

### PROCESS_KILL_TIMEOUT
- **Type**: Number (milliseconds)
- **Default**: 5000
- **Description**: Time to wait for SIGTERM before sending SIGKILL
- **Required**: Yes

### PTY_COLS
- **Type**: Number
- **Default**: 80
- **Description**: Default terminal columns for PTY
- **Required**: Yes

### PTY_ROWS
- **Type**: Number
- **Default**: 24
- **Description**: Default terminal rows for PTY
- **Required**: Yes
```

**Completion Criteria**:
- `ENV_VARS.md` file created
- All variables documented
- Types, defaults, and descriptions provided

#### 1.4.4: Verify .env is git-ignored
**Command**:
```bash
git status
```

**Expected**: `.env` should NOT appear in untracked files

**Completion Criteria**:
- `.env` file exists but is not tracked by git
- `.env.example` is tracked

### Task 1.4 Quality Gates
- [ ] `.env.example` contains all required variables
- [ ] `.env` file created and git-ignored
- [ ] `ENV_VARS.md` documents all variables
- [ ] Values match specification from issue #1
- [ ] `git status` does not show `.env`

### Task 1.4 Completion
```bash
git add .env.example ENV_VARS.md
git commit -m "Task 1.4: Configure environment variables"
git checkout phase-1-project-setup
git merge phase-1/task-1.4-environment-config --squash
git commit -m "Task 1.4: Configure environment variables

- Created .env.example with all configuration
- Created default .env file (git-ignored)
- Documented all variables in ENV_VARS.md
- Verified .env is properly ignored
- Quality gates passed"
```

---

## Task 1.5: Setup Logging Infrastructure

**Branch**: `phase-1/task-1.5-logging-setup`
**Estimated Time**: 35 minutes

### Subtasks

#### 1.5.1: Create logger utility module
**Action**: Create `lib/logger.js` with:
```javascript
'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
require('dotenv').config();

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        if (stack) {
            return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// Create Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        // Daily rotate file transport
        new DailyRotateFile({
            filename: path.join(logDir, 'app-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: process.env.LOG_MAX_SIZE || '20m',
            maxFiles: process.env.LOG_MAX_FILES || '14d',
            format: logFormat
        }),
        // Error log file
        new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: process.env.LOG_MAX_SIZE || '20m',
            maxFiles: process.env.LOG_MAX_FILES || '14d',
            level: 'error',
            format: logFormat
        })
    ]
});

module.exports = logger;
```

**Completion Criteria**:
- `lib/` directory created
- `lib/logger.js` file created
- Code matches specification exactly
- Uses dotenv for configuration
- Creates log directory if missing
- Three transports configured: console, app log, error log

#### 1.5.2: Create lib directory
**Commands**:
```bash
mkdir -p lib
```

**Completion Criteria**:
- `lib/` directory exists

#### 1.5.3: Test logger module
**Action**: Create temporary test file `test-logger.js`:
```javascript
'use strict';

const logger = require('./lib/logger');

logger.info('Testing info level log');
logger.warn('Testing warn level log');
logger.error('Testing error level log');
logger.debug('Testing debug level log (should not appear with default config)');

console.log('\nLogger test complete. Check logs/ directory for output files.');
```

**Commands**:
```bash
node test-logger.js
ls -la logs/
cat logs/app-*.log
```

**Expected output**:
- Console shows colorized log messages
- `logs/app-YYYY-MM-DD.log` file created
- `logs/error-YYYY-MM-DD.log` file created
- Log files contain timestamped messages

**Cleanup**:
```bash
rm test-logger.js
rm logs/app-*.log logs/error-*.log
```

**Completion Criteria**:
- Logger creates log files correctly
- Console output is colorized
- Error logs go to separate file
- Log format matches specification
- Test files cleaned up

#### 1.5.4: Run ESLint on logger module
**Command**:
```bash
npm run lint lib/logger.js
```

**Completion Criteria**:
- ESLint passes with zero errors
- Code follows style guide

#### 1.5.5: Update .gitignore for logs
**Action**: Verify `.gitignore` contains:
```
logs/
*.log
```

**Completion Criteria**:
- Log files are ignored
- `.gitkeep` allows logs/ directory to be tracked

### Task 1.5 Quality Gates
- [ ] `lib/logger.js` created with correct implementation
- [ ] Logger creates console and file transports
- [ ] Test demonstrates logger works correctly
- [ ] ESLint passes on lib/logger.js
- [ ] Log files are git-ignored

### Task 1.5 Completion
```bash
git add lib/logger.js
git commit -m "Task 1.5: Setup Winston logging infrastructure"
git checkout phase-1-project-setup
git merge phase-1/task-1.5-logging-setup --squash
git commit -m "Task 1.5: Setup logging infrastructure

- Created lib/logger.js with Winston configuration
- Configured console and daily rotate file transports
- Added separate error log file
- Tested logger functionality
- Quality gates passed"
```

---

## Phase 1 Completion

### Phase 1 Integration Test
Before merging to main, verify all phase 1 components work together:

```bash
# On phase-1-project-setup branch

# 1. Verify project structure
tree -L 2 -a

# 2. Verify dependencies installed
npm list --depth=0

# 3. Run ESLint on all files
npm run lint

# 4. Test logger
node -e "const logger = require('./lib/logger'); logger.info('Phase 1 complete');"

# 5. Verify environment config
node -e "require('dotenv').config(); console.log('PORT:', process.env.PORT);"

# 6. Check git status
git status  # Should be clean
```

### Expected Results
- Project structure matches specification
- All dependencies installed successfully
- ESLint passes on all files
- Logger creates log files
- Environment variables load correctly
- Git working directory clean

### Phase 1 Quality Gates Checklist
- [ ] All tasks (1.1 - 1.5) completed and merged to phase branch
- [ ] `npm run lint` passes with zero errors
- [ ] All required dependencies in package.json
- [ ] Directory structure matches specification
- [ ] Environment variables documented
- [ ] Logger tested and functional
- [ ] No uncommitted changes
- [ ] Integration test passed

### Merge to Main
```bash
git checkout main
git merge phase-1-project-setup -m "Phase 1: Project Setup Complete

Completed tasks:
- 1.1: Initialize Node.js project with dependencies
- 1.2: Setup ESLint and code formatting
- 1.3: Create directory structure
- 1.4: Configure environment variables
- 1.5: Setup logging infrastructure

Phase completion criteria met:
✓ package.json with all required dependencies
✓ ESLint configured and passing
✓ Directory structure matches specification
✓ .env.example created with all variables
✓ Winston logger configured and tested
✓ All quality gates passed

Ready for Phase 2: Backend Core Infrastructure"

git push origin main
```

### Create PROGRESS.md
After merging, create progress tracking file:

```bash
cat > PROGRESS.md << 'EOF'
# Claude Code Monitor - Development Progress

## Phase 1: Project Setup ✅
- [x] 1.1 Initialize Node.js project
- [x] 1.2 Setup ESLint and code formatting
- [x] 1.3 Create directory structure
- [x] 1.4 Configure environment variables
- [x] 1.5 Setup logging infrastructure

**Completed**: YYYY-MM-DD
**Branch**: phase-1-project-setup (merged to main)

## Phase 2: Backend Core Infrastructure 🔜
- [ ] 2.1 Create Express server foundation
- [ ] 2.2 Setup Socket.io with Express
- [ ] 2.3 Configure static file serving
- [ ] 2.4 Implement graceful shutdown
- [ ] 2.5 Add health check and monitoring

**Status**: Not started
EOF

git add PROGRESS.md
git commit -m "Add development progress tracking"
git push origin main
```

---

## Next Steps

After Phase 1 completion:
1. Create Phase 2 branch: `git checkout -b phase-2-backend-core`
2. Read [phase-2.md](phase-2.md) for backend core implementation
3. Execute Task 2.1 to begin Express server setup
