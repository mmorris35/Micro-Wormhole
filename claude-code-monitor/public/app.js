'use strict';

/* global Terminal, FitAddon, io, monaco */

// ===== State Variables =====
let socket = null;
let terminal = null;
let fitAddon = null;
let currentSessionId = null;
let sessions = [];

// Monaco Editor
let monacoEditor = null;
let currentEditorFile = null;

// Track recently modified files
let modifiedFiles = new Set();

// ===== Claude Code Session State =====
let claudeSessions = [];
let currentClaudeSessionId = null;
let claudeConversation = [];
let currentSessionType = 'pty'; // 'pty' or 'claude'

// ===== DOM Elements =====
const sessionList = document.getElementById('session-list');
const terminalContainer = document.getElementById('terminal-container');
const noSessionDiv = document.getElementById('no-session');
const terminalTitle = document.getElementById('terminal-title');

// Modal elements
const modalOverlay = document.getElementById('modal-overlay');
const newSessionBtn = document.getElementById('new-session-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const cancelBtn = document.getElementById('cancel-btn');
const newSessionForm = document.getElementById('new-session-form');
const sessionNameInput = document.getElementById('session-name');
const workingDirInput = document.getElementById('working-dir');
const runAsUserSelect = document.getElementById('run-as-user');

// Button elements
const stopBtn = document.getElementById('stop-btn');
const deleteBtn = document.getElementById('delete-btn');
const uploadBtn = document.getElementById('upload-btn');

// File upload elements
const fileInput = document.getElementById('file-input');
const dropOverlay = document.getElementById('drop-overlay');
const uploadProgress = document.getElementById('upload-progress');
const uploadProgressFill = document.getElementById('upload-progress-fill');
const uploadProgressText = document.getElementById('upload-progress-text');

// ===== Helper Functions =====

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - The text to escape
 * @returns {string} - The escaped HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formats timestamp into relative time or date
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} - Formatted time string
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
}

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

    // Store sessions for later use
    claudeSessions = Object.values(sessionsData).flat();
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

    // Show input box
    window.showClaudeInput();

    // PTY will auto-initialize on first message send
}

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

/**
 * Extract file path from tool call input
 */
function extractFilePath(toolBlock) {
    const input = toolBlock.input || {};
    return input.file_path || input.path || null;
}

/**
 * Open file from conversation in Monaco Editor
 * Called from inline onclick in HTML (renderMessageContent)
 */
// eslint-disable-next-line no-unused-vars
function openFileFromConversation(filePath) {
    if (!currentClaudeSessionId) return;

    const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
    if (!session) return;

    // Use repo path as working directory
    const workingDir = session.repoPath;

    // Open file in Monaco Editor
    openFileInMonaco(filePath, workingDir);
}

/**
 * Open file in Monaco Editor with direct path
 */
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

// ===== Session List Rendering =====

/**
 * Renders the session list in the sidebar
 */
function renderSessions() {
    sessionList.innerHTML = '';

    if (sessions.length === 0) {
        sessionList.innerHTML = '<p style="padding:12px;color:#808080">No sessions yet</p>';
        return;
    }

    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        if (session.id === currentSessionId) {
            item.className += ' active';
        }

        item.innerHTML = `
            <div class="session-item-header">
                <span class="session-name">${escapeHtml(session.name)}</span>
                <span class="session-status status-${session.status}">${session.status}</span>
            </div>
            <div class="session-time">${formatTime(session.created_at)}</div>
            <div class="session-user">@${escapeHtml(session.run_as_user)}</div>
        `;

        item.addEventListener('click', () => {
            if (currentSessionId !== session.id) {
                attachToSession(session.id);
            }
        });

        sessionList.appendChild(item);
    });
}

// ===== Monaco Editor Integration =====

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

        console.log('Monaco Editor initialized');
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

    socket.emit('file:read', { sessionId, path: filePath });
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

// ===== Terminal Integration =====

/**
 * Initializes the xterm.js terminal with VSCode theme
 */
function initTerminal() {
    terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '\'Courier New\', Courier, monospace',
        theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
            cursorAccent: '#1e1e1e',
            selection: 'rgba(255, 255, 255, 0.3)',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#ffffff'
        }
    });

    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(document.getElementById('terminal'));
    fitAddon.fit();

    // Handle terminal input
    terminal.onData(data => {
        if (currentSessionId) {
            socket.emit('terminal:input', { sessionId: currentSessionId, data });
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (terminal && fitAddon) {
            fitAddon.fit();
            if (currentSessionId) {
                socket.emit('terminal:resize', {
                    sessionId: currentSessionId,
                    cols: terminal.cols,
                    rows: terminal.rows
                });
            }
        }
    });

    console.log('Claude Code Monitor - Terminal initialized');
}

