# Phase 4: Frontend UI

**Branch**: `phase-4-frontend-ui`
**Duration**: ~8 hours
**Prerequisites**: Phase 3 completed

## Phase Objectives
- Implement complete HTML structure with modals
- Style application with VSCode-inspired dark theme
- Build session list with real-time updates
- Integrate xterm.js for terminal display
- Implement new session modal with form validation
- Connect all Socket.io client events
- Make UI responsive for mobile/tablet

## Phase Completion Criteria
- [ ] HTML structure complete with all elements
- [ ] CSS styling matches specification from issue #1
- [ ] Session list displays and updates in real-time
- [ ] Terminal renders correctly with xterm.js
- [ ] New session modal works with validation
- [ ] Socket.io client connects and handles all events
- [ ] UI responsive on desktop, tablet, mobile
- [ ] All user interactions functional
- [ ] ESLint passes on public/app.js
- [ ] All task branches merged to `phase-4-frontend-ui`
- [ ] Phase branch ready to merge to `main`

---

## Task 4.1: Create Complete HTML Structure

**Branch**: `phase-4/task-4.1-html-structure`
**Estimated Time**: 45 minutes

### Subtasks

#### 4.1.1: Replace public/index.html with full structure
**Action**: Replace `public/index.html` with complete HTML from issue #1 specification.

**Key elements to include**:
- Sidebar with session list
- Main area with terminal
- Terminal header with actions
- New session modal
- File upload button (hidden input)
- Drop overlay
- Upload progress indicator
- Socket.io and xterm.js CDN links

**Completion Criteria**:
- HTML matches issue #1 specification exactly
- All IDs and classes match
- CDN links correct:
  - socket.io-client@4.6.0
  - xterm@5.3.0
  - xterm-addon-fit@0.8.0
- Valid HTML5 (no errors)

#### 4.1.2: Validate HTML
**Commands**:
```bash
# Start server and open in browser
npm start
# Open http://localhost:3456

# Check browser console for errors
# Use browser DevTools to inspect structure
```

**Completion Criteria**:
- Page loads without errors
- All elements visible in DevTools
- No console errors
- CDN resources load successfully

### Task 4.1 Quality Gates
- [ ] HTML structure complete
- [ ] All elements have correct IDs
- [ ] CDN links load successfully
- [ ] Valid HTML5
- [ ] No console errors

### Task 4.1 Completion
```bash
git add public/index.html
git commit -m "Task 4.1: Create complete HTML structure"
git checkout phase-4-frontend-ui
git merge phase-4/task-4.1-html-structure --squash
git commit -m "Task 4.1: Create complete HTML structure

- Replaced placeholder HTML with full structure
- Added sidebar, terminal, modal elements
- Included CDN links for Socket.io and xterm.js
- Validated HTML structure
- Quality gates passed"
```

---

## Task 4.2: Implement Complete CSS Styling

**Branch**: `phase-4/task-4.2-css-styling`
**Estimated Time**: 1.5 hours

### Subtasks

#### 4.2.1: Replace public/style.css with complete styles
**Action**: Replace `public/style.css` with full CSS from issue #1 specification.

**Key sections to include**:
- CSS variables (VSCode dark theme colors)
- Reset and base styles
- Container layout (flexbox)
- Sidebar styling
- Session items with status badges
- Main area and terminal header
- Terminal container
- Buttons (primary, secondary, warning, danger, upload)
- Modal overlay and form
- File upload (drop zone, progress indicator)
- Responsive media queries for mobile
- Scrollbar customization

**Completion Criteria**:
- CSS matches issue #1 specification exactly
- All CSS variables defined
- Dark theme applied throughout
- Responsive breakpoints at 768px

#### 4.2.2: Test visual appearance
**Commands**:
```bash
npm start
# Open http://localhost:3456 in browser
```

