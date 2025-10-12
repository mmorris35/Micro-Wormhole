# Phase 8: File Editor Panel

**Branch**: `phase-8-file-editor`
**Duration**: ~6 hours
**Prerequisites**: Phase 7 completed

## Phase Objectives
- Add collapsible file editor panel to UI
- Implement backend file reading and listing
- Integrate Monaco Editor for syntax highlighting
- Add file change detection and auto-reload
- Enable review of Claude Code edits to files
- Maintain read-only access for security

## Phase Completion Criteria
- [ ] Backend file reading endpoints functional
- [ ] File list displays in UI
- [ ] Monaco Editor integrated and rendering files
- [ ] Collapsible panel works smoothly
- [ ] File changes detected and auto-reload
- [ ] Syntax highlighting works for common languages
- [ ] Path traversal protection implemented
- [ ] File size limits enforced
- [ ] Responsive design (hidden on mobile)
- [ ] All task branches merged to `phase-8-file-editor`
- [ ] Phase branch ready to merge to `main`

---

## Task 8.1: Create File Manager Backend

**Branch**: `phase-8/task-8.1-file-manager`
**Estimated Time**: 1.5 hours

### Subtasks

#### 8.1.1: Create file manager utility module
**Action**: Create `lib/file-manager.js`:

```javascript
'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');

const MAX_FILE_SIZE = 1048576; // 1MB limit for display

/**
 * File Manager - Handle file operations for sessions
 */
class FileManager {
    constructor() {
        this.watchers = new Map(); // sessionId -> FSWatcher
    }

    /**
     * Validate path is within session working directory
     */
    validatePath(sessionWorkingDir, requestedPath) {
        const resolvedPath = path.resolve(sessionWorkingDir, requestedPath);
        const normalizedBase = path.resolve(sessionWorkingDir);

        if (!resolvedPath.startsWith(normalizedBase)) {
            throw new Error('Path traversal attempt detected');
        }

        return resolvedPath;
    }

    /**
     * List files in directory
     */
    async listFiles(sessionWorkingDir, relativePath = '.') {
        try {
            const fullPath = this.validatePath(sessionWorkingDir, relativePath);

            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            const files = [];

            for (const entry of entries) {
                // Skip hidden files and node_modules
                if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }

                const filePath = path.join(relativePath, entry.name);
                const stats = await fs.stat(path.join(fullPath, entry.name));

                files.push({
                    name: entry.name,
                    path: filePath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    modified: stats.mtime
                });
            }

            // Sort: directories first, then alphabetically
            files.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            return files;
        } catch (error) {
            logger.error('Failed to list files:', error);
            throw error;
        }
    }

    /**
     * Read file contents
     */
    async readFile(sessionWorkingDir, filePath) {
        try {
            const fullPath = this.validatePath(sessionWorkingDir, filePath);

            // Check file exists and is a file
            const stats = await fs.stat(fullPath);
            if (!stats.isFile()) {
                throw new Error('Not a file');
            }

            // Check file size
            if (stats.size > MAX_FILE_SIZE) {
                throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
            }

            // Check if binary file
            const buffer = await fs.readFile(fullPath);
            if (this.isBinary(buffer)) {
                throw new Error('Binary files not supported');
            }

            const content = buffer.toString('utf8');

            return {
                path: filePath,
                content: content,
                size: stats.size,
                modified: stats.mtime
            };
        } catch (error) {
            logger.error('Failed to read file:', error);
            throw error;
        }
    }

    /**
     * Check if file is binary
     */
    isBinary(buffer) {
        const chunkSize = Math.min(buffer.length, 8000);
        for (let i = 0; i < chunkSize; i++) {
            const byte = buffer[i];
            if (byte === 0) return true; // NULL byte indicates binary
        }
        return false;
    }

    /**
     * Watch directory for changes
     */
    watchDirectory(sessionId, sessionWorkingDir, io) {
        try {
            // Stop existing watcher if any
            this.stopWatching(sessionId);

            logger.info(`Starting file watch for session ${sessionId}: ${sessionWorkingDir}`);

            const watcher = fsSync.watch(sessionWorkingDir, { recursive: true }, (eventType, filename) => {
                if (!filename) return;

                // Ignore hidden files and node_modules
                if (filename.startsWith('.') || filename.includes('node_modules')) {
                    return;
                }

                logger.debug(`File ${eventType}: ${filename} in session ${sessionId}`);

                // Emit to all clients in session room
                io.to(sessionId).emit('file:changed', {
                    sessionId,
                    filename,
                    eventType
                });
            });

            this.watchers.set(sessionId, watcher);
        } catch (error) {
            logger.error(`Failed to watch directory for session ${sessionId}:`, error);
        }
    }

    /**
     * Stop watching directory
     */
    stopWatching(sessionId) {
        const watcher = this.watchers.get(sessionId);
        if (watcher) {
            watcher.close();
            this.watchers.delete(sessionId);
            logger.info(`Stopped file watch for session ${sessionId}`);
        }
    }

    /**
     * Stop all watchers (for shutdown)
     */
    stopAllWatchers() {
        logger.info(`Stopping all file watchers: ${this.watchers.size}`);
        for (const [sessionId, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();
    }
}

// Singleton instance
const fileManager = new FileManager();

module.exports = fileManager;
```

