# Sudo Configuration for Claude PTY Injection

To allow the web monitor to spawn Claude processes for injection, update the sudo configuration.

## Add to /etc/sudoers.d/claude-monitor

```bash
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add Claude binary to allowed commands:

```
# Existing lines...
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown, /home/*/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude

# Update existing rule (or add if not present)
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

## Test Configuration

```bash
# Test as claude-monitor user
sudo -u claude-monitor sudo -u mmn /home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.14-linux-x64/resources/native-binary/claude --help

# Should output Claude help text
```

## Security Notes

- Only claude-monitor service user can execute Claude binary
- Can only execute as users in CLAUDE_USERS alias
- No password required (for automated operation)
- Wildcards allow for version updates without config changes
- Each PTY spawned runs as the session owner (isolation)