**Manual checks**:
- [ ] Dark theme applied
- [ ] Sidebar visible on left
- [ ] Terminal area on right
- [ ] Buttons styled correctly
- [ ] Modal overlay styled (open with DevTools)
- [ ] Responsive: resize browser to mobile width
- [ ] Scrollbars custom styled

**Completion Criteria**:
- Visual appearance matches specification
- Colors match VSCode dark theme
- Responsive design works
- No CSS errors

### Task 4.2 Quality Gates
- [ ] CSS complete and matches spec
- [ ] Dark theme applied
- [ ] Responsive design works
- [ ] All UI elements styled
- [ ] Visual testing passed

### Task 4.2 Completion
```bash
git add public/style.css
git commit -m "Task 4.2: Implement complete CSS styling"
git checkout phase-4-frontend-ui
git merge phase-4/task-4.2-css-styling --squash
git commit -m "Task 4.2: Implement complete CSS styling

- Replaced placeholder CSS with full styles
- Applied VSCode dark theme colors
- Styled all UI components
- Implemented responsive design
- Customized scrollbars
- Quality gates passed"
```

---

## Task 4.3: Build Session List UI

**Branch**: `phase-4/task-4.3-session-list`
**Estimated Time**: 1 hour

### Subtasks

#### 4.3.1: Implement renderSessions() function
**Action**: Add to `public/app.js`:

**Key functionality**:
```javascript
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
```

**Completion Criteria**:
- renderSessions() creates DOM elements
- Displays session name, status, time, user
- Active session highlighted
- Click handler attached
- HTML escaped for security
- Empty state handled

#### 4.3.2: Test session list rendering
**Action**: Add mock data for testing:
```javascript
// Temporary mock data for testing
sessions = [
    {
        id: '1',
        name: 'Test Session 1',
        status: 'running',
        created_at: new Date(Date.now() - 300000).toISOString(),
        run_as_user: 'testuser'
    },
    {
        id: '2',
        name: 'Test Session 2',
        status: 'completed',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        run_as_user: 'anotheruser'
    }
];
renderSessions();
```

**Manual test**:
- Open browser
- Verify 2 sessions appear
- Check status badges have correct colors
- Verify time formatting
- Test click interaction
- Remove mock data after testing

**Completion Criteria**:
- Sessions render correctly
- Status badges colored
- Time formatted properly
- Click handler works
- Mock data removed

#### 4.3.3: Run ESLint on app.js
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 4.3 Quality Gates
- [ ] renderSessions() implemented
- [ ] Session items display correctly
- [ ] Status badges styled
- [ ] Time formatting works
- [ ] Click handlers attached
- [ ] ESLint passes

### Task 4.3 Completion
```bash
git add public/app.js
git commit -m "Task 4.3: Build session list UI"
git checkout phase-4-frontend-ui
git merge phase-4/task-4.3-session-list --squash
git commit -m "Task 4.3: Build session list UI

- Implemented renderSessions() function
- Added session item click handlers
- Created formatTime() helper
- Added HTML escaping for security
- Tested with mock data
- Quality gates passed"
```

---

## Task 4.4: Integrate xterm.js Terminal

**Branch**: `phase-4/task-4.4-xterm-integration`
**Estimated Time**: 1 hour

### Subtasks

#### 4.4.1: Implement initTerminal() function
**Action**: Add to `public/app.js`:

```javascript
function initTerminal() {
    terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'Courier New', Courier, monospace",
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
}
```

**Completion Criteria**:
- Terminal initialized with VSCode theme
- FitAddon loaded
- Terminal opened in DOM
- onData handler for input
- Window resize handler
- Theme colors match VSCode

#### 4.4.2: Test terminal rendering
**Action**: Add test code:
```javascript
// After initTerminal() call
terminal.write('Welcome to Claude Code Monitor\r\n');
terminal.write('Terminal initialized successfully\r\n');
terminal.write('$ ');
```

