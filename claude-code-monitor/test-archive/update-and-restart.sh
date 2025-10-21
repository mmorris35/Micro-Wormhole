#!/bin/bash
# Quick script to copy updated files and show restart commands

echo "=== UI Bug Fixes Ready ==="
echo ""
echo "Fixed issues:"
echo "1. Event undefined error when clicking Claude sessions"
echo "2. Input box disabled for inactive sessions (now enabled)"
echo ""
echo "Files updated:"
echo "  - public/app.js"
echo ""
echo "To deploy, run these commands:"
echo ""
echo "  sudo cp -f public/app.js /opt/claude-monitor/app/public/"
echo "  sudo systemctl restart claude-monitor"
echo ""
echo "Then refresh your browser (Ctrl+Shift+R to clear cache)"
