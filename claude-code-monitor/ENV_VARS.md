# Environment Variables

## Server Configuration

### PORT
- **Type**: Number
- **Default**: 3456
- **Description**: Port number for HTTP server
- **Required**: Yes

### HOST
- **Type**: String
- **Default**: 0.0.0.0
- **Description**: Bind address (0.0.0.0 for all interfaces, accessible via Tailscale)
- **Required**: Yes

### NODE_ENV
- **Type**: String
- **Default**: development
- **Options**: development, production
- **Description**: Node environment mode
- **Required**: Yes

## Session Configuration

### MAX_SESSIONS
- **Type**: Number
- **Default**: 10
- **Description**: Maximum number of concurrent sessions allowed
- **Required**: Yes

### SESSION_OUTPUT_BUFFER_SIZE
- **Type**: Number
- **Default**: 1000
- **Description**: Number of terminal output lines to buffer per session
- **Required**: Yes

## File Upload Configuration

### UPLOAD_MAX_FILE_SIZE
- **Type**: Number (bytes)
- **Default**: 104857600 (100MB)
- **Description**: Maximum file upload size in bytes
- **Required**: Yes

### UPLOAD_DIR
- **Type**: String (path)
- **Default**: ./uploads
- **Description**: Temporary directory for file uploads
- **Required**: Yes

## Logging Configuration

### LOG_LEVEL
- **Type**: String
- **Default**: info
- **Options**: error, warn, info, debug
- **Description**: Winston logging level
- **Required**: Yes

### LOG_DIR
- **Type**: String (path)
- **Default**: ./logs
- **Description**: Directory for log files
- **Required**: Yes

### LOG_MAX_FILES
- **Type**: String
- **Default**: 14d
- **Description**: Maximum log file retention (14 days)
- **Required**: Yes

### LOG_MAX_SIZE
- **Type**: String
- **Default**: 20m
- **Description**: Maximum log file size before rotation
- **Required**: Yes

## Database Configuration

### DB_PATH
- **Type**: String (path)
- **Default**: ./sessions.db
- **Description**: Path to SQLite database file
- **Required**: Yes

## Process Configuration

### PROCESS_KILL_TIMEOUT
- **Type**: Number (milliseconds)
- **Default**: 5000
- **Description**: Time to wait for SIGTERM before sending SIGKILL
- **Required**: Yes

### PTY_COLS
- **Type**: Number
- **Default**: 80
- **Description**: Default terminal columns for PTY
- **Required**: Yes

### PTY_ROWS
- **Type**: Number
- **Default**: 24
- **Description**: Default terminal rows for PTY
- **Required**: Yes
