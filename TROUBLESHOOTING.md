# Troubleshooting Guide

Common issues and solutions for Claude Code Monitor.

## Table of Contents
- [Installation Issues](#installation-issues)
- [Service Issues](#service-issues)
- [Connection Issues](#connection-issues)
- [Session Issues](#session-issues)
- [File Upload Issues](#file-upload-issues)
- [Multi-User Issues](#multi-user-issues)
- [Performance Issues](#performance-issues)

---

## Installation Issues

### "Node version too old"

**Symptom**: Error about Node.js version requirement

**Solution**:
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verify v20.x.x
```

### "npm install fails"

**Symptom**: Dependency installation errors

**Solutions**:
1. Clear npm cache:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Install build dependencies:
   ```bash
   sudo apt install -y build-essential python3
   npm install
   ```

### "Permission denied during install"

**Symptom**: Cannot write to directory

**Solution**:
```bash
# Run installer as root
sudo ./install-service.js

# Or fix permissions
sudo chown -R $(whoami) .
```

---

## Service Issues

### "Service fails to start"

**Symptom**: `systemctl start claude-monitor` fails

**Check logs**:
```bash
sudo journalctl -u claude-monitor -n 50
```

**Common causes**:

1. **Port already in use**:
   ```bash
   sudo netstat -tulpn | grep 3456
   # Kill process or change PORT in .env
   ```

2. **Missing .env file**:
   ```bash
   sudo ls /opt/claude-monitor/claude-code-monitor/.env
   # Copy from .env.example if missing
   ```

3. **Wrong user/permissions**:
   ```bash
   ls -la /opt/claude-monitor/claude-code-monitor
   # Should be owned by claude-monitor user
   sudo chown -R claude-monitor:claude-monitor /opt/claude-monitor/claude-code-monitor
   ```

4. **Database permissions**:
   ```bash
   sudo -u claude-monitor touch /opt/claude-monitor/claude-code-monitor/sessions.db
   sudo chmod 644 /opt/claude-monitor/claude-code-monitor/sessions.db
   ```

### "Service starts but crashes"

**Check logs for errors**:
```bash
sudo journalctl -u claude-monitor -f
```

**Common fixes**:
- Check all environment variables in .env
- Verify Node.js version: `node --version`
- Check for syntax errors: `node server.js`

---

## Connection Issues

### "Cannot connect from browser"

**Symptom**: Browser shows "Can't connect" or timeout

**Solutions**:

1. **Verify service is running**:
   ```bash
   sudo systemctl status claude-monitor
   ```

2. **Check port**:
   ```bash
   curl http://localhost:3456/api/health
   # Should return JSON
   ```

3. **Check firewall**:
   ```bash
   # If using UFW
   sudo ufw allow 3456/tcp
   ```

4. **Check Tailscale**:
   ```bash
   tailscale status
   # Verify IP address
   ```

### "WebSocket connection fails"

**Symptom**: "Socket.io connection error" in browser console

**Solutions**:

1. **Check Socket.io logs**:
   ```bash
   sudo journalctl -u claude-monitor -f | grep socket
   ```

2. **Verify proxy configuration** (if using nginx/caddy):
   ```nginx
   # Must include WebSocket upgrade headers
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection 'upgrade';
   ```

3. **Check CORS settings** in server.js

---

## Session Issues

### "Cannot create session"

**Symptom**: Session creation fails or shows error

**Check**:

1. **Max sessions limit**:
   ```bash
   # Check .env for MAX_SESSIONS
   # Or create fewer sessions
   ```

2. **User validation**:
   ```bash
   # Verify user exists
   id username
   ```

3. **Working directory exists**:
   ```bash
   # Verify directory
   ls -ld /path/to/directory
   ```

4. **Logs**:
   ```bash
   sudo journalctl -u claude-monitor -f
   ```

### "Session stuck in 'running' state"

**Symptom**: Session doesn't complete

**Solutions**:

1. **Stop session via UI**

2. **Kill process manually**:
   ```bash
   # Find PID from database
   sqlite3 /opt/claude-monitor/claude-code-monitor/sessions.db \
     "SELECT id, pid, status FROM sessions WHERE status='running';"

   # Kill process
   sudo kill PID
   ```

3. **Clean up database**:
   ```bash
   sqlite3 /opt/claude-monitor/claude-code-monitor/sessions.db \
     "UPDATE sessions SET status='failed' WHERE status='running';"
   ```

### "Terminal shows no output"

**Symptom**: Terminal blank or frozen

**Solutions**:

1. **Detach and reattach** to session

2. **Check PTY process**:
   ```bash
   ps aux | grep "node.*pty"
   ```

3. **Check logs**:
   ```bash
   sudo journalctl -u claude-monitor -f | grep "PTY"
   ```

4. **Restart service**:
   ```bash
   sudo systemctl restart claude-monitor
   ```

---

## File Upload Issues

### "Upload fails with 'File too large'"

**Symptom**: Files over 100MB rejected

**Solutions**:

1. **Use smaller files** (recommended)

2. **Increase limit** in .env:
   ```env
   UPLOAD_MAX_FILE_SIZE=209715200  # 200MB
   ```

3. **Restart service** after changing .env

### "Upload succeeds but file not in directory"

**Symptom**: Upload appears successful but file missing

**Check**:

1. **Verify working directory**:
   ```bash
   ls -la /path/to/session/directory
   ```

2. **Check permissions**:
   ```bash
   # Should be writable by session user
   ls -ld /path/to/session/directory
   ```

3. **Check logs**:
   ```bash
   sudo journalctl -u claude-monitor -f | grep "upload"
   ```

4. **Check ownership** (multi-user):
   ```bash
   ls -la /path/to/uploaded/file
   # Should be owned by session user
   ```

### "Drag-and-drop doesn't work"

**Symptom**: Drag-and-drop not responding

**Solutions**:

1. **Use Chrome/Firefox** (better support)

2. **Check browser console** for errors (F12)

3. **Try upload button** as alternative

4. **Refresh page**

---

## Multi-User Issues

### "Sudo password prompt"

**Symptom**: "sudo: no tty present and no askpass program specified"

**Solutions**:

1. **Verify NOPASSWD in sudoers**:
   ```bash
   sudo cat /etc/sudoers.d/claude-monitor
   # Must include NOPASSWD
   ```

2. **Check syntax**:
   ```bash
   sudo visudo -c -f /etc/sudoers.d/claude-monitor
   ```

3. **Verify user in CLAUDE_USERS list**

### "User not allowed to execute"

**Symptom**: "sorry, user claude-monitor is not allowed to execute..."

**Solutions**:

1. **Add user to CLAUDE_USERS**:
   ```bash
   sudo visudo -f /etc/sudoers.d/claude-monitor
   # Add username to User_Alias CLAUDE_USERS line
   ```

2. **Verify command in CLAUDE_CMDS**

3. **Test manually**:
   ```bash
   sudo -u claude-monitor sudo -u username bash -c 'whoami'
   ```

### "Session runs as wrong user"

**Symptom**: `whoami` shows wrong username

**Solutions**:

1. **Check selected user** in UI

2. **Verify sudo configuration**

3. **Check logs**:
   ```bash
   sudo journalctl -u claude-monitor -f | grep "Spawning PTY"
   ```

### "User can access other users' files"

**Symptom**: Security boundary broken

**Solutions**:

1. **Verify Linux file permissions**:
   ```bash
   # User home directories should be 700
   ls -ld /home/*
   ```

2. **Check if running as root** (don't do this)

3. **Review sudo configuration**

---

## Performance Issues

### "High CPU usage"

**Symptom**: Server using too much CPU

**Check**:

1. **Number of active sessions**:
   ```bash
   sqlite3 /opt/claude-monitor/claude-code-monitor/sessions.db \
     "SELECT COUNT(*) FROM sessions WHERE status='running';"
   ```

2. **Reduce MAX_SESSIONS** in .env

3. **Monitor processes**:
   ```bash
   top -u claude-monitor
   ```

### "High memory usage"

**Symptom**: Server using too much memory

**Solutions**:

1. **Reduce SESSION_OUTPUT_BUFFER_SIZE** in .env

2. **Clean up old sessions**

3. **Restart service periodically**:
   ```bash
   # Add to crontab
   0 3 * * * systemctl restart claude-monitor
   ```

### "Slow terminal output"

**Symptom**: Terminal lags or stutters

**Solutions**:

1. **Check network latency** (especially over Tailscale)

2. **Reduce terminal buffer size**

3. **Use faster terminal** (Chrome usually faster than Firefox)

4. **Check server load**:
   ```bash
   uptime
   top
   ```

---

## Diagnostic Commands

```bash
# Service status
sudo systemctl status claude-monitor

# View logs (live)
sudo journalctl -u claude-monitor -f

# View logs (last 100 lines)
sudo journalctl -u claude-monitor -n 100

# Check port
sudo netstat -tulpn | grep 3456

# Test API
curl http://localhost:3456/api/health

# Check database
sqlite3 /opt/claude-monitor/claude-code-monitor/sessions.db \
  "SELECT * FROM sessions;"

# Check running processes
ps aux | grep "node.*server.js"

# Check file permissions
ls -la /opt/claude-monitor/claude-code-monitor

# Test sudo
sudo -u claude-monitor sudo -u username bash -c 'whoami'

# Check Tailscale
tailscale status

# Check disk space
df -h

# Check memory
free -h
```

---

## Getting Help

If issue persists:

1. **Collect information**:
   ```bash
   # System info
   uname -a
   node --version
   npm --version

   # Service status
   sudo systemctl status claude-monitor

   # Recent logs
   sudo journalctl -u claude-monitor -n 100 > logs.txt

   # Configuration
   cat /opt/claude-monitor/claude-code-monitor/.env
   ```

2. **Check documentation**:
   - INSTALLATION.md
   - SUDO_SETUP.md
   - README.md

3. **Search GitHub Issues**

4. **Create new issue** with:
   - Problem description
   - Steps to reproduce
   - Logs and configuration
   - System information
