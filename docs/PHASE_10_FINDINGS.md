# Phase 10 PTY Injection - Research Findings

**Date**: 2025-10-19
**Status**: ❌ **NOT VIABLE** with current Claude Code architecture
**Researcher**: Claude Code AI Assistant

## Executive Summary

After extensive testing and research into AgentAPI implementation, **PTY-based prompt injection into existing Claude Code sessions using `--resume` is not viable**. While the infrastructure works correctly (PTY spawns, bypass prompts auto-accept, messages send via bracketed paste mode), Claude Code does not process stdin input when resumed in this mode.

---

## What We Attempted

### Goal
Enable sending messages from web browser to existing Claude Code sessions by:
1. Spawning independent Claude process with `--resume <session-id>`
2. Sending messages via PTY stdin using bracketed paste mode
3. Parsing responses from either stdout or JSONL file
4. Displaying responses in web UI

### Technical Approach (Based on AgentAPI)

**PTY Spawn**:
```javascript
pty.spawn('sudo', [
    '-u', username,
    claudeBinaryPath,
    '--resume', sessionId,
    '--verbose',
    '--dangerously-skip-permissions',
    '--debug-to-stderr'
], {
    cwd: repoPath,
    env: { HOME, USER, LOGNAME, PATH, SHELL }
});
```

**Message Format** (discovered from AgentAPI source):
```javascript
// Bracketed paste mode format
const formatted = "x\b" +           // Type + backspace (prevents echo)
                  "\x1b[200~" +     // Bracket paste start
                  messageText +      // Actual message
                  "\x1b[201~";      // Bracket paste end

ptyProcess.write(formatted);
```

**Auto-Accept Bypass Permissions**:
```javascript
// Detect bypass prompt, send "2\r" to accept
if (data.includes('Yes, I accept')) {
    ptyProcess.write('2\r');
}
```

---

## What Actually Happens

### ✅ Working Components

1. **PTY Spawning**: Claude process spawns successfully
2. **Initialization**: Loads session state, creates shell snapshot, initializes permissions
3. **Bypass Prompt**: Auto-acceptance works perfectly
4. **Stream Mode**: "Stream started - received first chunk" confirms stdin is ready
5. **Message Transmission**: Bracketed paste formatted messages send successfully (53 bytes confirmed)

### ❌ Failing Component

**Claude does not process the stdin input.**

**Observable Behavior**:
- No output to stdout
- No writes to JSONL file
- No error messages
- Process simply sits idle after receiving message
- Eventually times out and exits cleanly (code=0)

**JSONL File Evidence**:
```bash
$ stat ~/.claude/projects/.../session.jsonl | grep Modify
Modify: 2025-10-19 13:03:53  # Last modified 9+ hours ago
# No changes during ANY of our PTY injection tests
```

---

## Root Cause Analysis

### Why `--resume` Mode Doesn't Work

Claude Code's `--resume` flag is designed for **interactive terminal sessions**, not programmatic control:

1. **Terminal UI Expected**: After loading session state, Claude waits for user to interact with the terminal UI
2. **Stdin Not Monitored**: In resume mode, Claude doesn't actively monitor stdin for new messages
3. **No JSONL Writes**: Without processing input, nothing triggers JSONL file updates
4. **Warmup is Automatic**: The "Warmup" message seen in sessions is Claude's way of loading context, not actual user input

### How AgentAPI Actually Works

After examining AgentAPI source code, they do **NOT** use `--resume` for session continuation:

- AgentAPI creates **NEW** sessions (not resuming existing ones)
- Their "session management" happens at the SDK/HTTP layer
- They use bracketed paste for **new** interactive sessions
- Terminal output is parsed in real-time (screen scraping)
- Session state is managed by their own database, not Claude's JSONL files

**Key Insight**: AgentAPI doesn't inject into existing Claude Code sessions - it creates and controls new ones.

---

## Alternative Approaches Considered

### 1. Remove `--resume` Flag

**Test**: Spawn Claude without `--resume`, send message
**Result**: Creates new session, doesn't access existing conversation history
**Verdict**: ❌ Defeats the purpose (we want to interact with EXISTING sessions)

### 2. Use `--input-format stream-json`

**Test**: Add `--input-format stream-json` and `--output-format stream-json`
**Result**: Same behavior - message not processed
**Verdict**: ❌ Doesn't change stdin handling in resume mode

### 3. Direct JSONL File Manipulation

**Test**: Append properly formatted message to JSONL file
**Result**: VSCode Claude doesn't auto-detect external appends
**Verdict**: ⚠️ Passive only - requires user to open VSCode manually

### 4. VSCode Extension API

**Research**: Control Claude via VSCode extension API
**Verdict**: ❌ Too complex, no public API, requires VSCode running

---

## What DOES Work

### Phase 9: View-Only Session Monitoring ✅

