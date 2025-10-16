#!/bin/bash
# Automated setup for Claude Code prompt injection
# Makes it easy to use the injection feature

set -e

echo "🚀 Claude Code Prompt Injection - Easy Setup"
echo "============================================="
echo ""

# Get current user
CURRENT_USER=$(whoami)
echo "✓ Running as user: $CURRENT_USER"

# Find Claude binary
echo ""
echo "📍 Locating Claude binary..."
CLAUDE_BINARY=$(find ~/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude -type f 2>/dev/null | head -1)

if [ -z "$CLAUDE_BINARY" ]; then
    echo "❌ ERROR: Could not find Claude binary"
    echo "   Make sure Claude Code extension is installed"
    exit 1
fi

echo "✓ Found: $CLAUDE_BINARY"

# Test if we can run it
echo ""
echo "🔍 Testing Claude binary..."
if ! "$CLAUDE_BINARY" --help &>/dev/null; then
    echo "❌ ERROR: Claude binary not executable"
    exit 1
fi
echo "✓ Claude binary works"

# Create simple sudo rule for current user only
SUDOERS_FILE="/etc/sudoers.d/claude-injection-$CURRENT_USER"
echo ""
echo "🔐 Setting up sudo permissions..."
echo "   This allows the web app to run Claude as your user"
echo "   File: $SUDOERS_FILE"
echo ""

# Create sudoers content
SUDO_CONTENT="# Claude Code Injection - Auto-generated
# Allows $CURRENT_USER to run Claude binary for prompt injection
$CURRENT_USER ALL=($CURRENT_USER) NOPASSWD: $(dirname "$CLAUDE_BINARY")/claude"

echo "$SUDO_CONTENT" | sudo tee "$SUDOERS_FILE" > /dev/null
sudo chmod 0440 "$SUDOERS_FILE"

# Validate sudoers file
if ! sudo visudo -c -f "$SUDOERS_FILE" &>/dev/null; then
    echo "❌ ERROR: Invalid sudoers configuration"
    sudo rm -f "$SUDOERS_FILE"
    exit 1
fi

echo "✓ Sudo configuration created"

# Test sudo access
echo ""
echo "🧪 Testing sudo access..."
if sudo -u "$CURRENT_USER" "$CLAUDE_BINARY" --help &>/dev/null; then
    echo "✓ Sudo access works!"
else
    echo "❌ ERROR: Sudo access test failed"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Start the server:  npm start"
echo "   2. Open browser:      http://localhost:3456"
echo "   3. Click 'Claude Sessions' tab"
echo "   4. Select a session and start chatting!"
echo ""
echo "💡 Tip: The message input appears at the bottom when viewing a session"
echo ""
