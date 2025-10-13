# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-10-13

### Initial Release

#### Added
- Multi-session management with concurrent sessions
- Multi-user support with sudo-based user switching
- Real-time terminal with xterm.js and Socket.io
- File upload via button, drag-and-drop, and paste
- iOS-compatible paste upload
- Session persistence with SQLite database
- Responsive UI for desktop, tablet, and mobile
- User enumeration and validation
- Graceful shutdown handling
- Winston logging with daily rotation
- Health check and status endpoints
- Systemd service configuration
- Installation script
- Comprehensive documentation

#### Features
- Create/stop/delete sessions
- Attach/detach from sessions
- Terminal input/output streaming
- Session list with real-time updates
- Status badges (running, stopped, completed, failed)
- File upload progress indicator
- Error handling and validation
- User isolation and permission boundaries
- Max session limit
- File size limits (100MB)

#### Documentation
- Installation guide
- Sudo configuration guide
- Environment variables reference
- Troubleshooting guide
- Development plan
- End-to-end test checklist

### Technical Details
- Node.js v20.x
- Express ^4.18.0
- Socket.io ^4.6.0
- node-pty ^1.0.0
- better-sqlite3 ^9.0.0
- xterm.js ^5.3.0

### Known Issues
- None

### Security
- User isolation via sudo
- File upload validation
- Input sanitization
- Limited sudo permissions