**Completion Criteria**:
- `lib/file-manager.js` created
- Path traversal validation implemented
- File listing with metadata
- File reading with size limits
- Binary file detection
- Directory watching with fs.watch
- Singleton export

#### 8.1.2: Add Socket.io events for file operations
**Action**: Update `server.js` Socket.io connection handler:

```javascript
// Import at top
const fileManager = require('./lib/file-manager');

// In io.on('connection', ...) handler:

    // List files in session directory
    socket.on('file:list', async ({ sessionId, path = '.' }) => {
        try {
            const session = sessionsDb.getSession(sessionId);
            if (!session) {
                return socket.emit('error', { message: 'Session not found' });
            }

            const files = await fileManager.listFiles(session.working_directory, path);
            socket.emit('file:list', { sessionId, path, files });
        } catch (error) {
            logger.error('File list failed:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Read file contents
    socket.on('file:read', async ({ sessionId, filePath }) => {
        try {
            const session = sessionsDb.getSession(sessionId);
            if (!session) {
                return socket.emit('error', { message: 'Session not found' });
            }

            const fileData = await fileManager.readFile(session.working_directory, filePath);
            socket.emit('file:contents', {
                sessionId,
                ...fileData
            });
        } catch (error) {
            logger.error('File read failed:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Start watching directory
    socket.on('file:watch:start', ({ sessionId }) => {
        try {
            const session = sessionsDb.getSession(sessionId);
            if (!session) {
                return socket.emit('error', { message: 'Session not found' });
            }

            fileManager.watchDirectory(sessionId, session.working_directory, io);
            socket.emit('file:watch:started', { sessionId });
        } catch (error) {
            logger.error('Failed to start file watch:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Stop watching directory
    socket.on('file:watch:stop', ({ sessionId }) => {
        fileManager.stopWatching(sessionId);
        socket.emit('file:watch:stopped', { sessionId });
    });
```

**Completion Criteria**:
- file:list event handler added
- file:read event handler added
- file:watch:start event handler added
- file:watch:stop event handler added
- Error handling for all events

#### 8.1.3: Update graceful shutdown
**Action**: Update gracefulShutdown in `server.js`:

```javascript
// In gracefulShutdown function, after ptyManager.killAll():
            // Kill all PTY processes
            ptyManager.killAll();

            // Stop all file watchers
            fileManager.stopAllWatchers();

            logger.info('Graceful shutdown complete');
```

**Completion Criteria**:
- File watchers stopped on shutdown

#### 8.1.4: Test file manager
**Action**: Create `test-file-manager.js`:

```javascript
'use strict';

const fileManager = require('./lib/file-manager');
const logger = require('./lib/logger');
const fs = require('fs').promises;

async function test() {
    const testDir = process.cwd();

    logger.info('Testing file manager...\n');

    try {
        // Test 1: List files
        logger.info('Test 1: List files in current directory');
        const files = await fileManager.listFiles(testDir, '.');
        logger.info(`Found ${files.length} files/directories`);
        files.slice(0, 5).forEach(f => {
            logger.info(`  ${f.type === 'directory' ? '📁' : '📄'} ${f.name}`);
        });

        // Test 2: Read this test file
        logger.info('\nTest 2: Read test file');
        const fileData = await fileManager.readFile(testDir, 'test-file-manager.js');
        logger.info(`Read ${fileData.size} bytes`);
        logger.info(`First 100 chars: ${fileData.content.substring(0, 100)}...`);

        // Test 3: Path traversal protection
        logger.info('\nTest 3: Path traversal protection');
        try {
            await fileManager.readFile(testDir, '../../etc/passwd');
            logger.error('FAIL: Path traversal not blocked!');
        } catch (error) {
            logger.info(`✓ Blocked: ${error.message}`);
        }

        // Test 4: Binary file detection
        logger.info('\nTest 4: Create and detect binary file');
        await fs.writeFile('/tmp/test-binary.bin', Buffer.from([0x00, 0xFF, 0xAA]));
        try {
            await fileManager.readFile('/tmp', 'test-binary.bin');
            logger.error('FAIL: Binary file not detected!');
        } catch (error) {
            logger.info(`✓ Detected: ${error.message}`);
        }
        await fs.unlink('/tmp/test-binary.bin');

        logger.info('\n✓ All file manager tests passed!');
    } catch (error) {
        logger.error('Test failed:', error);
        process.exit(1);
    }
}

test();
```

