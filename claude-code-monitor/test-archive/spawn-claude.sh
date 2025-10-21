#!/bin/bash
# Wrapper script to spawn Claude for PTY injection
# Usage: spawn-claude.sh <username> <session-id> <repo-path>

set -e

USERNAME="$1"
SESSION_ID="$2"
REPO_PATH="$3"

echo "[WRAPPER] Starting with user=$USERNAME session=$SESSION_ID repo=$REPO_PATH" >&2

# Find latest Claude binary
CLAUDE_BINARY=$(ls -t /home/${USERNAME}/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | head -1)

if [ -z "$CLAUDE_BINARY" ]; then
    echo "[WRAPPER] ERROR: Could not find Claude binary for user $USERNAME" >&2
    exit 1
fi

echo "[WRAPPER] Found binary: $CLAUDE_BINARY" >&2

# Change to repo directory and run Claude as the user
if ! cd "$REPO_PATH"; then
    echo "[WRAPPER] ERROR: Could not cd to $REPO_PATH" >&2
    exit 1
fi

echo "[WRAPPER] Changed to directory: $(pwd)" >&2
echo "[WRAPPER] Executing Claude as $USERNAME..." >&2

# Send "yes" to any trust prompts automatically
echo "yes" | exec sudo -u "$USERNAME" "$CLAUDE_BINARY" \
    --resume "$SESSION_ID" \
    --input-format stream-json \
    --output-format stream-json \
    --verbose \
    --dangerously-skip-permissions \
    --debug-to-stderr
