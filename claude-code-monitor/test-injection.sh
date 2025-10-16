#!/bin/bash
# Quick test script for prompt injection feature

echo "🧪 Testing Prompt Injection Setup"
echo "=================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3456/api/health > /dev/null 2>&1; then
    echo "❌ Server is not running!"
    echo ""
    echo "Start it with:  cd claude-code-monitor && npm start"
    exit 1
fi

echo "✓ Server is running"

# Check for Claude sessions
echo ""
echo "📂 Looking for Claude Code sessions..."
SESSIONS_DIR="$HOME/.claude/projects"

if [ ! -d "$SESSIONS_DIR" ]; then
    echo "❌ No Claude sessions directory found"
    echo "   Start a Claude Code conversation first"
    exit 1
fi

SESSION_COUNT=$(find "$SESSIONS_DIR" -name "*.jsonl" 2>/dev/null | wc -l)

if [ "$SESSION_COUNT" -eq 0 ]; then
    echo "❌ No Claude sessions found"
    echo "   Start a Claude Code conversation first"
    exit 1
fi

echo "✓ Found $SESSION_COUNT Claude session(s)"

# List sessions
echo ""
echo "📋 Your Claude sessions:"
find "$SESSIONS_DIR" -name "*.jsonl" 2>/dev/null | while read -r session; do
    repo=$(basename "$(dirname "$session")")
    session_id=$(basename "$session" .jsonl)
    size=$(stat -f%z "$session" 2>/dev/null || stat -c%s "$session" 2>/dev/null)

    if [ "$size" -gt 0 ]; then
        echo "   ✓ $repo ($session_id) - Active"
    else
        echo "   ○ $repo ($session_id) - Empty"
    fi
done

echo ""
echo "✅ Everything looks good!"
echo ""
echo "🌐 Open in browser: http://localhost:3456"
echo ""
echo "How to use:"
echo "  1. Click 'Claude Sessions' tab"
echo "  2. Click on a session to view it"
echo "  3. Type a message at the bottom"
echo "  4. Click 'Send to Claude'"
echo "  5. Watch for Claude's response!"
echo ""
