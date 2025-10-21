# Deploy PTY Injection - Manual Steps

The PTY injection is **working correctly**! Testing confirmed:
- ✅ Wrapper script spawns Claude via PTY successfully
- ✅ Claude initializes properly
- ✅ Messages can be sent via stdin
- ✅ Responses written to JSONL (as designed)

## Deployment Commands

Run these commands to deploy to production:

```bash
cd /home/mmn/github/Micro-Wormhole/claude-code-monitor

# Copy wrapper script
sudo cp spawn-claude.sh /opt/claude-monitor/
sudo chmod +x /opt/claude-monitor/spawn-claude.sh

# Copy updated PTY injector
sudo cp -f lib/claude-pty-injector.js /opt/claude-monitor/app/lib/

# Restart service
sudo systemctl restart claude-monitor

# Verify deployment
sudo systemctl status claude-monitor
```

## Testing the Feature

**IMPORTANT**: You cannot inject into the ACTIVE session (1e154dd0-700c-4b6f-a696-6db132b5486a) because VSCode is currently using it. This is expected behavior.

### Test Steps:

1. **Open the web UI**: http://localhost:3456

2. **Go to Claude Code tab**

3. **Select an INACTIVE session** (not this one):
   - Look for sessions from other projects
   - Or create a new Claude Code session in a different project, then close VSCode

4. **Send a test message**: "Reply with just 'TEST OK'"

5. **Watch the conversation view** - the response will appear when Claude writes to the JSONL file

### What Happens Behind the Scenes:

1. Browser sends message via Socket.io
2. Backend spawns PTY with wrapper script (if not already running)
3. Wrapper script executes: `sudo -u <user> claude --resume <session-id>`
4. Claude initializes and loads session state
5. Message sent to Claude via PTY stdin (JSONL format)
6. Claude processes and writes response to conversation.jsonl
7. Phase 9 file watcher detects the change
8. Socket.io broadcasts update to browser
9. Browser displays the new message

### Debugging

If issues occur, check logs:

```bash
# Service logs
sudo journalctl -u claude-monitor -f

# Look for wrapper messages
sudo journalctl -u claude-monitor --since "1 minute ago" | grep WRAPPER

# Check PTY status
sudo journalctl -u claude-monitor --since "1 minute ago" | grep "Claude PTY"
```

## Key Findings from Testing

### Why We Can't Inject into Active Sessions

When a Claude Code session is active in VSCode, VSCode's Claude process has exclusive control. Attempting to inject via PTY creates a second Claude process trying to access the same session state, which causes conflicts.

**Solution**: Only inject into inactive/closed sessions.

### Response Handling

Claude does NOT output responses to stdout when using `--input-format stream-json`. Responses are written directly to the JSONL file. This is why:
- Phase 9 file watching is critical
- We don't parse PTY stdout for responses
- The browser relies on file change notifications

### Wrapper Script Approach

Direct PTY spawn with sudo was problematic. The wrapper script approach:
- Handles environment setup correctly
- Changes to repo directory before spawning Claude
- Provides better debugging output
- Works reliably in testing

## Files Updated

- `spawn-claude.sh` - Wrapper with `[WRAPPER]` debug logging
- `lib/claude-pty-injector.js` - Uses wrapper script, logs wrapper output

## Next Steps

After deploying, you can:
- Send messages to inactive Claude sessions from any device
- Monitor responses in real-time via the web UI
- Use this for remote collaboration or mobile access to Claude Code

---

**Phase 10: PTY-Based Prompt Injection** - Ready for Production ✅