**Manual test**:
- Open browser
- Verify terminal appears in main area
- Check dark theme applied
- Type characters (should appear)
- Resize window (terminal should resize)
- Remove test code after verification

**Completion Criteria**:
- Terminal renders correctly
- Dark theme applied
- Input works
- Resize works
- Test code removed

#### 4.4.3: Run ESLint
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 4.4 Quality Gates
- [ ] initTerminal() implemented
- [ ] xterm.js loads from CDN
- [ ] Terminal renders with dark theme
- [ ] Input handler works
- [ ] Resize handler works
- [ ] ESLint passes

### Task 4.4 Completion
```bash
git add public/app.js
git commit -m "Task 4.4: Integrate xterm.js terminal"
git checkout phase-4-frontend-ui
git merge phase-4/task-4.4-xterm-integration --squash
git commit -m "Task 4.4: Integrate xterm.js terminal

- Implemented initTerminal() function
- Configured VSCode dark theme
- Added FitAddon for auto-resize
- Implemented input and resize handlers
- Tested terminal rendering
- Quality gates passed"
```

---

## Task 4.5: Create New Session Modal

**Branch**: `phase-4/task-4.5-new-session-modal`
**Estimated Time**: 1 hour

### Subtasks

#### 4.5.1: Implement modal open/close handlers
**Action**: Add to `public/app.js`:

```javascript
function openNewSessionModal() {
    setDefaultSessionName();
    setDefaultWorkingDir();
    modalOverlay.classList.remove('hidden');
    sessionNameInput.focus();
}

function closeNewSessionModal() {
    modalOverlay.classList.add('hidden');
    newSessionForm.reset();
}

function setDefaultSessionName() {
    const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    sessionNameInput.value = `Session ${timestamp}`;
}

function setDefaultWorkingDir() {
    workingDirInput.value = '/tmp';
}

// Event listeners in setupEventListeners()
newSessionBtn.addEventListener('click', openNewSessionModal);
cancelBtn.addEventListener('click', closeNewSessionModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeNewSessionModal();
    }
});
```

**Completion Criteria**:
- Modal opens/closes correctly
- Default session name generated
- Default working directory set
- Click outside modal closes it
- Cancel button closes modal

#### 4.5.2: Implement form submission
**Action**: Add to `public/app.js`:

```javascript
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

// In setupEventListeners()
newSessionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    createSession();
});
```

**Completion Criteria**:
- Form validation works
- Creates session via Socket.io
- Wraps command with claude-code
- Closes modal on submit
- Prevents default form action

#### 4.5.3: Test modal functionality
**Manual test**:
- Click "New Session" button
- Verify modal opens
- Check default values populated
- Submit without filling (should show alerts)
- Fill form and submit
- Verify modal closes
- Test ESC key to close
- Test click outside to close

**Completion Criteria**:
- All modal interactions work
- Validation prevents invalid submissions
- Form resets after close

#### 4.5.4: Run ESLint
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 4.5 Quality Gates
- [ ] Modal opens/closes correctly
- [ ] Form validation implemented
- [ ] Session creation emits correct event
- [ ] Default values set properly
- [ ] All interactions tested
- [ ] ESLint passes

### Task 4.5 Completion
```bash
git add public/app.js
git commit -m "Task 4.5: Create new session modal"
git checkout phase-4-frontend-ui
git merge phase-4/task-4.5-new-session-modal --squash
git commit -m "Task 4.5: Create new session modal

- Implemented modal open/close handlers
- Added form validation
- Created createSession() function
- Set default session name and directory
- Tested all modal interactions
- Quality gates passed"
```

---

## Task 4.6: Implement Socket.io Client Handlers

**Branch**: `phase-4/task-4.6-socketio-client`
**Estimated Time**: 2 hours

### Subtasks

#### 4.6.1: Implement initSocket() function
**Action**: Add complete Socket.io client setup to `public/app.js`.

