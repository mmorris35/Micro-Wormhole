# Installation Guide

This guide covers installing Claude Code Monitor as a systemd service on Linux.

## Prerequisites

- Linux system (Ubuntu 20.04+, Debian 11+, or similar)
- Node.js 20.x or later
- Root/sudo access
- Multiple user accounts (for multi-user support)
- Tailscale installed and configured (optional but recommended)

## Quick Installation

```bash
# 1. Clone or download application
git clone <repo-url> claude-code-monitor
cd claude-code-monitor

# 2. Install dependencies
npm install

# 3. Run installer (as root)
sudo ./install-service.js

# 4. Configure environment
sudo nano /opt/claude-monitor/claude-code-monitor/.env

# 5. Configure sudo (see SUDO_SETUP.md)
sudo visudo -f /etc/sudoers.d/claude-monitor

# 6. Enable and start service
sudo systemctl enable claude-monitor
sudo systemctl start claude-monitor

# 7. Check status
sudo systemctl status claude-monitor
```

## Detailed Installation Steps

### Step 1: System Preparation

Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js 20.x:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node --version  # Should be v20.x.x
npm --version
```

### Step 2: Application Setup

Clone/download application:
```bash
cd /tmp
git clone <repo-url> claude-code-monitor
cd claude-code-monitor
```

Install dependencies:
```bash
npm install
```

### Step 3: Run Installer

Execute installation script:
```bash
sudo ./install-service.js
```

Follow prompts:
- Installation directory: `/opt/claude-monitor` (default)
- Service user: `claude-monitor` (default)
- Service group: `claude-monitor` (default)

The installer will:
- Create service user
- Copy files to install directory
- Install systemd service
- Set correct permissions

### Step 4: Configure Environment

Edit configuration:
```bash
sudo nano /opt/claude-monitor/claude-code-monitor/.env
```

Key settings to verify:
```env
PORT=3456
HOST=0.0.0.0
NODE_ENV=production
MAX_SESSIONS=10
DB_PATH=./sessions.db
```

### Step 5: Configure Sudo

**Required for multi-user support**

See [SUDO_SETUP.md](SUDO_SETUP.md) for detailed instructions.

Quick setup:
```bash
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add (replace with your usernames):
```
User_Alias CLAUDE_USERS = user1, user2, user3
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

Test:
```bash
sudo -u claude-monitor sudo -u user1 bash -c 'whoami'
```

### Step 6: Start Service

Enable service (start on boot):
```bash
sudo systemctl enable claude-monitor
```

Start service:
```bash
sudo systemctl start claude-monitor
```

Check status:
```bash
sudo systemctl status claude-monitor
```

Expected output:
```
● claude-monitor.service - Claude Code Monitor
     Loaded: loaded (/etc/systemd/system/claude-monitor.service; enabled)
     Active: active (running) since ...
```

### Step 7: Verify Installation

View logs:
```bash
sudo journalctl -u claude-monitor -f
```

Test access:
```bash
# Via localhost
curl http://localhost:3456/api/health

# Via Tailscale IP (replace with your IP)
curl http://100.x.x.x:3456/api/health
```

Open in browser:
- Local: http://localhost:3456
- Tailscale: http://100.x.x.x:3456

## Post-Installation

### Firewall Configuration

If using UFW:
```bash
# Only needed if accessing without Tailscale
sudo ufw allow 3456/tcp
```

With Tailscale, no firewall rules needed (Tailscale handles it).

### SSL/TLS (Optional)

For HTTPS, use reverse proxy (nginx, caddy) in front of application.

Example nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name monitor.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Automatic Updates

Create update script `/opt/claude-monitor/update.sh`:
```bash
#!/bin/bash
cd /opt/claude-monitor/claude-code-monitor
git pull origin main
npm install
sudo systemctl restart claude-monitor
```

Make executable:
```bash
sudo chmod +x /opt/claude-monitor/update.sh
```

### Backup

Backup database:
```bash
sudo cp /opt/claude-monitor/claude-code-monitor/sessions.db \
     /opt/claude-monitor/sessions.db.backup
```

Create backup cron job:
```bash
sudo crontab -e
```

Add:
```
0 2 * * * cp /opt/claude-monitor/claude-code-monitor/sessions.db /opt/claude-monitor/backups/sessions-$(date +\%Y\%m\%d).db
```

## Service Management

### Common Commands

```bash
# Start service
sudo systemctl start claude-monitor

# Stop service
sudo systemctl stop claude-monitor

# Restart service
sudo systemctl restart claude-monitor

# Reload service (graceful restart)
sudo systemctl reload claude-monitor

# Enable (start on boot)
sudo systemctl enable claude-monitor

# Disable (don't start on boot)
sudo systemctl disable claude-monitor

# View status
sudo systemctl status claude-monitor

# View logs (live)
sudo journalctl -u claude-monitor -f

# View logs (last 100 lines)
sudo journalctl -u claude-monitor -n 100

# View logs (since today)
sudo journalctl -u claude-monitor --since today
```

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop claude-monitor
sudo systemctl disable claude-monitor

# Remove service file
sudo rm /etc/systemd/system/claude-monitor.service
sudo systemctl daemon-reload

# Remove installation directory
sudo rm -rf /opt/claude-monitor

# Remove service user (optional)
sudo userdel claude-monitor

# Remove sudo configuration
sudo rm /etc/sudoers.d/claude-monitor
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

Quick checks:
```bash
# Check if service is running
sudo systemctl status claude-monitor

# Check logs for errors
sudo journalctl -u claude-monitor -n 50

# Check if port is in use
sudo netstat -tulpn | grep 3456

# Check file permissions
ls -la /opt/claude-monitor/claude-code-monitor

# Check sudo configuration
sudo -u claude-monitor sudo -l

# Test sudo manually
sudo -u claude-monitor sudo -u user1 bash -c 'whoami'
```

## Support

For issues:
1. Check logs: `sudo journalctl -u claude-monitor -f`
2. Review TROUBLESHOOTING.md
3. Check GitHub issues
4. Review SUDO_SETUP.md for multi-user issues
