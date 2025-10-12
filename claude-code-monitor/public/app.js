'use strict';

/* global Terminal, FitAddon, io */

// ===== State Variables =====
let socket = null;
let terminal = null;
let fitAddon = null;
let currentSessionId = null;
let sessions = [];

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

        renderSessions();
        socket.emit('session:attach', { sessionId });
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
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
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

    // Session action buttons
    stopBtn.addEventListener('click', stopSession);
    deleteBtn.addEventListener('click', deleteSession);
}

// ===== Initialization =====

// Initialize terminal on page load
initTerminal();

// Initialize Socket.io
initSocket();

// Setup event listeners
setupEventListeners();

console.log('Claude Code Monitor - Frontend initialized');