// ===== Modal Management =====

/**
 * Opens the new session modal with default values
 */
function openNewSessionModal() {
    setDefaultSessionName();
    setDefaultWorkingDir();
    loadAvailableUsers();  // Refresh users list
    modalOverlay.classList.remove('hidden');
    sessionNameInput.focus();
}

/**
 * Closes the new session modal and resets form
 */
function closeNewSessionModal() {
    modalOverlay.classList.add('hidden');
    newSessionForm.reset();
}

/**
 * Sets default session name with timestamp
 */
function setDefaultSessionName() {
    const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    sessionNameInput.value = `Session ${timestamp}`;
}

/**
 * Sets default working directory
 */
function setDefaultWorkingDir() {
    workingDirInput.value = '/tmp';
}

/**
 * Populates the user select dropdown with available system users
 */
function populateUserSelect(users) {
    runAsUserSelect.innerHTML = '<option value="">Select user...</option>';

    if (users.length === 0) {
        runAsUserSelect.innerHTML = '<option value="">No users available</option>';
        runAsUserSelect.disabled = true;
        return;
    }

    runAsUserSelect.disabled = false;

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        runAsUserSelect.appendChild(option);
    });

    // Select first user by default if available
    if (users.length > 0) {
        runAsUserSelect.value = users[0];
        updateWorkingDirForUser(users[0]);
    }
}

/**
 * Updates working directory based on selected user
 */
function updateWorkingDirForUser(username) {
    if (!username) {
        workingDirInput.value = '/tmp';
        return;
    }

    // Set to user's home directory
    workingDirInput.value = `/home/${username}`;
}

/**
 * Loads available users from server
 */
function loadAvailableUsers() {
    socket.emit('users:list');
}

/**
 * Creates a new session via Socket.io
 */
function createSession() {
    const name = sessionNameInput.value.trim();
    const command = document.getElementById('session-command').value.trim();
    const workingDirectory = workingDirInput.value.trim();
    const runAsUser = runAsUserSelect.value;

    // Validation
    if (!name) {
        alert('Please enter a session name');
        return;
    }
    if (!command) {
        alert('Please enter a Claude Code task');
        return;
    }
    if (!workingDirectory) {
        alert('Please enter a working directory');
        return;
    }
    if (!runAsUser) {
        alert('Please select a user');
        return;
    }

    // Emit session:create event
    socket.emit('session:create', {
        name,
        command: `claude-code "${command}"`,
        workingDirectory,
        runAsUser
    });

    closeNewSessionModal();
}

// ===== Session Management =====

/**
 * Loads all sessions from the server
 */
function loadSessions() {
    socket.emit('session:list');
}

/**
 * Attaches to a specific session
 * @param {string} sessionId - The session ID to attach to
 */
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
        document.getElementById('paste-trigger')?.removeAttribute('disabled');

        // Hide Claude input (this is a PTY session, not Claude)
        window.hideClaudeInput();

        renderSessions();
        socket.emit('session:attach', { sessionId });

        // Request file list for editor
        requestFileList(sessionId);
    }
}

/**
 * Detaches from the current session
 */
function detachSession() {
    if (currentSessionId) {
        socket.emit('session:detach', { sessionId: currentSessionId });
    }

    currentSessionId = null;
    terminalTitle.textContent = 'No session selected';
    terminalContainer.classList.add('hidden');
    noSessionDiv.classList.remove('hidden');

    // Disable buttons
    stopBtn.disabled = true;
    deleteBtn.disabled = true;
    uploadBtn.setAttribute('disabled', 'disabled');
    document.getElementById('paste-trigger')?.setAttribute('disabled', 'disabled');

    renderSessions();
}

/**
 * Stops the current session
 */
function stopSession() {
    if (!currentSessionId) return;

    if (confirm('Stop this session?')) {
        socket.emit('session:stop', { sessionId: currentSessionId });
    }
}

/**
 * Deletes the current session
 */
function deleteSession() {
    if (!currentSessionId) return;

    if (confirm('Delete this session? This cannot be undone.')) {
        socket.emit('session:delete', { sessionId: currentSessionId });
    }
}

