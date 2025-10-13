# Production Deployment Checklist

Use this checklist when deploying Claude Code Monitor to production.

## Pre-Deployment

- [ ] All tests passed
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Git repository clean
- [ ] Version number updated in package.json
- [ ] CHANGELOG.md updated with release date

## Server Preparation

- [ ] Linux server provisioned (Ubuntu 20.04+, Debian 11+, or similar)
- [ ] Node.js 20.x installed
- [ ] System packages updated (`sudo apt update && sudo apt upgrade`)
- [ ] Tailscale installed and configured (optional but recommended)
- [ ] User accounts created for multi-user support
- [ ] SSH access configured
- [ ] Build tools installed (`build-essential`, `python3`)

## Installation

- [ ] Application files copied to server
- [ ] Dependencies installed: `npm install`
- [ ] .env file configured from .env.example
- [ ] Sudo configured per SUDO_SETUP.md (if multi-user)
- [ ] Service user created (`claude-monitor`)
- [ ] File permissions set correctly
- [ ] Directories created (logs/, uploads/)

## Service Setup

- [ ] Systemd service installed: `sudo ./install-service.js`
- [ ] Service enabled: `sudo systemctl enable claude-monitor`
- [ ] Service started: `sudo systemctl start claude-monitor`
- [ ] Service status verified: `sudo systemctl status claude-monitor`
- [ ] Service logs checked: `sudo journalctl -u claude-monitor -f`

## Verification Tests

### Basic Functionality
- [ ] Health check responds: `curl http://localhost:3456/api/health`
- [ ] Status endpoint works: `curl http://localhost:3456/api/status`
- [ ] Frontend loads in browser (localhost:3456)
- [ ] Socket.io connection established (check browser console)

### Session Management
- [ ] Can create new session
- [ ] Session appears in sidebar
- [ ] Can attach to session
- [ ] Terminal displays output
- [ ] Can send input to terminal
- [ ] Can stop session
- [ ] Can delete session

### File Upload
- [ ] Upload via button works
- [ ] Drag-and-drop works
- [ ] Paste upload works (Ctrl+V)
- [ ] Files appear in session directory
- [ ] File size limit enforced (>100MB rejected)

### Multi-User Support (if configured)
- [ ] User dropdown populated
- [ ] Sessions created as selected user
- [ ] `whoami` command shows correct user
- [ ] File uploads have correct ownership
- [ ] Users isolated from each other
- [ ] Invalid users rejected

### Network Access
- [ ] Tailscale access works: `http://TAILSCALE_IP:3456`
- [ ] WebSocket connection stable
- [ ] Multiple concurrent connections work
- [ ] Reconnection works after network interruption

### iOS Testing (if applicable)
- [ ] Frontend loads on iOS Safari
- [ ] Terminal renders correctly
- [ ] Touch scrolling works
- [ ] Paste upload works on iOS

## Monitoring

- [ ] Logs accessible: `sudo journalctl -u claude-monitor -f`
- [ ] Log rotation configured (winston-daily-rotate-file)
- [ ] Disk space adequate for logs and uploads
- [ ] Database file writable
- [ ] Process monitoring configured (optional: monit, supervisor)
- [ ] Backup strategy defined

## Security

- [ ] Sudo configuration reviewed (minimal permissions)
- [ ] File permissions correct (service user ownership)
- [ ] Network access restricted (Tailscale or firewall)
- [ ] User isolation verified
- [ ] Input validation tested
- [ ] File upload validation tested
- [ ] No sensitive data in logs

## Performance

- [ ] Multiple concurrent sessions tested
- [ ] Terminal output smooth with high-frequency updates
- [ ] File upload doesn't block other operations
- [ ] Browser memory usage reasonable
- [ ] Server CPU usage reasonable under load
- [ ] Database query performance acceptable

## Post-Deployment

- [ ] Documentation shared with users
- [ ] Access instructions provided (Tailscale IP, port)
- [ ] Support plan established
- [ ] Maintenance schedule created
- [ ] Backup scheduled (database, configuration)
- [ ] Update procedure documented

## Rollback Plan

If deployment fails:

1. **Stop service**:
   ```bash
   sudo systemctl stop claude-monitor
   ```

2. **Restore previous version**:
   ```bash
   cd /opt/claude-monitor/claude-code-monitor
   git checkout v0.0.X  # Previous version
   npm install
   ```

3. **Restart service**:
   ```bash
   sudo systemctl start claude-monitor
   ```

4. **Review logs**:
   ```bash
   sudo journalctl -u claude-monitor -n 100
   ```

5. **Document issues** for future troubleshooting

## Release Sign-Off

**Deployed by**: _________________
**Date**: _________________
**Version**: v0.1.0
**Server**: _________________
**Tailscale IP**: _________________

**Signature**: _________________

---

## Notes

Use this section to document any deployment-specific notes, issues encountered, or customizations made:

-
-
-
