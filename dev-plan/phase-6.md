# Phase 6: Multi-User Support & Security

**Branch**: `phase-6-multi-user`
**Duration**: ~6 hours
**Prerequisites**: Phase 5 completed

## Phase Objectives
- Enumerate system users from /etc/passwd
- Add user selection to frontend modal
- Update PTY manager to spawn processes as specified user using sudo
- Update file copy to use sudo for ownership
- Create comprehensive sudo configuration guide
- Add user validation before session creation
- Implement security best practices
- Test multi-user functionality

## Phase Completion Criteria
- [ ] System users enumerated correctly (only /home/* users)
- [ ] User dropdown populated in new session modal
- [ ] PTY processes spawn as specified user via sudo
- [ ] File uploads copied with correct user ownership
- [ ] User validation prevents invalid users
- [ ] Sudo configuration documented in SUDO_SETUP.md
- [ ] Security checks implemented
- [ ] Multi-user tested with multiple actual users
- [ ] All task branches merged to `phase-6-multi-user`
- [ ] Phase branch ready to merge to `main`

---

## Task 6.1: Implement User Enumeration

**Branch**: `phase-6/task-6.1-user-enumeration`
**Estimated Time**: 1 hour

### Subtasks

#### 6.1.1: Create user enumeration utility
**Action**: Create `lib/users.js`:

```javascript
'use strict';

const fs = require('fs');
const logger = require('./logger');

/**
 * Get list of system users with home directories in /home
 */
function getSystemUsers() {
    try {
        const passwdContent = fs.readFileSync('/etc/passwd', 'utf8');
        const lines = passwdContent.split('\n');
        const users = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            const parts = line.split(':');
            if (parts.length < 7) continue;

            const username = parts[0];
            const homeDir = parts[5];

            // Filter to users with home directories in /home
            // Exclude system users like nobody, daemon, etc.
            if (homeDir.startsWith('/home/')) {
                users.push({
                    username: username,
                    homeDir: homeDir
                });
            }
        }

        logger.info(`Found ${users.length} system users`);
        return users;
    } catch (error) {
        logger.error('Failed to read /etc/passwd:', error);
        return [];
    }
}

/**
 * Validate that a user exists on the system
 */
function validateUser(username) {
    const users = getSystemUsers();
    return users.some(u => u.username === username);
}

/**
 * Get home directory for a user
 */
function getUserHomeDir(username) {
    const users = getSystemUsers();
    const user = users.find(u => u.username === username);
    return user ? user.homeDir : null;
}

module.exports = {
    getSystemUsers,
    validateUser,
    getUserHomeDir
};
```

**Completion Criteria**:
- lib/users.js created
- Reads /etc/passwd
- Filters to /home/* users only
- Validates user existence
- Gets user home directory

#### 6.1.2: Add Socket.io event for users:list
**Action**: Update Socket.io handlers in `server.js`:

```javascript
// Import at top
const usersUtil = require('./lib/users');

// In io.on('connection', ...) handler:

    // Get available users
    socket.on('users:list', () => {
        try {
            const users = usersUtil.getSystemUsers();
            const usernames = users.map(u => u.username);
            socket.emit('users:list', { users: usernames });
        } catch (error) {
            logger.error('Failed to get users list:', error);
            socket.emit('error', { message: 'Failed to get users list' });
        }
    });
```

**Completion Criteria**:
- users:list event handler added
- Returns array of usernames
- Error handling included

#### 6.1.3: Test user enumeration
**Action**: Create `test-users.js`:

```javascript
'use strict';

const usersUtil = require('./lib/users');
const logger = require('./lib/logger');

logger.info('Testing user enumeration...\n');

// Test 1: Get all users
const users = usersUtil.getSystemUsers();
logger.info(`Found ${users.length} users:`);
users.forEach(u => {
    logger.info(`  - ${u.username} (${u.homeDir})`);
});

// Test 2: Validate existing user
const currentUser = process.env.USER;
logger.info(`\nValidating current user: ${currentUser}`);
const isValid = usersUtil.validateUser(currentUser);
logger.info(`Valid: ${isValid}`);