// ===== File Upload Functions =====

/**
 * Uploads multiple files to the current session
 * @param {File[]} files - Array of files to upload
 */
async function uploadFiles(files) {
    if (!currentSessionId) {
        alert('No active session selected');
        return;
    }

    if (files.length === 0) {
        return;
    }

    // Validate file sizes
    const maxSize = 104857600; // 100MB
    const oversized = files.filter(f => f.size > maxSize);

    if (oversized.length > 0) {
        alert(`The following files exceed 100MB limit:\n${oversized.map(f => f.name).join('\n')}`);
        return;
    }

    // Validate total upload size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > maxSize * 5) { // Max 500MB total
        alert('Total upload size exceeds limit (500MB)');
        return;
    }

    // Show progress
    uploadProgress.classList.remove('hidden');
    uploadProgressFill.style.width = '0%';

    let completed = 0;
    const total = files.length;

    for (const file of files) {
        uploadProgressText.textContent = `Uploading ${file.name} (${completed + 1}/${total})...`;

        try {
            await uploadFile(file);
            completed++;

            // Update progress
            const percent = Math.round((completed / total) * 100);
            uploadProgressFill.style.width = percent + '%';

        } catch (error) {
            console.error('Upload failed:', error);
            uploadProgressText.textContent = `Failed: ${file.name}`;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Show completion
    uploadProgressText.textContent = `Uploaded ${completed}/${total} file(s) successfully`;

    // Hide progress after delay
    setTimeout(() => {
        uploadProgress.classList.add('hidden');
        uploadProgressFill.style.width = '0%';
    }, 2000);
}

/**
 * Uploads a single file to the current session
 * @param {File} file - File to upload
 * @returns {Promise<Object>} - Upload response
 */
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    let response;
    try {
        response = await fetch(`/api/upload/${currentSessionId}`, {
            method: 'POST',
            body: formData
        });
    } catch (error) {
        throw new Error(`Network error: ${error.message}`);
    }

    if (!response.ok) {
        let errorMsg = 'Upload failed';
        try {
            const error = await response.json();
            errorMsg = error.error || errorMsg;
        } catch (e) {
            errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
    }

    return await response.json();
}

// ===== Socket.io Client =====

/**
 * Initializes Socket.io connection and event handlers
 */
function initSocket() {
    socket = io();

    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');
        loadSessions();
        loadAvailableUsers();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    // Users list event
    socket.on('users:list', (data) => {
        const users = data.users || [];
        populateUserSelect(users);
    });

    // Session list event
    socket.on('session:list', (data) => {
        sessions = data.sessions || [];
        renderSessions();

        // Auto-attach to first running session if none selected
        if (!currentSessionId && sessions.length > 0) {
            const runningSession = sessions.find(s => s.status === 'running');
            if (runningSession) {
                attachToSession(runningSession.id);
            }
        }
    });

    // Session created event
    socket.on('session:created', (data) => {
        sessions.push(data.session);
        renderSessions();
        attachToSession(data.session.id);
    });

    // Session status update event
    socket.on('session:status', (data) => {
        const session = sessions.find(s => s.id === data.sessionId);
        if (session) {
            session.status = data.status;
            renderSessions();

            // Update buttons if this is the current session
            if (data.sessionId === currentSessionId) {
                stopBtn.disabled = data.status !== 'running';
            }
        }
    });

    // Session deleted event
    socket.on('session:deleted', (data) => {
        sessions = sessions.filter(s => s.id !== data.sessionId);
        renderSessions();

        // Detach if this was the current session
        if (data.sessionId === currentSessionId) {
            detachSession();
        }
    });

    // Session attached event
    socket.on('session:attached', (data) => {
        // Write buffered output to terminal
        if (data.buffer && data.buffer.length > 0) {
            data.buffer.forEach(line => {
                terminal.write(line);
            });
        }
    });

    // Terminal output event
    socket.on('terminal:output', (data) => {
        if (data.sessionId === currentSessionId) {
            terminal.write(data.data);
        }
    });

    // File list received
    socket.on('file:list', ({ sessionId, files }) => {
        if (sessionId === currentSessionId) {
            renderFileList(files);
        }
    });

    // File contents received
    socket.on('file:contents', ({ sessionId, path, content }) => {
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
        console.log(`File changed: ${filename} (${eventType})`);

        // Mark file as modified
        modifiedFiles.add(filename);

        // Remove from set after 5 seconds
        setTimeout(() => {
            modifiedFiles.delete(filename);
            if (sessionId === currentSessionId) {
                requestFileList(sessionId);
            }
        }, 5000);

        // If the changed file is currently open, auto-reload
        if (filename === currentEditorFile) {
            console.log('Current file changed, reloading...');

            // Show notification in editor
            const editorFilename = document.getElementById('editor-filename');
            editorFilename.textContent = `${filename} (reloading...)`;

            setTimeout(() => {
                refreshEditorFile();
            }, 500);
        }

        // Refresh file list
        if (sessionId === currentSessionId) {
            requestFileList(sessionId);
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

    // ===== Claude Code Session Events =====

    // Claude sessions list by repo
    socket.on('claude:sessions:by-repo', ({ byRepo }) => {
        renderClaudeSessions(byRepo);
    });

    // Claude conversation read
    socket.on('claude:conversation:read', ({ sessionId, messages, total, hasMore }) => {
        if (sessionId !== currentClaudeSessionId) return;

        claudeConversation = messages;
        renderClaudeConversation(messages);
    });

    // Claude session updated
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

    // Error event
    socket.on('error', (data) => {
        console.error('Socket.io error:', data.message);
        alert(`Error: ${data.message}`);
    });

    console.log('Socket.io client initialized');
}

// ===== Event Listeners Setup =====

/**
 * Sets up all event listeners for the application
 */
function setupEventListeners() {
    // New session modal
    newSessionBtn.addEventListener('click', openNewSessionModal);
    cancelBtn.addEventListener('click', closeNewSessionModal);
    modalCloseBtn.addEventListener('click', closeNewSessionModal);

    // Close modal when clicking outside
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeNewSessionModal();
        }
    });

    // Form submission
    newSessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createSession();
    });

    // User selection change
    runAsUserSelect.addEventListener('change', (e) => {
        updateWorkingDirForUser(e.target.value);
    });

    // Session action buttons
    stopBtn.addEventListener('click', stopSession);
    deleteBtn.addEventListener('click', deleteSession);

    // Session type tabs
    document.getElementById('tab-pty-sessions').addEventListener('click', () => {
        switchSessionTab('pty');
    });

    document.getElementById('tab-claude-sessions').addEventListener('click', () => {
        switchSessionTab('claude');
    });

    // File upload button
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0 && currentSessionId) {
            const files = Array.from(e.target.files);
            uploadFiles(files);
        }
        fileInput.value = ''; // Reset input to allow same file again
    });

    // Drag and drop
    terminalContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (currentSessionId) {
            dropOverlay.classList.remove('hidden');
        }
    });

    terminalContainer.addEventListener('dragleave', (e) => {
        if (e.target === terminalContainer) {
            dropOverlay.classList.add('hidden');
        }
    });

    terminalContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('hidden');

        if (currentSessionId && e.dataTransfer.files.length > 0) {
            uploadFiles(Array.from(e.dataTransfer.files));
        }
    });

    // Paste handler for iOS and desktop
    document.addEventListener('paste', async (e) => {
        if (!currentSessionId) return;

        const items = e.clipboardData.items;
        const files = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Handle files
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }

        if (files.length > 0) {
            e.preventDefault();
            uploadFiles(files);
        }
    });

    // Editor toggle button
    document.getElementById('editor-toggle').addEventListener('click', () => {
        const panel = document.getElementById('editor-panel');
        if (panel.classList.contains('collapsed')) {
            // Request file list when opening editor
            if (currentSessionId) {
                // For now, just show the panel - file browser in next task
                showEditorPanel();
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

    // File browser refresh
    document.getElementById('file-browser-refresh').addEventListener('click', () => {
        if (currentSessionId) {
            requestFileList(currentSessionId);
        }
    });
}

// ===== Initialization =====

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Initialize terminal on page load
    initTerminal();

    // Initialize Monaco Editor
    initMonacoEditor();

    // Initialize Socket.io
    initSocket();

    // Setup event listeners
    setupEventListeners();

    // ===== iOS-Specific Paste Support =====

    // iOS Safari specific paste handling
    // iOS requires input element to receive paste
    const pasteInput = document.createElement('textarea');
    pasteInput.style.position = 'absolute';
    pasteInput.style.left = '-9999px';
    pasteInput.style.opacity = '0';
    pasteInput.setAttribute('aria-hidden', 'true');
    document.body.appendChild(pasteInput);

    // Focus paste input when needed (e.g., on button click)
    document.getElementById('paste-trigger')?.addEventListener('click', () => {
        pasteInput.focus();
    });

    // Handle paste in hidden input
    pasteInput.addEventListener('paste', async (e) => {
        if (!currentSessionId) return;

        const items = e.clipboardData.items;
        const files = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }

        if (files.length > 0) {
            e.preventDefault();
            uploadFiles(files);
            // Return focus to terminal
            terminal.focus();
        }
    });

    // ===== Mobile-Specific Enhancements =====

    // Prevent zoom on double-tap for better mobile UX
    document.addEventListener('dblclick', (e) => {
        e.preventDefault();
    }, { passive: false });

    // Add touch feedback for buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('touchstart', () => {
            btn.style.opacity = '0.7';
        });
        btn.addEventListener('touchend', () => {
            btn.style.opacity = '1';
        });
    });

    // ===== Claude PTY Message Injection =====

    let attachedFile = null;
    let ptyReady = false;

    function setupClaudeInput() {
        const inputForm = document.getElementById('claude-input-form');
        const messageInput = document.getElementById('claude-message-input');
        const attachFileBtn = document.getElementById('attach-file-btn');

        if (!inputForm || !messageInput || !attachFileBtn) {
            return; // Elements not in DOM yet
        }

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
        if (!statusDiv) return;

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
        if (!attachedFileDiv) return;

        attachedFileDiv.classList.remove('hidden');
        attachedFileDiv.innerHTML = `
            <span>📎 ${escapeHtml(filePath)}</span>
            <span class="remove-file" onclick="removeAttachedFile()">×</span>
        `;
    }

    window.removeAttachedFile = function() {
        attachedFile = null;
        const attachedFileDiv = document.getElementById('attached-file');
        if (attachedFileDiv) {
            attachedFileDiv.classList.add('hidden');
        }
    };

    function showTypingIndicator() {
        const container = document.getElementById('conversation-container');
        if (!container) return;

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

    window.showClaudeInput = function() {
        const inputContainer = document.getElementById('claude-input-container');
        if (!inputContainer) return;

        inputContainer.classList.remove('hidden');

        const session = claudeSessions.find(s => s.id === currentClaudeSessionId);
        if (session && !session.isActive) {
            inputContainer.classList.add('disabled');
        } else {
            inputContainer.classList.remove('disabled');
            ptyReady = false; // Will be set to true when PTY initializes
        }
    };

    window.hideClaudeInput = function() {
        const inputContainer = document.getElementById('claude-input-container');
        if (inputContainer) {
            inputContainer.classList.add('hidden');
        }
    };

    // Socket.io handlers for PTY injection

    socket.on('claude:pty:ready', ({ sessionId }) => {
        if (sessionId === currentClaudeSessionId) {
            ptyReady = true;
            setPtyStatus('PTY ready - you can send messages', 'ready');
            console.log(`Claude PTY ready for session ${sessionId}`);
        }
    });

    socket.on('claude:message:sent', ({ sessionId }) => {
        if (sessionId === currentClaudeSessionId) {
            // Clear input
            const messageInput = document.getElementById('claude-message-input');
            if (messageInput) {
                messageInput.value = '';
                messageInput.disabled = false;
                messageInput.placeholder = 'Type your message to Claude...';
            }

            // Remove attachment
            window.removeAttachedFile();

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
            if (container) {
                const msgDiv = document.createElement('div');
                msgDiv.className = `conversation-message ${message.type}`;

                if (message.type === 'assistant') {
                    msgDiv.innerHTML = `
                        <div class="message-header">
                            <span class="message-role">🤖 Claude</span>
                            <span class="message-time">${formatTime(message.timestamp)}</span>
                        </div>
                        <div class="message-content">${renderMessageContent(message.content)}</div>
                    `;
                }

                container.appendChild(msgDiv);
                container.scrollTop = container.scrollHeight;
            }

            // Show notification
            showNotification('Claude responded!', 'info');

            console.log(`Claude response received for session ${sessionId}`);
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
            console.warn(`Claude PTY closed for session ${sessionId}, exit code: ${exitCode}`);
        }
    });

    // Initialize Claude input
    setupClaudeInput();

    console.log('Claude Code Monitor - Frontend initialized');
});
