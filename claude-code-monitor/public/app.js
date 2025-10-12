'use strict';

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
                // attachToSession will be implemented in Task 4.6
                console.log('Attach to session:', session.id);
            }
        });

        sessionList.appendChild(item);
    });
}

console.log('Claude Code Monitor - Session list UI loaded');