// Test 3: Validate non-existent user
logger.info('\nValidating fake user: nonexistentuser123');
const isInvalid = usersUtil.validateUser('nonexistentuser123');
logger.info(`Valid: ${isInvalid} (should be false)`);

// Test 4: Get home directory
logger.info(`\nHome directory for ${currentUser}:`);
const homeDir = usersUtil.getUserHomeDir(currentUser);
logger.info(homeDir);

if (users.length > 0 && isValid && !isInvalid && homeDir) {
    logger.info('\n✓ All user enumeration tests passed!');
} else {
    logger.error('\n✗ User enumeration tests failed');
    process.exit(1);
}
```

**Commands**:
```bash
node test-users.js
```

**Expected output**:
- List of system users with /home directories
- Current user validated
- Fake user not validated
- Home directory returned

**Cleanup**:
```bash
rm test-users.js
```

**Completion Criteria**:
- All tests pass
- User enumeration works correctly
- Test file removed

#### 6.1.4: Run ESLint
**Commands**:
```bash
npm run lint lib/users.js server.js
```

**Completion Criteria**:
- ESLint passes

### Task 6.1 Quality Gates
- [ ] lib/users.js created and working
- [ ] Filters to /home/* users correctly
- [ ] users:list Socket.io event works
- [ ] User validation functional
- [ ] Tests passed
- [ ] ESLint passes

### Task 6.1 Completion
```bash
git add lib/users.js server.js
git commit -m "Task 6.1: Implement user enumeration"
git checkout phase-6-multi-user
git merge phase-6/task-6.1-user-enumeration --squash
git commit -m "Task 6.1: Implement user enumeration