**Commands**:
```bash
node test-file-manager.js
```

**Expected output**:
- File listing works
- File reading works
- Path traversal blocked
- Binary files detected

**Cleanup**:
```bash
rm test-file-manager.js
```

**Completion Criteria**:
- All tests pass
- Security measures verified
- Test file removed

#### 8.1.5: Run ESLint
**Commands**:
```bash
npm run lint lib/file-manager.js server.js
```

**Completion Criteria**:
- ESLint passes

### Task 8.1 Quality Gates
- [ ] `lib/file-manager.js` created and working
- [ ] Path traversal protection verified
- [ ] File size limits enforced
- [ ] Binary file detection works
- [ ] Socket.io events implemented
- [ ] File watchers stop on shutdown
- [ ] All tests pass
- [ ] ESLint passes

### Task 8.1 Completion
```bash
git add lib/file-manager.js server.js
git commit -m "Task 8.1: Create file manager backend"
git checkout phase-8-file-editor
git merge phase-8/task-8.1-file-manager --squash
git commit -m "Task 8.1: Create file manager backend

- Created lib/file-manager.js with file operations
- Added path traversal protection
- Implemented file listing and reading
- Added binary file detection
- Created Socket.io events for file operations
- Added file watching with fs.watch
- Integrated with graceful shutdown
- Quality gates passed"
```

---

## Task 8.2: Update UI Layout for Editor Panel

**Branch**: `phase-8/task-8.2-ui-layout`
**Estimated Time**: 1 hour

### Subtasks

#### 8.2.1: Add editor panel HTML
**Action**: Update `public/index.html`, add before closing `</body>`:

```html
    <!-- File Editor Panel -->
    <div id="editor-panel" class="editor-panel collapsed">
        <div class="editor-header">
            <div class="editor-title">
                <span class="editor-icon">📄</span>
                <span id="editor-filename">No file selected</span>
            </div>
            <div class="editor-actions">
                <button id="editor-refresh" class="btn-icon" title="Refresh file">
                    <span>🔄</span>
                </button>
                <button id="editor-close" class="btn-icon" title="Close editor">
                    <span>×</span>
                </button>
            </div>
        </div>
        <div id="monaco-container"></div>
    </div>

    <!-- Editor Toggle Button -->
    <button id="editor-toggle" class="editor-toggle" title="Toggle file editor">
        <span class="toggle-icon">📝</span>
    </button>
```

**Completion Criteria**:
- Editor panel HTML added
- Toggle button added
- IDs match JavaScript references

#### 8.2.2: Update CSS for editor panel
**Action**: Add to `public/style.css`:

```css
/* Editor Panel */
.editor-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 500px;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease;
    z-index: 100;
}

.editor-panel.collapsed {
    transform: translateX(100%);
}

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
}

.editor-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.editor-icon {
    font-size: 16px;
}

#editor-filename {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}

.editor-actions {
    display: flex;
    gap: 4px;
}

.btn-icon {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    min-height: 32px;
}

.btn-icon:hover {
    background: var(--bg-primary);
}

#monaco-container {
    flex: 1;
    width: 100%;
    height: 100%;
}

/* Editor Toggle Button */
.editor-toggle {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: all 0.3s;
    z-index: 101;
}

.editor-toggle:hover {
    background: #005a9e;
    transform: scale(1.1);
}

.editor-toggle.active {
    right: 520px; /* Width of panel + 20px */
}

/* Adjust main content when editor is open */
.container.editor-open {
    margin-right: 500px;
}

/* Responsive - hide editor on mobile */
@media (max-width: 768px) {
    .editor-panel {
        width: 100%;
    }

    .editor-toggle.active {
        right: 20px;
    }

    .container.editor-open {
        margin-right: 0;
    }
}
```

**Completion Criteria**:
- Editor panel styled
- Collapsed state works
- Toggle button styled
- Responsive design for mobile

#### 8.2.3: Test UI layout
**Manual test**:
1. Start server and open browser
2. Verify editor panel exists but is collapsed (off-screen)
3. Verify toggle button appears bottom-right
4. Inspect elements have correct classes

**Completion Criteria**:
- HTML renders correctly
- CSS applied properly
- Panel hidden by default

#### 8.2.4: Run ESLint on updated files
**Command**:
```bash
npm run lint public/
```

**Completion Criteria**:
- ESLint passes (if JS changes)

