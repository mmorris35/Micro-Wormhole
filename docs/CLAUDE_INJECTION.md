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

## Conclusion

**Final Recommendation for Phase 10**:

**STOP IMPLEMENTATION** - Direct injection is not feasible as originally planned.

**Options**:
1. **Implement JSONL Append with Limitations** (if user accepts read-only queue)
2. **Cancel Phase 10** and keep Phase 9 (view-only) as final state
3. **Defer Phase 10** until VSCode extension API available

**Next Step**: Escalate to user for executive decision on whether to proceed with limited JSONL append or cancel Phase 10.

---

## Technical Notes

- Claude Code likely uses file watchers on JSONL files
- Unclear if external modifications trigger processing
- Testing required to determine auto-detection behavior
- VSCode extension maintains exclusive session control
- No documented API for external interaction

---

## References

- Claude binary location: `~/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude`
- JSONL conversation files: `~/.claude/projects/<repo>/<session-uuid>.jsonl`
- Extension versions observed: 2.0.13, 2.0.14
