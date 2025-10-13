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
