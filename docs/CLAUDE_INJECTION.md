# Claude Code Prompt Injection Research

**Date**: 2025-10-14
**Researcher**: Claude (Phase 10, Task 10.1)

## Executive Summary

After thorough research, **direct CLI injection into running Claude Code sessions is NOT FEASIBLE** due to process ownership and VSCode extension architecture. The recommended approach is **JSONL File Append** with limitations.

---

## Research Findings

### Claude Binary Interface

**Location**: `~/.vscode-server/extensions/anthropic.claude-code-<version>/resources/native-binary/claude`

**Versions Found**:
- `anthropic.claude-code-2.0.13-linux-x64` (user: mike)
- `anthropic.claude-code-2.0.14-linux-x64` (user: mmn)

**Key Arguments**:
- `--resume <session-id>` - Resume existing session
- `--input-format stream-json` - Accept JSONL input via stdin
- `--output-format stream-json` - Output JSONL via stdout
- `--print` - Non-interactive mode (required for pipes)
- `--debug-to-stderr` - Debug logging
- `--permission-mode <mode>` - Permission handling
- `--model <model>` - Specify model

**Example Running Process** (from `ps aux`):
```bash
/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.14-linux-x64/resources/native-binary/claude \
    --output-format stream-json \
    --verbose \
    --input-format stream-json \
    --append-system-prompt "..." \
    --model default \
    --debug-to-stderr \
    --permission-prompt-tool stdio \
    --resume 9a6762a5-b7d7-4b00-ba8c-9afbbd346a0a \
    --permission-mode default \
    --debug
```

---

## Input Mechanism Analysis

### Method 1: Direct CLI Injection (stdin)

**Theory**: Spawn `claude --resume <id> --print --input-format stream-json` and write to stdin

**Status**: ❌ **NOT FEASIBLE**

**Reasons**:
1. **Process Conflict**: When VSCode is connected, Claude process is already running
2. **Single Session Owner**: Only one process can "own" a session at a time
3. **State Synchronization**: Running Claude process maintains in-memory state that wouldn't sync with file-based resume
4. **VSCode Extension Lock**: The extension maintains exclusive connection to the Claude process
5. **Permission System**: Claude's permission prompts go through VSCode's stdio interface

**Test Result**: Would fail with error or create conflicting state

---

### Method 2: JSONL File Append

**Theory**: Directly append messages to ~/.claude/projects/<repo>/<session-id>.jsonl

**Status**: ⚠️ **PARTIALLY FEASIBLE** (Read-only)

**How It Works**:
```bash
# Append user message to JSONL file
echo '{"parentUuid":"<parent-id>","type":"user","message":{"role":"user","content":[{"type":"text","text":"Hello"}]},"timestamp":"2025-10-14T...","sessionId":"<id>","uuid":"<new-uuid>","userType":"external"}' >> ~/.claude/projects/<repo>/<session-id>.jsonl
```

**Pros**:
- ✅ Simple implementation
- ✅ No process conflicts
- ✅ Always works (file system access)
- ✅ Messages appear in conversation history

**Cons**:
- ❌ **Passive only** - Claude Code may not process the message automatically
- ❌ User must manually trigger Claude to read/respond (unclear if it auto-detects)
- ❌ No guarantee Claude will respond
- ❌ Cannot force Claude to process the queue
- ❌ File watcher behavior unknown (may not trigger on external append)

**Limitations**:
1. **No Active Injection**: We can write to the file, but cannot force Claude to process it
2. **Unknown Auto-Detection**: Unclear if Claude Code detects external JSONL appends
3. **Read-Only Interaction**: This is more like "adding to history" than "sending a message"
4. **No Response Guarantee**: Even if message is added, Claude may not respond unless user interacts

---

### Method 3: VSCode Extension API

**Theory**: Use VSCode extension API to send commands to Claude Code extension

**Status**: ❌ **NOT FEASIBLE** (Too Complex)

**Reasons**:
1. Requires VSCode server running
2. Needs extension API access (complex authentication)
3. No documented public API for Claude Code extension
4. Would require running VSCode headlessly or via remote API
5. Overly complex for our use case

---

