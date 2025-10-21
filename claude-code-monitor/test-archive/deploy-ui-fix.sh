#!/bin/bash
echo "=== Deploying UI Fixes for Claude PTY Injection ==="
echo ""
echo "Fixed bugs:"
echo "  1. Undefined event error when clicking sessions"
echo "  2. Input disabled for inactive sessions (should be enabled)"
echo "  3. Message sending blocked for inactive sessions (should be allowed)"
echo ""
echo "Logic now:"
echo "  ✅ INACTIVE sessions → Can send messages (PTY injection)"
echo "  ❌ ACTIVE sessions → Cannot send (VSCode is using them)"
echo ""

sudo cp -f public/app.js /opt/claude-monitor/app/public/
echo "✓ Copied app.js"

sudo systemctl restart claude-monitor
echo "✓ Restarted service"

sleep 2
sudo systemctl status claude-monitor --no-pager | head -10
echo ""
echo "✓ Deployment complete!"
echo ""
echo "Next: Refresh browser (Ctrl+Shift+R) and test with an INACTIVE session"