**Key events to handle**:
- `connect` - Load sessions list, log connection
- `disconnect` - Log disconnection
- `terminal:output` - Write to xterm.js terminal
- `session:created` - Add to sessions array, attach to session
- `session:status` - Update session status in array and re-render
- `session:deleted` - Remove from array, detach if current
- `session:list` - Update sessions array, auto-attach to first running
- `error` - Show error to user

**Completion Criteria**:
- All Socket.io events handled
- Terminal output writes to xterm.js
- Session list updates in real-time
- Errors displayed to user

#### 4.6.2: Implement session management functions
**Action**: Add to `public/app.js`:

```javascript
function loadSessions() {
    socket.emit('session:list');
}

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

function stopSession() {
    if (!currentSessionId) return;

    if (confirm('Stop this session?')) {
        socket.emit('session:stop', { sessionId: currentSessionId });
    }
}

function deleteSession() {
    if (!currentSessionId) return;

    if (confirm('Delete this session? This cannot be undone.')) {
        socket.emit('session:delete', { sessionId: currentSessionId });
    }
}
```

**Completion Criteria**:
- attachToSession() switches sessions
- detachSession() clears current session
- stopSession() sends stop event
- deleteSession() sends delete event
- UI updates accordingly

#### 4.6.3: Add button event listeners
**Action**: Add to setupEventListeners():

```javascript
stopBtn.addEventListener('click', stopSession);
deleteBtn.addEventListener('click', deleteSession);
```

**Completion Criteria**:
- Stop button handler added
- Delete button handler added

#### 4.6.4: Test Socket.io integration (requires Phase 3 backend)
**Prerequisite**: Ensure Phase 3 backend is complete

**Manual test**:
1. Start server: `npm start`
2. Open browser: `http://localhost:3456`
3. Open browser console
4. Verify "Connected to server" logged
5. Create new session via modal
6. Verify session appears in list
7. Click session to attach
8. Type in terminal
9. Stop session
10. Delete session

**Completion Criteria**:
- Socket.io connects
- Sessions created/listed/attached
- Terminal I/O works
- Stop/delete work
- Real-time updates functional

#### 4.6.5: Run ESLint
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 4.6 Quality Gates
- [ ] initSocket() implemented
- [ ] All Socket.io events handled
- [ ] Session management functions work
- [ ] Button handlers added
- [ ] Integration tested with backend
- [ ] ESLint passes

### Task 4.6 Completion
```bash
git add public/app.js
git commit -m "Task 4.6: Implement Socket.io client handlers"
git checkout phase-4-frontend-ui
git merge phase-4/task-4.6-socketio-client --squash
git commit -m "Task 4.6: Implement Socket.io client handlers

- Implemented initSocket() with all events
- Created session management functions
- Added button event listeners
- Integrated with xterm.js for terminal I/O
- Tested full integration with backend
- Quality gates passed"
```

---

## Task 4.7: Add Responsive Design and Mobile Support

**Branch**: `phase-4/task-4.7-responsive-design`
**Estimated Time**: 45 minutes

### Subtasks

#### 4.7.1: Test responsive breakpoints
**Manual test**:
- Open browser developer tools
- Use responsive design mode
- Test at:
  - Desktop: 1920x1080
  - Tablet: 768x1024
  - Mobile: 375x667

**Check**:
- [ ] Sidebar switches to full width below 768px
- [ ] Terminal remains usable on mobile
- [ ] Buttons have min-width/height (44px touch target)
- [ ] Modal centered on all sizes
- [ ] Text readable without zoom
- [ ] No horizontal scroll

**Completion Criteria**:
- Responsive design works on all tested sizes
- Touch targets large enough (44px minimum)
- No usability issues on mobile

#### 4.7.2: Test on actual mobile device (optional but recommended)
**If available**:
- Access server via Tailscale IP
- Test on iOS/Android device
- Verify touch interactions
- Check terminal keyboard