## JSONL Format Analysis

**Required Fields for User Message**:
```json
{
  "parentUuid": "<uuid-of-previous-message>",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/path/to/repo",
  "sessionId": "<session-uuid>",
  "version": "2.0.14",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "Your message here"
      }
    ]
  },
  "uuid": "<new-unique-uuid>",
  "timestamp": "2025-10-14T02:30:00.000Z"
}
```

**Critical Fields**:
- `parentUuid` - Must reference the last message's UUID (maintains conversation chain)
- `sessionId` - Must match the session being appended to
- `uuid` - Must be unique (generate new UUID v4)
- `timestamp` - ISO 8601 format
- `message.content` - Array of content blocks

---

## Recommended Approach

### Option B: JSONL File Append (Limited Implementation)

**Decision**: Implement JSONL append with **clear limitations documented to user**

**Implementation**:
1. Parse existing JSONL to get last message UUID
2. Generate new UUID for message
3. Create properly formatted JSON message
4. Append to JSONL file with proper newline
5. **Display warning**: "Message added to conversation file. Claude may not automatically process it unless you interact with the session."

**User Experience**:
- User can "send" a message through web interface
- Message appears in conversation viewer immediately (we re-read the file)
- **Warning displayed**: "Message sent to file. Open VSCode and resume session for Claude to process it."
- User must open VSCode and either:
  - Continue the conversation manually, OR
  - Hope that Claude auto-detects the file change (untested)

**Benefits**:
- Simple, reliable implementation
- No process conflicts
- Works for all sessions (active or inactive)
- Provides value: user can "queue" messages for later

**Limitations** (must communicate clearly):
- ⚠️ **Passive injection only**
- ⚠️ Requires user to open VSCode for Claude to respond
- ⚠️ No guarantee of automatic processing
- ⚠️ This is a "queue message" feature, not "live chat"

---

## Alternative: Enhanced Viewing Only

**Recommendation**: If JSONL append proves too limited, **stick with Phase 9 view-only features**

**Rationale**:
- Viewing works perfectly (Phase 9 complete)
- Injection without guaranteed processing may frustrate users
- Better to have excellent read-only access than broken bidirectional
- Can revisit if VSCode extension API becomes available

---

## Security Considerations

**If implementing JSONL append**:

1. **File Permissions**:
   - Must write as session owner user (sudo)
   - Preserve file ownership and permissions
   - Use `sudo -u <user> tee -a <file>` for appending

2. **Input Validation**:
   - Sanitize message content (prevent JSONL injection)
   - Validate session ID format (UUID)
   - Verify user owns the session (username match)

3. **UUID Generation**:
   - Must use crypto-secure UUID v4
   - Ensure uniqueness (check existing UUIDs)

4. **File Integrity**:
   - Verify JSONL file is valid before appending
   - Atomic append (prevent partial writes)
   - Backup original file (optional)

---

## Testing Plan (If Proceeding with JSONL Append)

1. **Manual Test**:
   ```bash
   # Read last message UUID from JSONL
   tail -1 ~/.claude/projects/<repo>/<id>.jsonl | jq -r .uuid

   # Append new message
   echo '{"parentUuid":"<last-uuid>","type":"user",...}' >> file.jsonl

   # Check if Claude detects it (open VSCode and observe)
   ```

2. **Automated Test**:
   - Append message to inactive session
   - Verify file updated
   - Open VSCode
   - Check if message appears
   - Document whether Claude auto-processes

---

---

## Method 4: PTY-Based Claude Control (AgentAPI Approach)

**Theory**: Spawn our own Claude process in a pseudoterminal (PTY), send input via terminal stdin, capture output via terminal stdout

**Status**: ✅ **FEASIBLE** - Proven by AgentAPI

