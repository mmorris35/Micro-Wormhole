# Claude Code Monitor

Web application for monitoring and interacting with Claude Code sessions from any device (especially iOS) over a Tailscale network. Supports multiple concurrent sessions, real-time terminal output, session persistence, and running sessions as different Linux users.

## Features

- **Multi-User Support**: Run sessions as different Linux users with proper isolation
- **Real-Time Terminal**: Interactive terminal with xterm.js integration
- **Session Persistence**: SQLite database stores session history
- **File Upload**: Drag-and-drop, paste, or browse to upload files to sessions
- **Multiple Concurrent Sessions**: Run and monitor multiple sessions simultaneously
- **Socket.io Integration**: Real-time bidirectional communication
- **Tailscale Ready**: Designed for secure access over Tailscale network

## Quick Start

### Development Setup (Quick & Dirty)

```bash
# Clone repository
cd claude-code-monitor

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run as root (development only)
sudo npm start

# Open browser
open http://localhost:3456
```

See [SUDO_QUICK_START.md](SUDO_QUICK_START.md) for production setup.

## Documentation

### Setup Guides
- [SUDO_QUICK_START.md](SUDO_QUICK_START.md) - Quick setup reference
- [SUDO_SETUP.md](SUDO_SETUP.md) - Complete sudo configuration guide
- [ENV_VARS.md](ENV_VARS.md) - Environment variables reference
- [INSTALLATION.md](INSTALLATION.md) - Production deployment guide (if exists)

### Development
- [DEV_PLAN.md](DEV_PLAN.md) - Development plan and phase navigation
- [PROGRESS.md](PROGRESS.md) - Development progress tracking
- [CLAUDE.md](CLAUDE.md) - Project instructions for Claude Code
- [CHANGELOG.md](CHANGELOG.md) - Version history (if exists)

### Troubleshooting
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions (if exists)

## Multi-User Support

This application can run Claude Code sessions as different Linux users, allowing each user to access their own:
- GitHub credentials and SSH keys
- Shell configuration (bashrc, zshrc, etc.)
- Home directory and files
- Environment variables and PATH

**Important:** Requires sudo configuration. See [SUDO_SETUP.md](SUDO_SETUP.md) for complete guide.

### Two Configuration Options

**Option 1: Run as Root** (Development only)
- Simple setup, no configuration needed
- Not secure, not recommended for production

**Option 2: Dedicated Service User** (Production)
- Secure, follows principle of least privilege
- Requires sudo configuration
- Recommended for production use

## Requirements

- Node.js 16+ (recommended: 18+)
- Linux operating system
- Multiple user accounts (for multi-user features)
- Sudo configuration (for production multi-user setup)

## Tech Stack

### Backend
- Express 4.18+
- Socket.io 4.6+
- node-pty 1.0+
- better-sqlite3 9.0+
- Winston logging

### Frontend
- Vanilla JavaScript (no framework)
- xterm.js 5.3+ for terminal
- Socket.io client 4.6+
- VSCode dark theme styling

## Architecture

### Backend Structure
```
server.js                    # Main entry point, Express+Socket.io setup
lib/
  ├── logger.js              # Winston logging (console + daily rotate files)
  ├── database.js            # better-sqlite3 initialization, sessions table
  ├── sessions-db.js         # Session CRUD operations (data access layer)
  ├── pty-manager.js         # PTY process manager (node-pty wrapper)
  └── users.js               # System user enumeration (/etc/passwd parsing)
```

### Frontend Structure
```
public/
  ├── index.html             # UI structure (sidebar, terminal, modal)
  ├── style.css              # VSCode dark theme styling
  └── app.js                 # Socket.io client, xterm.js integration
```

## Security Considerations

- **Sudo Configuration**: Limit sudo access to specific users and commands only
- **Network Access**: Use Tailscale or VPN, don't expose directly to internet
- **User Isolation**: Each session runs as specified user with proper file permissions
- **No Authentication**: v1.0 does not include authentication (add if needed)
- **Regular Updates**: Keep Node.js, dependencies, and system packages updated

See [SUDO_SETUP.md](SUDO_SETUP.md) for complete security documentation.

## Development

### Commands

```bash
# Install dependencies
npm install

# Start server (development)
npm start

# Lint code
npm run lint

# Lint and auto-fix
npm run lint:fix
```

### Git Workflow

This project uses a phase-based development workflow:
- Phase branches: `phase-N-description`
- Task branches: `phase-N/task-N.M-description`
- Squash merge task branches to phase branch
- Merge commit phase branches to main

See [CLAUDE.md](CLAUDE.md) for complete development guidelines.

## Contributing

This project follows a structured development plan. See:
- [DEV_PLAN.md](DEV_PLAN.md) - Overall plan and navigation
- [PROGRESS.md](PROGRESS.md) - Current progress
- [CLAUDE.md](CLAUDE.md) - Development guidelines

## License

[Specify your license here]

## Support

For issues and questions:
1. Check [SUDO_SETUP.md](SUDO_SETUP.md) for sudo-related issues
2. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems (if exists)
3. Review application logs: `sudo journalctl -u claude-monitor -f`
4. Open a GitHub issue with details

## Acknowledgments

Built for monitoring Claude Code sessions over Tailscale network with multi-user support.