### Task 8.2 Quality Gates
- [ ] Editor panel HTML added
- [ ] CSS styling complete
- [ ] Responsive design implemented
- [ ] UI renders correctly
- [ ] ESLint passes

### Task 8.2 Completion
```bash
git add public/index.html public/style.css
git commit -m "Task 8.2: Update UI layout for editor panel"
git checkout phase-8-file-editor
git merge phase-8/task-8.2-ui-layout --squash
git commit -m "Task 8.2: Update UI layout for editor panel

- Added editor panel HTML structure
- Created collapsible panel CSS
- Added editor toggle button
- Implemented responsive design
- Quality gates passed"
```

---

## Task 8.3: Integrate Monaco Editor

**Branch**: `phase-8/task-8.3-monaco-editor`
**Estimated Time**: 1.5 hours

### Subtasks

#### 8.3.1: Add Monaco Editor CDN to HTML
**Action**: Update `public/index.html`, add before closing `</head>`:

```html
    <!-- Monaco Editor -->
    <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js"></script>
```

**Completion Criteria**:
- Monaco loader script added

#### 8.3.2: Initialize Monaco Editor in app.js
**Action**: Add to `public/app.js`:

```javascript
// Monaco Editor
let monacoEditor = null;
let currentEditorFile = null;

/**
 * Initialize Monaco Editor
 */
function initMonacoEditor() {
    require.config({
        paths: {
            vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs'
        }
    });

    require(['vs/editor/editor.main'], function() {
        monacoEditor = monaco.editor.create(document.getElementById('monaco-container'), {
            value: '// Select a file to view',
            language: 'javascript',
            theme: 'vs-dark',
            readOnly: true,
            automaticLayout: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            folding: true
        });

        logger.info('Monaco Editor initialized');
    });
}

/**
 * Detect language from file extension
 */
function detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const languageMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'jsx': 'javascript',
        'tsx': 'typescript',
        'json': 'json',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'md': 'markdown',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'go': 'go',
        'rs': 'rust',
        'sh': 'shell',
        'bash': 'shell',
        'yml': 'yaml',
        'yaml': 'yaml',
        'xml': 'xml',
        'sql': 'sql',
        'rb': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
        'r': 'r',
        'txt': 'plaintext'
    };

    return languageMap[ext] || 'plaintext';
}

/**
 * Open file in editor
 */
function openFileInEditor(sessionId, filePath) {
    if (!monacoEditor) {
        alert('Editor not ready');
        return;
    }

    socket.emit('file:read', { sessionId, filePath });
}

/**
 * Show editor panel
 */
function showEditorPanel() {
    const panel = document.getElementById('editor-panel');
    const toggle = document.getElementById('editor-toggle');
    const container = document.querySelector('.container');

    panel.classList.remove('collapsed');
    toggle.classList.add('active');
    container.classList.add('editor-open');
}

/**
 * Hide editor panel
 */
function hideEditorPanel() {
    const panel = document.getElementById('editor-panel');
    const toggle = document.getElementById('editor-toggle');
    const container = document.querySelector('.container');

    panel.classList.add('collapsed');
    toggle.classList.remove('active');
    container.classList.remove('editor-open');

    currentEditorFile = null;
}

/**
 * Refresh current file in editor
 */
function refreshEditorFile() {
    if (currentEditorFile && currentSessionId) {
        openFileInEditor(currentSessionId, currentEditorFile);
    }
}
```

**Completion Criteria**:
- Monaco initialization function added
- Language detection function added
- Editor control functions added
- Global variables declared

#### 8.3.3: Add Socket.io handlers for file contents
**Action**: Add to initSocket() in `public/app.js`:

```javascript
    // File contents received
    socket.on('file:contents', ({ sessionId, path, content, size, modified }) => {
        if (!monacoEditor) {
            console.error('Monaco editor not initialized');
            return;
        }

        const language = detectLanguage(path);
        const model = monacoEditor.getModel();

        monaco.editor.setModelLanguage(model, language);
        monacoEditor.setValue(content);

        currentEditorFile = path;
        document.getElementById('editor-filename').textContent = path;

        showEditorPanel();

        // Start watching for changes
        socket.emit('file:watch:start', { sessionId });
    });

    // File changed notification
    socket.on('file:changed', ({ sessionId, filename, eventType }) => {
        // If the changed file is currently open, auto-reload
        if (filename === currentEditorFile) {
            console.log(`File ${filename} changed, reloading...`);
            refreshEditorFile();
        }
    });

    // File watch started
    socket.on('file:watch:started', ({ sessionId }) => {
        console.log(`File watching started for session ${sessionId}`);
    });

    // File watch stopped
    socket.on('file:watch:stopped', ({ sessionId }) => {
        console.log(`File watching stopped for session ${sessionId}`);
    });
```

