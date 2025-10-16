# Claude Code Monitor

Web application for monitoring and interacting with Claude Code sessions from any device over a Tailscale network.

## Features

- **Prompt Injection**: Send messages to Claude Code sessions via PTY
- **Interactive Sessions**: Chat with Claude from the browser
- **File Attachments**: Include repo files in messages to Claude
- **Real-time Responses**: See Claude's responses as they arrive
- **PTY-Based**: Independent Claude processes, no conflicts with VSCode
- **Multi-Session Management**: Run multiple PTY sessions simultaneously
- **Claude Code Viewer**: Browse and view existing Claude Code conversations
- **Session Discovery**: Automatically finds Claude sessions across all users
- **Repository Grouping**: Sessions organized by Git repository
- **Conversation History**: Full message history with tool calls
- **File Integration**: Click files in conversations to view in editor
- **Real-Time Updates**: Active sessions update automatically
- **Multi-User Support**: Each session runs as a specific Linux user
- **Real-Time Terminal**: WebSocket-based terminal with xterm.js
- **File Upload**: Drag-and-drop, paste, or button upload (iOS compatible)
- **Monaco Editor**: View and browse files with syntax highlighting
- **Session Persistence**: SQLite database tracks PTY sessions
- **Responsive UI**: Works on desktop, tablet, and mobile devices

## Screenshot

[Add screenshot here after deployment]

## Requirements

- **Server**: Linux (Ubuntu 20.04+, Debian 11+, or similar)
- **Node.js**: v20.0.0 or later
- **Network**: Tailscale (recommended) or local network
- **Users**: Multiple Linux user accounts for multi-user support
- **Permissions**: Sudo configuration for user switching

## Quick Start

### 1. Install

```bash
git clone <repo-url> claude-code-monitor
cd claude-code-monitor
npm install
```

### 2. Configure

```bash
cp .env.example .env
nano .env  # Edit configuration
```

### 3. Run

```bash
# Development
npm start

# Production (see INSTALLATION.md)
sudo ./install-service.js
```

### 4. Access

Open in browser:
- Local: http://localhost:3456
- Tailscale: http://YOUR_TAILSCALE_IP:3456

## Documentation

- **[INSTALLATION.md](INSTALLATION.md)** - Production installation guide
- **[SUDO_SETUP.md](SUDO_SETUP.md)** - Multi-user sudo configuration
- **[ENV_VARS.md](ENV_VARS.md)** - Environment variable reference
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions
- **[DEV_PLAN.md](DEV_PLAN.md)** - Development plan and tasks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser UI                           │
│  (HTML/CSS/JS + xterm.js + Socket.io-client)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (Socket.io)
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Express Server                          │
│  (Node.js + Socket.io + Multer)                             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
      ┌───────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
      │   SQLite     │ │  node-pty │ │ File Upload │
      │   Database   │ │   (sudo)  │ │   (sudo)    │
      └──────────────┘ └───────────┘ └─────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
              ┌─────▼───┐ ┌──▼────┐ ┌──▼────┐
              │ User 1  │ │ User 2│ │ User 3│
              │ Session │ │Session│ │Session│
              └─────────┘ └───────┘ └───────┘
```

## Tech Stack

### Backend
- **Node.js** v20.x - JavaScript runtime
- **Express** ^4.18.0 - Web framework
- **Socket.io** ^4.6.0 - WebSocket communication
- **node-pty** ^1.0.0 - Terminal emulation
- **better-sqlite3** ^9.0.0 - SQLite database
- **multer** 1.4.5-lts.1 - File upload handling (CVE fix)
- **winston** ^3.11.0 - Logging

### Frontend
- **Vanilla JavaScript** - No framework
- **xterm.js** ^5.3.0 - Terminal UI
- **Socket.io-client** ^4.6.0 - WebSocket client

## How It Works

1. **Session Creation**: User selects a Linux user and provides a Claude Code task
2. **Process Spawning**: Server spawns a bash shell as the specified user using sudo
3. **Command Execution**: Claude Code command executed in the user's shell
4. **Terminal Streaming**: Output streamed to browser via WebSocket
5. **File Upload**: Files uploaded and copied to session directory with correct ownership
6. **Session Management**: Sessions tracked in database, can be stopped/deleted

## Multi-User Support

Each session runs as a specific Linux user, providing:
- **Isolated Credentials**: Each user has their own GitHub credentials, SSH keys, etc.
- **Separate Environments**: Each user's shell environment is isolated
- **Permission Boundaries**: Users can only access their own files
- **Correct Ownership**: Uploaded files owned by session user

Requires sudo configuration. See [SUDO_SETUP.md](SUDO_SETUP.md).

## Security

- **User Isolation**: Sessions run as specified users with proper permissions
- **Sudo Restrictions**: Limited to specific commands and users
- **Network Security**: Designed for private networks (Tailscale)
- **Input Validation**: User input validated before execution
- **File Upload Limits**: 100MB maximum file size

## API Endpoints

### HTTP Endpoints
- `GET /` - Frontend application
- `GET /api/health` - Health check
- `GET /api/status` - Server status
- `POST /api/upload/:sessionId` - File upload

### Socket.io Events

**Client → Server:**
- `users:list` - Get available users
- `session:create` - Create new session
- `session:list` - List all sessions
- `session:attach` - Attach to session
- `session:detach` - Detach from session
- `session:stop` - Stop session
- `session:delete` - Delete session
- `terminal:input` - Send terminal input
- `terminal:resize` - Resize terminal

**Server → Client:**
- `users:list` - Available users list
- `session:created` - Session created
- `session:list` - Sessions list
- `session:status` - Session status changed
- `session:deleted` - Session deleted
- `terminal:output` - Terminal output
- `file:uploaded` - File uploaded
- `error` - Error message

## Development

### Setup
```bash
npm install
cp .env.example .env
```

### Run
```bash
npm start
```

### Lint
```bash
npm run lint
npm run lint:fix
```

### Project Structure
```
claude-code-monitor/
├── server.js              # Main server
├── lib/                   # Backend modules
│   ├── logger.js          # Winston logging
│   ├── database.js        # SQLite setup
│   ├── sessions-db.js     # Session data layer
│   ├── pty-manager.js     # PTY process manager
│   └── users.js           # User enumeration
├── public/                # Frontend
│   ├── index.html         # UI structure
│   ├── style.css          # Styling
│   └── app.js             # Client logic
├── logs/                  # Log files
├── uploads/               # Temporary uploads
└── sessions.db            # SQLite database
```

## License

MIT

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Follow the DEV_PLAN.md structure
4. Run linting before committing
5. Submit a pull request

## Support

- **Documentation**: See docs in this repository
- **Issues**: Report on GitHub Issues
- **Troubleshooting**: See TROUBLESHOOTING.md

## Credits

Built for monitoring Claude Code sessions over Tailscale networks.

## Version

Current version: 0.1.0

See CHANGELOG.md for version history.
