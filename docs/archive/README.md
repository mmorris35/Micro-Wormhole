# Archived Documentation

This directory contains historical documentation from development phases that were superseded by better approaches.

## Phase 10 Research (October 2025)

Phase 10 originally attempted to inject prompts into **existing** Claude Code sessions using the `--resume` flag. After extensive research and testing, this approach was found to be non-viable.

### Why Resume Approach Didn't Work

1. Claude's `--resume` mode is designed for interactive terminal UI
2. Stdin input is not processed when resuming sessions
3. No JSONL writes occur without processing input
4. AgentAPI (the only known working solution) creates NEW sessions, doesn't resume existing ones

### Key Research Findings

- **Bracketed paste mode** is the correct format for messages
- **Bypass permissions** can be auto-accepted with `'2\r'` keystroke
- **Session detection** via JSONL file scanning works reliably
- **8-second warmup** allows Claude to load full repo context

### Replacement: Phase 11

Phase 11 successfully implements the same functionality (browser-based Claude interaction with full repo context) by creating **NEW** sessions instead of resuming existing ones.

**Result**: Same user experience, simpler implementation, actually works!

## Files

- `DEPLOY_PTY_INJECTION.md` - Deployment guide for resume approach (outdated)
- See also: `PHASE_10_FINDINGS.md` and `PHASE_10_STATUS.md` in parent docs directory

## Lessons Learned

Sometimes the "obvious" approach (resume existing sessions) isn't viable, and a different approach (create new sessions) provides the same value with less complexity.

The research time was valuable - we learned about Claude Code internals, AgentAPI methods, and built robust PTY infrastructure that powers Phase 11.