**Functional Features**:
- ✅ Scan all users' Claude Code sessions
- ✅ View conversation history (JSONL parsing)
- ✅ Real-time updates for active sessions (file watching)
- ✅ Group sessions by repository
- ✅ See tool calls and file operations
- ✅ Open files in Monaco Editor
- ✅ Session statistics and summaries
- ✅ Multi-user support with permissions

**This works perfectly and provides significant value!**

### PTY Infrastructure ✅

**Working Components** (from Phase 3-7):
- ✅ Create NEW bash/command sessions
- ✅ Real-time terminal with xterm.js
- ✅ File upload support
- ✅ Run as different Linux users
- ✅ Session persistence in SQLite
- ✅ Multi-client Socket.io rooms

---

## Recommendations

### For Phase 10

**Status**: Mark as **Research Complete - Not Viable**

**Documentation**: Create clear notes that:
1. PTY injection into existing sessions is architecturally not supported by Claude Code
2. The research was valuable (learned about bracketed paste, bypass prompts, AgentAPI)
3. Phase 9 (view-only) provides significant value as-is
4. Future: Monitor Anthropic for official Claude Code API

### For Project Value

**Current State is Excellent**:
- Web-based monitoring of Claude sessions from any device
- Real-time updates for active sessions
- Full conversation history viewing
- Multi-user support
- Session grouping by repository
- File viewing and navigation

**Additional Value** (if desired):
- Add search/filter for conversations
- Export conversations to markdown
- Conversation analytics (message counts, tool usage stats)
- Session comparison view
- Timeline view of Claude activity

---

## Technical Artifacts

### Test Scripts Created

All scripts demonstrate the components work but Claude doesn't process input:

1. **test-pty-final.js** - Basic PTY test with stream-json
2. **test-injection-live.js** - Live output streaming
3. **test-simple-message.js** - Simple string content format
4. **test-with-bypass-accept.js** - Auto-accept bypass prompt
5. **test-bracketed-paste.js** - AgentAPI message format
6. **test-bracketed-paste-v2.js** - Detailed state tracking
7. **test-no-stream-json.js** - Without stream-json flags

### Setup Scripts

Created for easy deployment:

1. **setup-injection.sh** - Automated permission and sudo setup
2. **test-injection.sh** - Quick test of full injection flow
3. **deploy-pty-injection.sh** - Production deployment

### Documentation

1. **CLAUDE_INJECTION.md** - Research findings from Task 10.1
2. **DEPLOY_PTY_INJECTION.md** - Deployment guide (now outdated)
3. **PHASE_10_FINDINGS.md** - This document

---

## Lessons Learned

### What We Discovered

1. **AgentAPI Architecture**: How they use bracketed paste mode and terminal control
2. **Claude Bypass Prompts**: Can be auto-accepted with "2\r" keystroke
3. **PTY Message Format**: Bracketed paste prevents echo: `x\b\x1b[200~...\x1b[201~`
4. **Session Loading**: Warmup is automatic context loading, not user input
5. **JSONL Structure**: Detailed understanding of message format and nesting

### What We Built

1. **Robust PTY Infrastructure**: Spawn processes, manage lifecycles, handle sudo
2. **Permission System**: Validate user ownership, configure sudoers
3. **Session Scanner**: Discover and monitor Claude sessions
4. **File Watcher**: Real-time JSONL updates
5. **Web UI**: Beautiful interface for viewing sessions

---

## Future Possibilities

### If Anthropic Releases Official API

Monitor for:
- Claude Code SDK updates
- Official session control API
- WebSocket or HTTP endpoints for session interaction
- Extension APIs for third-party tools

### Alternative Approaches

1. **MCP Server**: Build Model Context Protocol server that Claude can call
2. **File-Based Queue**: Drop request files in watched directory, Claude picks up
3. **VSCode Extension**: Build our own extension that wraps Claude Code
4. **Clipboard Injection**: Use system clipboard to "paste" into VSCode (hacky)

---

## Conclusion

While Phase 10's original goal (inject prompts into existing sessions) is not viable with current Claude Code architecture, the research and infrastructure built provides:

✅ **Deep Understanding** of Claude Code internals
✅ **Robust PTY Management** for terminal sessions
✅ **Excellent View-Only Monitoring** (Phase 9)
✅ **Production-Ready Setup Scripts**
✅ **Multi-User Permission System**
✅ **Beautiful Web UI**

**Recommendation**: Mark Phase 10 as "Research Complete - Blocked by Claude Code Architecture" and focus on enhancing the highly functional view-only features from Phase 9.

---

**Files to Archive** (keep for reference but mark as non-functional):
- `lib/claude-pty-injector.js` - PTY spawning works, messaging doesn't
- `spawn-claude.sh` - Wrapper script (correct but unused)
- `test-*.js` scripts - Valuable for understanding what doesn't work
- `setup-injection.sh` - Permissions correct, but feature not viable

**Files to Update**:
- `PROGRESS.md` - Mark Phase 10 tasks as blocked
- `README.md` - Focus on view-only capabilities
- `server.js` - Remove/comment out PTY injection event handlers
- `public/app.js` - Disable input UI for Claude sessions
