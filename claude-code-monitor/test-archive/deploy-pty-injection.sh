#!/bin/bash
# Deploy PTY injection with wrapper script

set -e

echo "=== Deploying PTY Injection Files ==="

# Copy wrapper script
echo "Copying wrapper script..."
sudo cp spawn-claude.sh /opt/claude-monitor/
sudo chmod +x /opt/claude-monitor/spawn-claude.sh
echo "✓ Wrapper script deployed"

# Copy updated PTY injector
echo "Copying PTY injector..."
sudo cp -f lib/claude-pty-injector.js /opt/claude-monitor/app/lib/
echo "✓ PTY injector deployed"

# Verify files
echo ""
echo "Verifying deployment..."
ls -la /opt/claude-monitor/spawn-claude.sh
echo ""
sudo head -5 /opt/claude-monitor/spawn-claude.sh
echo ""

# Restart service
echo "Restarting service..."
sudo systemctl restart claude-monitor

# Wait for service to start
sleep 3

# Check status
echo ""
echo "=== Service Status ==="
sudo systemctl status claude-monitor --no-pager | head -20

echo ""
echo "=== Recent Logs ==="
sudo journalctl -u claude-monitor --since "30 seconds ago" --no-pager | tail -20

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Open browser to http://localhost:3456"
echo "2. Click 'Claude Code' tab"
echo "3. Select an INACTIVE Claude session (not this one)"
echo "4. Send a test message"
echo "5. Watch for response in the conversation view"