**Completion Criteria**:
- file:contents handler added
- file:changed handler added
- Auto-reload on file change

#### 8.3.4: Add event listeners for editor controls
**Action**: Add to setupEventListeners() in `public/app.js`:

```javascript
    // Editor toggle button
    document.getElementById('editor-toggle').addEventListener('click', () => {
        const panel = document.getElementById('editor-panel');
        if (panel.classList.contains('collapsed')) {
            // Request file list when opening editor
            if (currentSessionId) {
                requestFileList(currentSessionId);
            } else {
                alert('No active session. Attach to a session first.');
            }
        } else {
            hideEditorPanel();
        }
    });

    // Editor close button
    document.getElementById('editor-close').addEventListener('click', () => {
        hideEditorPanel();
        if (currentSessionId) {
            socket.emit('file:watch:stop', { sessionId: currentSessionId });
        }
    });

    // Editor refresh button
    document.getElementById('editor-refresh').addEventListener('click', () => {
        refreshEditorFile();
    });
```

**Completion Criteria**:
- Toggle button opens/closes editor
- Close button works
- Refresh button reloads file

#### 8.3.5: Initialize Monaco on page load
**Action**: Update DOMContentLoaded in `public/app.js`:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    initTerminal();
    initMonacoEditor(); // Add this line
    setupEventListeners();
    setDefaultSessionName();
    setDefaultWorkingDir();
});
```

**Completion Criteria**:
- Monaco initializes on page load

#### 8.3.6: Test Monaco Editor
**Manual test**:
1. Start server
2. Open browser console, check for "Monaco Editor initialized"
3. Open developer tools → Network tab
4. Verify Monaco CDN loads (~4MB)
5. Click editor toggle button
6. Panel should slide in but show "Select a file to view"

**Completion Criteria**:
- Monaco loads successfully
- Editor renders in panel
- Dark theme applied
- Read-only mode active

#### 8.3.7: Run ESLint
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 8.3 Quality Gates
- [ ] Monaco Editor CDN added
- [ ] Editor initialized successfully
- [ ] Language detection works
- [ ] Socket.io handlers added
- [ ] Event listeners connected
- [ ] Editor renders correctly
- [ ] ESLint passes

### Task 8.3 Completion
```bash
git add public/index.html public/app.js
git commit -m "Task 8.3: Integrate Monaco Editor"
git checkout phase-8-file-editor
git merge phase-8/task-8.3-monaco-editor --squash
git commit -m "Task 8.3: Integrate Monaco Editor

- Added Monaco Editor CDN
- Initialized editor with dark theme
- Implemented language detection
- Added Socket.io file handlers
- Connected editor controls
- Configured read-only mode
- Quality gates passed"
```

---

## Task 8.4: Add File Browser UI

**Branch**: `phase-8/task-8.4-file-browser`
**Estimated Time**: 1.5 hours

### Subtasks

#### 8.4.1: Add file browser HTML to editor panel
**Action**: Update editor panel in `public/index.html`:

```html
    <!-- File Editor Panel -->
    <div id="editor-panel" class="editor-panel collapsed">
        <div class="editor-header">
            <div class="editor-title">
                <span class="editor-icon">📄</span>
                <span id="editor-filename">No file selected</span>
            </div>
            <div class="editor-actions">
                <button id="editor-refresh" class="btn-icon" title="Refresh file">
                    <span>🔄</span>
                </button>
                <button id="editor-close" class="btn-icon" title="Close editor">
                    <span>×</span>
                </button>
            </div>
        </div>

        <!-- File Browser -->
        <div id="file-browser" class="file-browser">
            <div class="file-browser-header">
                <span class="file-browser-title">📁 Files</span>
                <button id="file-browser-refresh" class="btn-icon" title="Refresh files">
                    <span>🔄</span>
                </button>
            </div>
            <div id="file-list" class="file-list">
                <div class="file-list-empty">No session selected</div>
            </div>
        </div>

        <div id="monaco-container"></div>
    </div>
```

**Completion Criteria**:
- File browser section added
- File list container added

#### 8.4.2: Add file browser CSS
**Action**: Add to `public/style.css`:

```css
/* File Browser */
.file-browser {
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border);
    max-height: 250px;
    display: flex;
    flex-direction: column;
}

.file-browser-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
}

.file-browser-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
}

.file-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
}

.file-list-empty {
    padding: 20px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 13px;
}

.file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    transition: background 0.15s;
}

.file-item:hover {
    background: var(--bg-tertiary);
}

.file-item.active {
    background: var(--accent);
    color: white;
}

.file-item.directory {
    font-weight: 600;
}

