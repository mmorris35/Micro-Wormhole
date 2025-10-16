# Quick Start - Prompt Injection Feature

Chat with Claude Code from your browser in 3 easy steps!

## Step 1: Setup (One-Time)

Run the automated setup script:

```bash
cd claude-code-monitor
./setup-injection.sh
```

This script:
- Finds your Claude binary
- Sets up permissions automatically
- Tests everything works
- Takes ~10 seconds

## Step 2: Start Server

```bash
npm start
```

## Step 3: Use It!

1. Open http://localhost:3456 in your browser
2. Click the **"Claude Sessions"** tab
3. Click on any session to view it
4. Type a message at the bottom
5. Click **"Send to Claude"**
6. Watch Claude respond in real-time!

## Testing

Want to verify everything works before using?

```bash
./test-injection.sh
```

This checks:
- Server is running
- Claude sessions exist
- Shows you what sessions are available

## Troubleshooting

**Problem**: "Could not find Claude binary"
- **Fix**: Make sure Claude Code extension is installed in VSCode

**Problem**: "Sudo access test failed"
- **Fix**: Run `./setup-injection.sh` again

**Problem**: "No Claude sessions found"
- **Fix**: Start a Claude Code conversation in VSCode first

**Problem**: Message input not showing
- **Fix**: Make sure you clicked on a session in the "Claude Sessions" tab (not PTY Sessions)

## What You Can Do

- ✅ Send messages to Claude
- ✅ Ask questions about your code
- ✅ Request code changes
- ✅ Attach files from your repository
- ✅ See responses in real-time
- ✅ View typing indicator while Claude thinks
- ✅ Multiple concurrent sessions

## Example Messages to Try

```
What files are in this repository?
```

```
Explain the main server.js file
```

```
Add a feature to count active sessions
```

```
What's the purpose of the logger module?
```

## Need Help?

Check the full documentation:
- Main README: [../README.md](../README.md)
- Architecture: [../CLAUDE.md](../CLAUDE.md)
- Sudo Setup: [../docs/SUDO_INJECTION_SETUP.md](../docs/SUDO_INJECTION_SETUP.md)
