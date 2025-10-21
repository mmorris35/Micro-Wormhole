# Test Archive

This directory contains test scripts and research artifacts from Phase 10 development.

## Phase 10 Research Files

These test scripts were created during Phase 10 research to understand how to interact with Claude Code via PTY.

### Key Learnings

- **Bracketed paste mode works**: Format is `'x\b\x1b[200~' + message + '\x1b[201~'`
- **New sessions work better than resume**: `--resume` doesn't process stdin
- **8 second warmup**: Claude needs time to initialize with repo context
- **JSONL session detection**: Find newest .jsonl file to get session ID

### Test Scripts

- `test-phase-11-task-1.js` - ✅ Working test for Phase 11 simplified approach
- `test-bracketed-paste*.js` - Testing AgentAPI message format
- `test-new-session*.js` - Testing new session creation
- `test-pty-*.js` - Various PTY spawning tests
- `test-after-warmup.js` - Testing timing for warmup completion
- `test-simple-message.js` - Basic message format test
- `test-with-bypass-accept.js` - Auto-accepting bypass prompts
- `test-no-stream-json.js` - Testing without stream-json flags

### Scripts

- `spawn-claude.sh` - Wrapper script approach (not used in final solution)
- `deploy-*.sh` - Various deployment helpers
- `update-and-restart.sh` - Service restart helper

### Final Solution

The working approach is implemented in:
- `/lib/claude-pty-injector.js` - Simplified PTY manager
- `test-phase-11-task-1.js` - Comprehensive test that validates the approach

All these files are archived for reference but the final working code is in the main source tree.