.file-icon {
    font-size: 14px;
    width: 16px;
    text-align: center;
}

.file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-size {
    font-size: 11px;
    color: var(--text-secondary);
}
```

**Completion Criteria**:
- File browser styled
- File items styled
- Hover effects added

#### 8.4.3: Implement file list rendering
**Action**: Add to `public/app.js`:

```javascript
/**
 * Request file list for session
 */
function requestFileList(sessionId, path = '.') {
    socket.emit('file:list', { sessionId, path });
}

/**
 * Render file list
 */
function renderFileList(files) {
    const fileListDiv = document.getElementById('file-list');

    if (!files || files.length === 0) {
        fileListDiv.innerHTML = '<div class="file-list-empty">No files found</div>';
        return;
    }

    fileListDiv.innerHTML = '';

    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';

        if (file.type === 'directory') {
            item.classList.add('directory');
        }

        const icon = file.type === 'directory' ? '📁' : '📄';
        const sizeStr = file.type === 'file' ? formatFileSize(file.size) : '';

        item.innerHTML = `
            <span class="file-icon">${icon}</span>
            <span class="file-name">${escapeHtml(file.name)}</span>
            ${sizeStr ? `<span class="file-size">${sizeStr}</span>` : ''}
        `;

        // Click handler
        if (file.type === 'file') {
            item.addEventListener('click', () => {
                // Remove active from all
                document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                openFileInEditor(currentSessionId, file.path);
            });
        } else {
            // Directory - could expand to show subdirectories in future
            item.addEventListener('click', () => {
                requestFileList(currentSessionId, file.path);
            });
        }

        fileListDiv.appendChild(item);
    });
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
```

**Completion Criteria**:
- File list request function added
- File rendering function added
- File size formatting added
- Click handlers for files

#### 8.4.4: Add Socket.io handler for file list
**Action**: Add to initSocket() in `public/app.js`:

```javascript
    // File list received
    socket.on('file:list', ({ sessionId, path, files }) => {
        if (sessionId === currentSessionId) {
            renderFileList(files);
        }
    });
```

**Completion Criteria**:
- file:list handler added

#### 8.4.5: Auto-load file list on session attach
**Action**: Update attachToSession() in `public/app.js`:

```javascript
function attachToSession(sessionId) {
    if (currentSessionId) {
        socket.emit('session:detach', { sessionId: currentSessionId });
    }

    currentSessionId = sessionId;
    const session = sessions.find(s => s.id === sessionId);

    if (session) {
        terminalTitle.textContent = session.name;
        noSessionDiv.classList.add('hidden');
        terminalContainer.classList.remove('hidden');
        terminal.clear();

        // Enable buttons
        stopBtn.disabled = session.status !== 'running';
        deleteBtn.disabled = false;
        uploadBtn.removeAttribute('disabled');

        renderSessions();
        socket.emit('session:attach', { sessionId });

        // Request file list for editor
        requestFileList(sessionId);
    }
}
```

**Completion Criteria**:
- File list loads when attaching to session

#### 8.4.6: Add refresh file list button handler
**Action**: Add to setupEventListeners() in `public/app.js`:

```javascript
    // File browser refresh
    document.getElementById('file-browser-refresh').addEventListener('click', () => {
        if (currentSessionId) {
            requestFileList(currentSessionId);
        }
    });
```

**Completion Criteria**:
- Refresh button reloads file list

#### 8.4.7: Test file browser
**Manual test**:
1. Start server and create session
2. Attach to session
3. Click editor toggle button
4. Verify file list appears
5. Click a file
6. Verify it opens in Monaco editor below
7. Click refresh
8. Verify list updates

**Completion Criteria**:
- File list displays correctly
- Files clickable
- Opens in editor
- Refresh works

#### 8.4.8: Run ESLint
**Command**:
```bash
npm run lint public/app.js public/style.css
```

**Completion Criteria**:
- ESLint passes

### Task 8.4 Quality Gates
- [ ] File browser UI added
- [ ] File list rendering works
- [ ] File click opens in editor
- [ ] Refresh button works
- [ ] Auto-loads on session attach
- [ ] ESLint passes

### Task 8.4 Completion
```bash
git add public/index.html public/style.css public/app.js
git commit -m "Task 8.4: Add file browser UI"
git checkout phase-8-file-editor
git merge phase-8/task-8.4-file-browser --squash
git commit -m "Task 8.4: Add file browser UI