- Created lib/users.js utility
- Implemented getSystemUsers() from /etc/passwd
- Filtered to /home/* users only
- Added user validation
- Created users:list Socket.io event
- Tested user enumeration
- Quality gates passed"
```

---

## Task 6.2: Add User Selection to UI

**Branch**: `phase-6/task-6.2-user-selection-ui`
**Estimated Time**: 45 minutes

### Subtasks

#### 6.2.1: Update populateUserSelect() function
**Action**: In `public/app.js`, implement populateUserSelect():

```javascript
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

    // Select current user by default if available
    // Server should send current user or we can try to guess
    if (users.length > 0) {
        runAsUserSelect.value = users[0];
        updateWorkingDirForUser(users[0]);
    }
}
```

**Completion Criteria**:
- populateUserSelect() implemented
- Handles empty user list
- Selects first user by default
- Updates working directory

#### 6.2.2: Implement updateWorkingDirForUser()
**Action**: Add to `public/app.js`:

```javascript
function updateWorkingDirForUser(username) {
    if (!username) {
        workingDirInput.value = '/tmp';
        return;
    }

    // Set to user's home directory
    workingDirInput.value = `/home/${username}`;
}
```

**Completion Criteria**:
- Sets working directory to user's home
- Falls back to /tmp if no user

#### 6.2.3: Update loadAvailableUsers() call
**Action**: Ensure loadAvailableUsers() is called in:
- initSocket() on connect
- openNewSessionModal()

```javascript
function loadAvailableUsers() {
    socket.emit('users:list');
}

// In initSocket():
socket.on('connect', () => {
    logger.info('Connected to server');
    loadSessions();
    loadAvailableUsers();
});

// In openNewSessionModal() (already there from Phase 4):
function openNewSessionModal() {
    setDefaultSessionName();
    loadAvailableUsers();  // Refresh users list
    modalOverlay.classList.remove('hidden');
    sessionNameInput.focus();
}
```

**Completion Criteria**:
- Users loaded on connect
- Users loaded when modal opens
- Fresh list each time

#### 6.2.4: Test user selection UI
**Manual test**:
1. Start server and open browser
2. Click "New Session"
3. Verify user dropdown populated
4. Select different users
5. Verify working directory updates
6. Create session with selected user
7. Verify session uses correct user

**Completion Criteria**:
- User dropdown works
- Working directory updates
- Session creation uses selected user

#### 6.2.5: Run ESLint
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 6.2 Quality Gates
- [ ] populateUserSelect() implemented
- [ ] updateWorkingDirForUser() works
- [ ] User dropdown functional
- [ ] Working directory updates correctly
- [ ] UI tested manually
- [ ] ESLint passes

### Task 6.2 Completion
```bash
git add public/app.js
git commit -m "Task 6.2: Add user selection to UI"
git checkout phase-6-multi-user
git merge phase-6/task-6.2-user-selection-ui --squash
git commit -m "Task 6.2: Add user selection to UI

- Implemented populateUserSelect() function
- Added updateWorkingDirForUser() function
- Connected to users:list Socket.io event
- Updated working directory based on user
- Tested user selection in modal
- Quality gates passed"
```

---

## Task 6.3: Implement Sudo-based Process Spawning

**Branch**: `phase-6/task-6.3-sudo-spawning`
**Estimated Time**: 1.5 hours

### Subtasks

#### 6.3.1: Update PTY manager spawn() method
**Action**: Edit `lib/pty-manager.js` spawn() method:

```javascript
    /**
     * Spawn a new PTY process for a session
     * Uses sudo to run as specified user
     */
    spawn(sessionId, command, workingDirectory, runAsUser) {
        if (this.processes.has(sessionId)) {
            throw new Error(`Session ${sessionId} already has an active process`);
        }

        try {
            let ptyProcess;

            if (runAsUser && runAsUser !== process.env.USER) {
                // Spawn bash as different user using sudo
                logger.info(`Spawning PTY as user ${runAsUser} for session ${sessionId}`);

                ptyProcess = pty.spawn('sudo', ['-u', runAsUser, 'bash', '-l'], {
                    name: 'xterm-color',
                    cols: PTY_COLS,
                    rows: PTY_ROWS,
                    cwd: workingDirectory,
                    env: process.env
                });
            } else {
                // Spawn bash as current user (no sudo)
                logger.info(`Spawning PTY as current user for session ${sessionId}`);
                const shell = process.env.SHELL || 'bash';

                ptyProcess = pty.spawn(shell, ['-l'], {
                    name: 'xterm-color',
                    cols: PTY_COLS,
                    rows: PTY_ROWS,
                    cwd: workingDirectory,
                    env: process.env
                });
            }

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
```

**Completion Criteria**:
- spawn() uses sudo for different users
- Uses current user without sudo when same
- Passes runAsUser parameter
- Logs which user is being used

#### 6.3.2: Add user validation to session creation
**Action**: Update session creation in `server.js` or session-manager:

```javascript
// Import at top
const usersUtil = require('./lib/users');

// In session:create handler:
socket.on('session:create', async ({ name, command, workingDirectory, runAsUser }) => {
    try {
        // Validation
        if (!name || !command || !workingDirectory || !runAsUser) {
            return socket.emit('error', { message: 'All fields are required' });
        }

        // Validate user exists
        if (!usersUtil.validateUser(runAsUser)) {
            return socket.emit('error', { message: `User '${runAsUser}' does not exist on this system` });
        }

        // Validate working directory exists
        if (!fs.existsSync(workingDirectory)) {
            return socket.emit('error', { message: `Directory '${workingDirectory}' does not exist` });
        }

        // Check max sessions limit
        const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS) || 10;
        const runningSessions = sessionsDb.getSessionsByStatus('running');
        if (runningSessions.length >= MAX_SESSIONS) {
            return socket.emit('error', { message: `Maximum number of sessions (${MAX_SESSIONS}) reached` });
        }

        // Create session (rest of existing logic)
        // ...

    } catch (error) {
        logger.error('Failed to create session:', error);
        socket.emit('error', { message: error.message });
    }
});
```

**Completion Criteria**:
- User validated before session creation
- Working directory validated
- Max sessions enforced
- Clear error messages

#### 6.3.3: Test sudo spawning
**Prerequisites**:
- Sudo must be configured (see Task 6.4)
- Multiple users must exist on system

**Manual test**:
1. Configure sudo (see SUDO_SETUP.md from Task 6.4)
2. Start server
3. Open browser
4. Create session as User A
5. Verify session runs as User A (check output of `whoami` command)
6. Create session as User B
7. Verify session runs as User B
8. Try invalid user - should show error

**Completion Criteria**:
- Sessions spawn as correct user
- whoami returns expected username
- Invalid user rejected

#### 6.3.4: Run ESLint
**Commands**:
```bash
npm run lint lib/pty-manager.js server.js
```

**Completion Criteria**:
- ESLint passes

### Task 6.3 Quality Gates
- [ ] spawn() updated with sudo support
- [ ] User validation implemented
- [ ] Directory validation added
- [ ] Sudo spawning tested (if configured)
- [ ] ESLint passes

### Task 6.3 Completion
```bash
git add lib/pty-manager.js server.js
git commit -m "Task 6.3: Implement sudo-based process spawning"
git checkout phase-6-multi-user
git merge phase-6/task-6.3-sudo-spawning --squash
git commit -m "Task 6.3: Implement sudo-based process spawning

- Updated PTY manager spawn() with sudo support
- Added user validation before session creation
- Added directory validation
- Enforced max sessions limit
- Tested sudo spawning (if configured)
- Quality gates passed"
```

---

## Task 6.4: Create Sudo Configuration Guide

**Branch**: `phase-6/task-6.4-sudo-guide`
**Estimated Time**: 1 hour

### Subtasks

#### 6.4.1: Create SUDO_SETUP.md
**Action**: Create `SUDO_SETUP.md`:

```markdown
# Sudo Configuration Guide

This guide explains how to configure sudo permissions for the Claude Code Monitor application to run processes as different Linux users.

## Overview

The application needs to spawn bash processes and copy files as different users. This requires sudo configuration.

## Two Configuration Options

### Option 1: Run Server as Root (Simplest, Less Secure)

**Pros:**
- No sudo configuration needed
- Works immediately
- Simple setup

**Cons:**
- Security risk (server runs with root privileges)
- Not recommended for production
- Entire application runs as root

**Setup:**
```bash
# Run server as root
sudo npm start

# Or configure systemd service to run as root (see INSTALLATION.md)
```

**Use this option for:**
- Development/testing
- Single-user systems
- Trusted environments only

---

### Option 2: Dedicated Service User with Sudo (Recommended)

**Pros:**
- More secure (principle of least privilege)
- Server runs as non-root user
- Only specific commands allowed via sudo
- Recommended for production

**Cons:**
- Requires sudo configuration
- More complex setup

**Setup Steps:**

#### Step 1: Create Service User

```bash
# Create dedicated user for the service
sudo useradd -r -s /bin/bash -d /opt/claude-monitor -m claude-monitor

# This creates:
# - System user (-r)
# - With bash shell (-s /bin/bash)
# - Home directory at /opt/claude-monitor (-d ...)
# - Creates home directory (-m)
```

#### Step 2: Configure Sudo Permissions

Create sudo configuration file:

```bash
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add the following content (replace USER1, USER2, USER3 with actual usernames):

```
# Claude Code Monitor sudo configuration
# Allows claude-monitor user to run processes as specified users

# Define users that can be impersonated
User_Alias CLAUDE_USERS = user1, user2, user3

# Define allowed commands
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown

# Grant permissions (no password required)
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

**Important:**
- Replace `user1, user2, user3` with actual usernames on your system
- Add all users you want to run Claude Code sessions as
- Do NOT add root or other system users
- Keep the list to regular user accounts only

#### Step 3: Validate Sudo Configuration

Test the configuration:

```bash
# Test switching to a user
sudo -u claude-monitor sudo -u user1 bash -c 'whoami'
# Should output: user1

# Test file operations
sudo -u claude-monitor sudo -u user1 bash -c 'echo test > /tmp/test.txt'
sudo -u claude-monitor sudo -u user1 cp /tmp/test.txt /tmp/test2.txt
sudo -u claude-monitor sudo -u user1 chown user1:user1 /tmp/test2.txt

# Clean up
rm /tmp/test.txt /tmp/test2.txt

# If all commands succeed, configuration is correct
```

#### Step 4: Install Application

```bash
# Copy application to service user home
sudo cp -r /path/to/claude-code-monitor /opt/claude-monitor/
sudo chown -R claude-monitor:claude-monitor /opt/claude-monitor/claude-code-monitor

# Install dependencies as service user
sudo -u claude-monitor bash -c 'cd /opt/claude-monitor/claude-code-monitor && npm install'
```

#### Step 5: Configure Systemd Service

See `install-service.js` or `INSTALLATION.md` for systemd setup.

The service file should specify:
```ini
User=claude-monitor
Group=claude-monitor
```

---

## Security Considerations

### What Sudo Access Allows

With this configuration, the `claude-monitor` user can:
- ✅ Run bash shells as specified users
- ✅ Copy files as specified users
- ✅ Change file ownership to specified users
- ❌ NOT access other sudo commands
- ❌ NOT run as root
- ❌ NOT run as users not in CLAUDE_USERS list

### Risks and Mitigations

**Risk:** Service account could be compromised
**Mitigation:**
- Limit sudo access to specific commands only
- Limit sudo access to specific users only
- Run service as dedicated non-root user
- Keep system and dependencies updated

**Risk:** Users could exploit sudo access
**Mitigation:**
- Only add trusted users to CLAUDE_USERS
- Regularly audit /etc/sudoers.d/claude-monitor
- Monitor system logs for suspicious activity
- Use file system permissions to protect sensitive directories

### Best Practices

1. **Principle of Least Privilege**
   - Only add users who need Claude Code access
   - Only grant minimal required commands
   - Regularly review user list

2. **Audit and Monitoring**
   - Monitor application logs
   - Check system auth logs: `sudo journalctl -u ssh -f`
   - Review sudo logs: `sudo cat /var/log/auth.log | grep sudo`

3. **Keep Updated**
   - Update Node.js and dependencies regularly
   - Apply system security updates
   - Review security advisories

4. **Network Security**
   - Use Tailscale or VPN for access
   - Don't expose directly to internet
   - Consider adding authentication (not included in v1)

---

## Troubleshooting

### "sudo: no tty present and no askpass program specified"

This error means sudo is asking for a password. Solutions:

1. Verify NOPASSWD is in sudoers file
2. Check syntax: `sudo visudo -c -f /etc/sudoers.d/claude-monitor`
3. Ensure user is in CLAUDE_USERS list
4. Restart system: `sudo systemctl restart`

### "sorry, user claude-monitor is not allowed to execute..."

This means sudo configuration doesn't allow the command. Solutions:

1. Check user is in CLAUDE_USERS: `sudo cat /etc/sudoers.d/claude-monitor`
2. Check command is in CLAUDE_CMDS
3. Validate syntax: `sudo visudo -c -f /etc/sudoers.d/claude-monitor`

### Sessions fail to start

Check logs:
```bash
# Application logs
sudo journalctl -u claude-monitor -f

# System logs
sudo journalctl -xe

# Test manually
sudo -u claude-monitor sudo -u user1 bash -l
```

---

## Example Configurations

### Single User System (Development)

```bash
# Just run as your own user, no sudo needed
# In .env set runAsUser to current user
npm start
```

### Multi-User Development Server

```sudoers
# /etc/sudoers.d/claude-monitor
User_Alias CLAUDE_USERS = alice, bob, charlie
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

### Production Server (Department Team)

```sudoers
# /etc/sudoers.d/claude-monitor
User_Alias CLAUDE_USERS = dev1, dev2, dev3, dev4, dev5
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS

# Additional restriction: only allow from specific home directories
Defaults!/bin/bash !requiretty
```

---

## Testing Checklist

After configuration, test:

- [ ] Service starts as claude-monitor user
- [ ] Can create session as User A
- [ ] Session runs as User A (verify with `whoami`)
- [ ] Can create session as User B
- [ ] Session runs as User B
- [ ] Cannot create session as unlisted user
- [ ] File uploads work with correct ownership
- [ ] Sessions can write to their user's home directory
- [ ] Sessions cannot write to other users' directories

---

## Additional Resources

- [Sudo Manual](https://www.sudo.ws/docs/man/sudoers.man/)
- [Ubuntu Sudoers Documentation](https://help.ubuntu.com/community/Sudoers)
- [Security Best Practices](https://www.debian.org/doc/manuals/securing-debian-manual/)

---

## Support

If you encounter issues:
1. Check logs: `sudo journalctl -u claude-monitor -f`
2. Test sudo manually: `sudo -u claude-monitor sudo -u targetuser bash -l`
3. Validate sudoers syntax: `sudo visudo -c -f /etc/sudoers.d/claude-monitor`
4. Review this guide's troubleshooting section
```

**Completion Criteria**:
- SUDO_SETUP.md created
- Both options documented
- Step-by-step instructions provided
- Security considerations covered
- Troubleshooting section included

#### 6.4.2: Create quick reference card
**Action**: Create `SUDO_QUICK_START.md`:

```markdown
# Sudo Quick Start

## For Impatient People

### Option 1: Development (Quick & Dirty)

```bash
# Just run as root
sudo npm start
```

Done. Not secure. Don't use in production.

---

### Option 2: Production (Proper Way)

```bash
# 1. Create service user
sudo useradd -r -s /bin/bash -d /opt/claude-monitor -m claude-monitor

# 2. Configure sudo
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add this (replace user1,user2,user3 with real usernames):
```
User_Alias CLAUDE_USERS = user1, user2, user3
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

```bash
# 3. Test it
sudo -u claude-monitor sudo -u user1 bash -c 'whoami'
# Should print: user1

# 4. Run app as service user
sudo -u claude-monitor npm start
```

Done.

---

See SUDO_SETUP.md for details, security info, and troubleshooting.
```

**Completion Criteria**:
- Quick start guide created
- Minimal steps provided
- Links to detailed guide

#### 6.4.3: Update main README
**Action**: Add to `README.md` (if exists, else create):

```markdown
# Claude Code Monitor

Web application for monitoring Claude Code sessions over Tailscale network.

## Quick Start

See [SUDO_QUICK_START.md](SUDO_QUICK_START.md) for setup.

## Documentation

- [SUDO_SETUP.md](SUDO_SETUP.md) - Complete sudo configuration guide
- [DEV_PLAN.md](DEV_PLAN.md) - Development plan
- [ENV_VARS.md](ENV_VARS.md) - Environment variables

## Multi-User Support

This application can run Claude Code sessions as different Linux users, allowing each user to access their own GitHub credentials, SSH keys, and configurations.

**Important:** Requires sudo configuration. See SUDO_SETUP.md.
```

**Completion Criteria**:
- README updated or created
- Links to sudo documentation

### Task 6.4 Quality Gates
- [ ] SUDO_SETUP.md created and comprehensive
- [ ] SUDO_QUICK_START.md created
- [ ] README.md updated
- [ ] All documentation clear and accurate
- [ ] Security considerations documented

### Task 6.4 Completion
```bash
git add SUDO_SETUP.md SUDO_QUICK_START.md README.md
git commit -m "Task 6.4: Create sudo configuration guide"
git checkout phase-6-multi-user
git merge phase-6/task-6.4-sudo-guide --squash
git commit -m "Task 6.4: Create sudo configuration guide

- Created comprehensive SUDO_SETUP.md
- Created SUDO_QUICK_START.md
- Updated README.md
- Documented both configuration options
- Included security considerations
- Added troubleshooting section
- Quality gates passed"
```

---

## Task 6.5: Update File Copy with Sudo

**Branch**: `phase-6/task-6.5-sudo-file-copy`
**Estimated Time**: 45 minutes

### Subtasks

#### 6.5.1: Update copyFileToSession() helper
**Action**: Update function in `server.js`:

```javascript
/**
 * Copy file to destination with correct ownership using sudo
 */
async function copyFileToSession(sourcePath, destPath, runAsUser) {
    try {
        // Determine if we need sudo
        const currentUser = process.env.USER || process.env.USERNAME;
        const needsSudo = runAsUser && runAsUser !== currentUser;

        if (needsSudo) {
            // Use sudo to copy and set ownership
            logger.info(`Copying file as user ${runAsUser}: ${destPath}`);

            // Copy file
            await execPromise(`sudo -u ${runAsUser} cp "${sourcePath}" "${destPath}"`);

            // Set ownership
            await execPromise(`sudo -u ${runAsUser} chown ${runAsUser}:${runAsUser} "${destPath}"`);

            logger.info(`File copied with correct ownership: ${destPath}`);
        } else {
            // Simple copy (no sudo needed)
            fs.copyFileSync(sourcePath, destPath);
            logger.info(`File copied: ${destPath}`);
        }

        return true;
    } catch (error) {
        logger.error('File copy failed:', error);
        throw new Error(`Failed to copy file: ${error.message}`);
    }
}
```

**Completion Criteria**:
- Uses sudo when different user
- Skips sudo for same user
- Sets correct ownership
- Error handling included

#### 6.5.2: Test file upload with ownership
**Prerequisites**: Sudo configured, multiple users exist

**Manual test**:
1. Create session as User A
2. Upload file
3. SSH/login as User A
4. Check file ownership: `ls -la /path/to/file`
5. Should show User A as owner
6. Verify User A can edit file

**Completion Criteria**:
- File owned by correct user
- User can access uploaded file

#### 6.5.3: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes

### Task 6.5 Quality Gates
- [ ] copyFileToSession() updated with sudo
- [ ] Ownership set correctly
- [ ] Works with and without sudo
- [ ] Tested with actual users (if configured)
- [ ] ESLint passes

### Task 6.5 Completion
```bash
git add server.js
git commit -m "Task 6.5: Update file copy with sudo"
git checkout phase-6-multi-user
git merge phase-6/task-6.5-sudo-file-copy --squash
git commit -m "Task 6.5: Update file copy with sudo

- Updated copyFileToSession() with sudo support
- Added ownership setting with chown
- Tested file uploads with multiple users
- Quality gates passed"
```

---

## Task 6.6: Test Multi-User Functionality

**Branch**: `phase-6/task-6.6-multi-user-testing`
**Estimated Time**: 1 hour

### Subtasks

#### 6.6.1: Create test users (if needed)
**Commands**:
```bash
# Create test users
sudo useradd -m -s /bin/bash testuser1
sudo useradd -m -s /bin/bash testuser2

# Set passwords (for SSH testing)
sudo passwd testuser1
sudo passwd testuser2

# Add to sudo group if needed
sudo usermod -aG sudo testuser1
sudo usermod -aG sudo testuser2
```

**Completion Criteria**:
- Test users created (or use existing users)

#### 6.6.2: Configure sudo for test users
**Commands**:
```bash
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add testuser1 and testuser2 to CLAUDE_USERS

**Completion Criteria**:
- Sudo configured for test users

#### 6.6.3: Run comprehensive multi-user tests
**Test scenarios**:

1. **Session as User 1**
   - Create session as testuser1
   - Verify `whoami` returns testuser1
   - Create file in testuser1's home
   - Check file ownership

2. **Session as User 2**
   - Create session as testuser2
   - Verify `whoami` returns testuser2
   - Verify can't access testuser1's files

3. **File Upload**
   - Upload file to testuser1 session
   - Verify ownership is testuser1:testuser1
   - Verify testuser1 can modify file

4. **Multiple Concurrent Sessions**
   - Create session as testuser1
   - Create session as testuser2
   - Run commands in both simultaneously
   - Verify isolation

5. **Invalid User**
   - Try to create session as nonexistent user
   - Verify error message
   - Verify session not created

6. **Permission Boundaries**
   - As testuser1, try to write to testuser2's home
   - Should fail with permission denied
   - Verify proper error handling

**Completion Criteria**:
- All test scenarios pass
- User isolation verified
- Permissions working correctly

#### 6.6.4: Document test results
**Action**: Create `TESTING.md` section for multi-user:

```markdown
# Multi-User Testing Results

## Test Environment
- System: [OS and version]
- Users: testuser1, testuser2
- Date: [Test date]

## Test Results

### ✅ Session Creation
- [x] Sessions created as different users
- [x] whoami returns correct username
- [x] Invalid users rejected

### ✅ File System Isolation
- [x] Each user limited to their home directory
- [x] Cannot access other users' files
- [x] Proper permission errors

### ✅ File Uploads
- [x] Files uploaded with correct ownership
- [x] Users can access their uploaded files
- [x] Ownership set to session user

### ✅ Concurrent Sessions
- [x] Multiple sessions run simultaneously
- [x] Sessions isolated from each other
- [x] No interference between users

## Notes
[Any additional observations]
```

**Completion Criteria**:
- Test results documented
- All tests passed

### Task 6.6 Quality Gates
- [ ] Test users created
- [ ] Sudo configured for testing
- [ ] All multi-user scenarios tested
- [ ] User isolation verified
- [ ] Test results documented

### Task 6.6 Completion
```bash
git add TESTING.md
git commit -m "Task 6.6: Test multi-user functionality"
git checkout phase-6-multi-user
git merge phase-6/task-6.6-multi-user-testing --squash
git commit -m "Task 6.6: Test multi-user functionality

- Created test users
- Configured sudo for testing
- Tested all multi-user scenarios
- Verified user isolation
- Documented test results
- Quality gates passed"
```

---

## Phase 6 Completion

### Phase 6 Integration Test
```bash
# Prerequisites:
# - Sudo configured per SUDO_SETUP.md
# - Multiple users available

# 1. Start server
npm start

# 2. Test user enumeration
# - Open browser
# - Click "New Session"
# - Verify user dropdown populated with system users

# 3. Test session as User A
# - Select User A
# - Create session
# - Run: whoami
# - Verify output shows User A

# 4. Test session as User B
# - Create session as User B
# - Run: whoami
# - Verify output shows User B

# 5. Test file upload
# - Upload file to User A session
# - SSH as User A
# - Verify file exists and owned by User A

# 6. Test concurrent sessions
# - Have both sessions running
# - Verify they're isolated

# 7. Test invalid user
# - Try to create session as non-existent user
# - Verify error shown

# 8. Run linting
npm run lint

# 9. Check git status
git status  # Should be clean
```

### Expected Results
- User enumeration works
- Sessions spawn as correct users
- File uploads have correct ownership
- User isolation maintained
- Invalid users rejected
- ESLint passes
- Git working directory clean

### Phase 6 Quality Gates Checklist
- [ ] All tasks (6.1 - 6.6) completed
- [ ] User enumeration functional
- [ ] User selection in UI works
- [ ] Sudo-based spawning implemented
- [ ] File copy uses sudo
- [ ] Sudo documentation complete
- [ ] Multi-user tested successfully
- [ ] ESLint passes
- [ ] Integration test passed
- [ ] No uncommitted changes

### Merge to Main
```bash
git checkout main
git merge phase-6-multi-user -m "Phase 6: Multi-User Support & Security Complete

Completed tasks:
- 6.1: Implement user enumeration
- 6.2: Add user selection to UI
- 6.3: Implement sudo-based process spawning
- 6.4: Create sudo configuration guide
- 6.5: Update file copy with sudo
- 6.6: Test multi-user functionality

Phase completion criteria met:
✓ System users enumerated correctly
✓ User dropdown populated in UI
✓ PTY processes spawn as specified user
✓ File uploads have correct ownership
✓ User validation implemented
✓ Comprehensive sudo documentation
✓ Security best practices documented
✓ Multi-user tested successfully
✓ All quality gates passed

Ready for Phase 7: Testing & Deployment"

git push origin main
```

### Update PROGRESS.md
```bash
git checkout main
# Mark Phase 6 complete, prepare Phase 7
# Commit and push
```

---

## Next Steps

After Phase 6 completion:
1. Create Phase 7 branch: `git checkout -b phase-7-deployment`
2. Read [phase-7.md](phase-7.md) for testing and deployment
3. Execute Task 7.1 to begin end-to-end testing