**Inspiration**: [AgentAPI](https://github.com/coder/agentapi) by Coder

**How It Works**:
```
Browser Request → Server → PTY Manager → node-pty → Spawn Claude
                                              ↓
     Parse Response ← Terminal Output ← Claude stdout
```

**Architecture**:
1. **Spawn Claude in PTY**: Use node-pty to create pseudoterminal
2. **Control via Terminal I/O**: Send keystrokes to stdin, read from stdout
3. **Parse Terminal Output**: Extract messages from terminal snapshot
4. **Independent Process**: We spawn our own Claude, not injecting into VSCode's

**Key Advantages**:
- ✅ **No Process Conflicts**: We spawn our own instance, VSCode keeps theirs
- ✅ **Full Bidirectional Communication**: Can send and receive messages
- ✅ **We Already Have Infrastructure**: node-pty used in Phase 3-7
- ✅ **Proven Implementation**: AgentAPI demonstrates this works
- ✅ **Real Interaction**: Not passive like JSONL append

**Implementation Approach**:
```javascript
// Spawn Claude in PTY
const pty = require('node-pty');

const claudeProcess = pty.spawn('claude', [
    '--resume', sessionId,
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--print'  // Non-interactive mode
], {
    name: 'xterm-color',
    cwd: repoPath,
    env: process.env
});

// Send message via stdin
const message = JSON.stringify({
    type: 'user',
    content: 'Your message here'
});
claudeProcess.write(message + '\n');

// Capture output
let output = '';
claudeProcess.on('data', (data) => {
    output += data;
    // Parse JSONL from output
    const lines = output.split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            try {
                const message = JSON.parse(line);
                // Handle Claude's response
                handleResponse(message);
            } catch (e) {
                // Not valid JSON, skip
            }
        }
    });
});
```

**AgentAPI Technical Details**:
- Uses in-memory terminal emulator
- Translates API calls to terminal keystrokes
- Parses terminal output into structured messages
- Maintains conversation state across API calls
- Provides HTTP endpoints: `/messages`, `/message`, `/status`, `/events`

**Why This Solves Our Problem**:
1. **Independent Process**: No conflict with VSCode's Claude instance
2. **Full Control**: We manage the process lifecycle
3. **Bidirectional**: Can send prompts and receive responses
4. **Existing Infrastructure**: Reuses our PTY manager from Phase 3
5. **Proven Concept**: AgentAPI is working implementation

**Limitations**:
- ⚠️ Spawns additional Claude process (memory overhead)
- ⚠️ Session state syncs via JSONL file (both processes read same file)
- ⚠️ Need to handle concurrent access to session file
- ⚠️ May have slight delay compared to direct VSCode interaction

**Security Considerations**:
- Process spawned as session owner via sudo (existing pattern)
- PTY isolated per session (existing pattern)
- Uses same permission model as Phase 3-7 sessions
- Claude binary execution controlled via sudoers

---

## Conclusion (REVISED)

**Final Recommendation for Phase 10**: ✅ **PROCEED WITH PTY-BASED APPROACH**

**Selected Option**: **Method 4 - PTY-Based Claude Control** (AgentAPI approach)

**Rationale**:
1. Proven implementation exists (AgentAPI)
2. We already have node-pty infrastructure (Phase 3-7)
3. Provides true bidirectional interaction (not passive)
4. No process conflicts (spawn our own instance)
5. Reuses existing PTY manager architecture

**Implementation Plan**:
1. **Task 10.2**: Create PTY-based Claude injector module
2. **Task 10.3**: Input UI (unchanged)
3. **Task 10.4**: Parse PTY output for responses (instead of polling JSONL)
4. **Task 10.5**: Documentation

**Next Steps**:
- Proceed with Phase 10 implementation using PTY approach
- Adapt tasks 10.2-10.5 to use PTY instead of direct CLI
- Reference AgentAPI architecture as implementation guide

---

## Technical Notes

- AgentAPI demonstrates PTY-based control is viable
- node-pty already in project dependencies (Phase 3)
- PTY manager pattern already established (lib/pty-manager.js)
- Session JSONL file serves as shared state between processes
- VSCode and our PTY process can coexist peacefully

---

## References

- **AgentAPI**: https://github.com/coder/agentapi (PTY-based Claude control)
- Claude binary location: `~/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude`
- JSONL conversation files: `~/.claude/projects/<repo>/<session-uuid>.jsonl`
- Extension versions observed: 2.0.13, 2.0.14
- node-pty: Used in Micro-Wormhole Phase 3-7 for session management