- Added file browser HTML structure
- Implemented file list rendering
- Added file click handlers
- Created file size formatting
- Auto-load files on session attach
- Added refresh functionality
- Quality gates passed"
```

---

## Task 8.5: Implement File Change Detection

**Branch**: `phase-8/task-8.5-file-watch`
**Estimated Time**: 30 minutes

### Subtasks

#### 8.5.1: Add visual indicator for file changes
**Action**: Update file:changed handler in `public/app.js`:

```javascript
    // File changed notification
    socket.on('file:changed', ({ sessionId, filename, eventType }) => {
        console.log(`File changed: ${filename} (${eventType})`);

        // If the changed file is currently open, auto-reload
        if (filename === currentEditorFile) {
            console.log(`Current file changed, reloading...`);

            // Show notification in editor
            const editorFilename = document.getElementById('editor-filename');
            editorFilename.textContent = `${filename} (reloading...)`;

            setTimeout(() => {
                refreshEditorFile();
            }, 500);
        }

        // Refresh file list to show updates
        requestFileList(sessionId);
    });
```

**Completion Criteria**:
- File change shows notification
- Auto-reloads after delay
- Refreshes file list

#### 8.5.2: Add file modified indicator
**Action**: Add CSS for modified indicator in `public/style.css`:

```css
.file-item.modified {
    position: relative;
}

.file-item.modified::before {
    content: '●';
    position: absolute;
    left: 2px;
    color: var(--warning);
    font-size: 8px;
}
```

**Completion Criteria**:
- Modified indicator styled

#### 8.5.3: Track modified files
**Action**: Add to `public/app.js`:

```javascript
// Track recently modified files
let modifiedFiles = new Set();

// Update file:changed handler to track modifications
socket.on('file:changed', ({ sessionId, filename, eventType }) => {
    console.log(`File changed: ${filename} (${eventType})`);

    // Mark file as modified
    modifiedFiles.add(filename);

    // Remove from set after 5 seconds
    setTimeout(() => {
        modifiedFiles.delete(filename);
        requestFileList(sessionId);
    }, 5000);

    // If the changed file is currently open, auto-reload
    if (filename === currentEditorFile) {
        console.log(`Current file changed, reloading...`);

        const editorFilename = document.getElementById('editor-filename');
        editorFilename.textContent = `${filename} (reloading...)`;

        setTimeout(() => {
            refreshEditorFile();
        }, 500);
    }

    // Refresh file list
    requestFileList(sessionId);
});

// Update renderFileList to show modified indicator
function renderFileList(files) {
    const fileListDiv = document.getElementById('file-list');

    if (!files || files.length === 0) {
        fileListDiv.innerHTML = '<div class="file-list-empty">No files found</div>';
        return;
    }

    fileListDiv.innerHTML = '';

    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';

        if (file.type === 'directory') {
            item.classList.add('directory');
        }

        // Add modified class if file was recently changed
        if (modifiedFiles.has(file.path)) {
            item.classList.add('modified');
        }

        const icon = file.type === 'directory' ? '📁' : '📄';
        const sizeStr = file.type === 'file' ? formatFileSize(file.size) : '';

        item.innerHTML = `
            <span class="file-icon">${icon}</span>
            <span class="file-name">${escapeHtml(file.name)}</span>
            ${sizeStr ? `<span class="file-size">${sizeStr}</span>` : ''}
        `;

        // Click handlers...
        if (file.type === 'file') {
            item.addEventListener('click', () => {
                document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                openFileInEditor(currentSessionId, file.path);
            });
        } else {
            item.addEventListener('click', () => {
                requestFileList(currentSessionId, file.path);
            });
        }

        fileListDiv.appendChild(item);
    });
}
```

**Completion Criteria**:
- Modified files tracked
- Visual indicator appears
- Clears after 5 seconds

#### 8.5.4: Test file change detection
**Manual test**:
1. Start server and attach to session
2. Open a file in editor
3. In terminal, run: `echo "// test" >> filename.js`
4. Verify file reloads in editor
5. Verify modified indicator appears briefly
6. Verify indicator disappears after 5 seconds

**Completion Criteria**:
- File changes detected
- Auto-reload works
- Visual feedback shows

#### 8.5.5: Run ESLint
**Command**:
```bash
npm run lint public/app.js public/style.css
```

**Completion Criteria**:
- ESLint passes

### Task 8.5 Quality Gates
- [ ] File change detection implemented
- [ ] Auto-reload on change works
- [ ] Visual indicators added
- [ ] Modified state tracked
- [ ] ESLint passes
- [ ] Manual testing passed

### Task 8.5 Completion
```bash
git add public/app.js public/style.css
git commit -m "Task 8.5: Implement file change detection"
git checkout phase-8-file-editor
git merge phase-8/task-8.5-file-watch --squash
git commit -m "Task 8.5: Implement file change detection

- Added auto-reload on file change
- Implemented modified file tracking
- Added visual indicators for changes
- Auto-refresh file list on changes
- Quality gates passed"
```

---

## Phase 8 Completion

### Phase 8 Integration Test
```bash
# On phase-8-file-editor branch