**Completion Criteria**:
- Works on actual device (if tested)
- Or manual testing passed

#### 4.7.3: Add mobile-specific improvements
**Action**: Add to `public/app.js`:

```javascript
// Prevent zoom on double-tap for better mobile UX
document.addEventListener('dblclick', (e) => {
    e.preventDefault();
}, { passive: false });

// Add touch feedback for buttons (optional enhancement)
document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('touchstart', () => {
        btn.style.opacity = '0.7';
    });
    btn.addEventListener('touchend', () => {
        btn.style.opacity = '1';
    });
});
```

**Completion Criteria**:
- Mobile improvements added
- Touch interactions enhanced

### Task 4.7 Quality Gates
- [ ] Responsive design tested at multiple sizes
- [ ] Mobile layout works correctly
- [ ] Touch targets adequate
- [ ] No usability issues
- [ ] ESLint passes

### Task 4.7 Completion
```bash
git add public/app.js public/style.css
git commit -m "Task 4.7: Add responsive design and mobile support"
git checkout phase-4-frontend-ui
git merge phase-4/task-4.7-responsive-design --squash
git commit -m "Task 4.7: Add responsive design and mobile support

- Tested responsive breakpoints
- Verified mobile layout
- Added touch interaction improvements
- Ensured 44px minimum touch targets
- Quality gates passed"
```

---

## Phase 4 Completion

### Phase 4 Integration Test
```bash
# On phase-4-frontend-ui branch

# 1. Start server (with Phase 3 backend)
npm start

# 2. Open browser
open http://localhost:3456

# 3. Test complete workflow:
# - Page loads with styled UI
# - Click "New Session"
# - Fill form and create session
# - Session appears in sidebar
# - Click session to attach
# - Terminal shows output
# - Type commands in terminal
# - Test stop button
# - Test delete button
# - Create multiple sessions
# - Switch between sessions

# 4. Test responsive
# - Resize browser to mobile width
# - Verify layout adapts

# 5. Run linting
npm run lint

# 6. Check git status
git status  # Should be clean
```

### Expected Results
- Complete UI functional
- All interactions work
- Terminal I/O operational
- Session management works
- Responsive design functional
- ESLint passes
- Git working directory clean

### Phase 4 Quality Gates Checklist
- [ ] All tasks (4.1 - 4.7) completed
- [ ] HTML structure complete
- [ ] CSS styling matches specification
- [ ] Session list displays and updates
- [ ] xterm.js terminal works
- [ ] New session modal functional
- [ ] Socket.io client integrated
- [ ] Responsive design works
- [ ] ESLint passes
- [ ] Integration test passed
- [ ] No uncommitted changes

### Merge to Main
```bash
git checkout main
git merge phase-4-frontend-ui -m "Phase 4: Frontend UI Complete

Completed tasks:
- 4.1: Create complete HTML structure
- 4.2: Implement complete CSS styling
- 4.3: Build session list UI
- 4.4: Integrate xterm.js terminal
- 4.5: Create new session modal
- 4.6: Implement Socket.io client handlers
- 4.7: Add responsive design and mobile support

Phase completion criteria met:
✓ HTML structure complete
✓ CSS styling matches VSCode theme
✓ Session list displays and updates
✓ Terminal renders with xterm.js
✓ New session modal works
✓ Socket.io client fully functional
✓ Responsive design for mobile/tablet
✓ All quality gates passed

Ready for Phase 5: File Upload System"

git push origin main
```

### Update PROGRESS.md
```bash
git checkout main
# Mark Phase 4 complete, prepare Phase 5
# Commit and push
```

---

## Next Steps

After Phase 4 completion:
1. Create Phase 5 branch: `git checkout -b phase-5-file-upload`
2. Read [phase-5.md](phase-5.md) for file upload implementation
3. Execute Task 5.1 to begin file upload system