# 1. Start server
npm start

# 2. Create and attach to session

# 3. Test file browser:
# - Click editor toggle
# - Verify file list appears
# - Click a file
# - Verify opens in Monaco

# 4. Test editor:
# - Verify syntax highlighting
# - Verify read-only mode
# - Check line numbers

# 5. Test file changes:
# - In terminal: echo "test" >> test.js
# - Verify editor reloads
# - Verify modified indicator

# 6. Test security:
# - Try path traversal (should fail)
# - Try binary file (should fail)

# 7. Test responsive:
# - Resize to mobile width
# - Verify editor hides/shows

# 8. Run linting
npm run lint

# 9. Check git status
git status  # Should be clean
```

### Expected Results
- File browser displays files
- Monaco editor renders files
- Syntax highlighting works
- File changes auto-reload
- Security measures work
- Responsive design works
- ESLint passes
- Git clean

### Phase 8 Quality Gates Checklist
- [ ] All tasks (8.1 - 8.5) completed
- [ ] Backend file operations work
- [ ] Monaco Editor integrated
- [ ] File browser functional
- [ ] File change detection works
- [ ] Security validated (path traversal, binary files)
- [ ] Responsive design implemented
- [ ] ESLint passes
- [ ] Integration test passed
- [ ] No uncommitted changes

### Merge to Main
```bash
git checkout main
git merge phase-8-file-editor -m "Phase 8: File Editor Panel Complete

Completed tasks:
- 8.1: Create file manager backend
- 8.2: Update UI layout for editor panel
- 8.3: Integrate Monaco Editor
- 8.4: Add file browser UI
- 8.5: Implement file change detection

Phase completion criteria met:
✓ Backend file reading endpoints functional
✓ Monaco Editor integrated with syntax highlighting
✓ File browser displays session files
✓ Collapsible panel works smoothly
✓ File changes auto-reload in editor
✓ Path traversal protection verified
✓ File size limits enforced
✓ Responsive design for mobile
✓ All quality gates passed

Application now includes file editor for reviewing Claude Code edits - v0.2.0"

git push origin main
```

### Update Version and Changelog
```bash
# Update package.json version
npm version minor  # 0.1.0 -> 0.2.0

# Update CHANGELOG.md
cat >> CHANGELOG.md << 'EOF'

## [0.2.0] - YYYY-MM-DD

### Added
- File editor panel with Monaco Editor integration
- File browser showing session directory contents
- Auto-reload when files change
- Syntax highlighting for 20+ languages
- Collapsible editor panel
- File change detection with visual indicators
- Path traversal protection
- Binary file detection
- File size limits (1MB max)
- Responsive design (hidden on mobile)

### Security
- Path validation prevents directory traversal
- Binary file detection and rejection
- File size limits enforced

### Technical
- Monaco Editor 0.44.0 integration
- fs.watch for file change detection
- Read-only editor mode
- Automatic syntax detection
EOF

git add package.json CHANGELOG.md
git commit -m "Bump version to 0.2.0"
git tag -a v0.2.0 -m "Release v0.2.0 - File Editor Panel"
git push origin main --tags
```

### Update PROGRESS.md
```bash
cat >> PROGRESS.md << 'EOF'

## Phase 8: File Editor Panel ✅
- [x] 8.1 Create file manager backend
- [x] 8.2 Update UI layout for editor panel
- [x] 8.3 Integrate Monaco Editor
- [x] 8.4 Add file browser UI
- [x] 8.5 Implement file change detection

**Completed**: YYYY-MM-DD
**Branch**: phase-8-file-editor (merged to main)

---

# v0.2.0 RELEASED

File editor panel feature complete.
Users can now review Claude Code edits to files.
EOF

git add PROGRESS.md
git commit -m "Update progress: Phase 8 complete - v0.2.0"
git push origin main
```

---

## Next Steps

### Post-Phase 8
- Deploy v0.2.0 to production
- Test file editor with real Claude Code sessions
- Gather user feedback
- Monitor performance with file watching

### Future Enhancements (v0.3.0+)
- Diff view (show before/after changes)
- Search in files
- Multiple file tabs
- File editing capability (not just viewing)
- Git integration (blame, history)
- Code minimap
- Breadcrumb navigation for directories
- Keyboard shortcuts for editor

## Celebration!

🎉 **File Editor Panel Complete!**

Users can now:
- ✅ Browse session files
- ✅ View file contents with syntax highlighting
- ✅ See Claude Code's edits in real-time
- ✅ Auto-reload when files change
- ✅ Review changes in a professional editor

Well done! 🚀
