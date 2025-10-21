#!/usr/bin/env node
// Test new session with RAW output capture

const pty = require('node-pty');
const fs = require('fs');

const username = 'mmn';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/AnarchistCookBook';
const userHome = `/home/${username}`;

console.log('=== Testing NEW Session - RAW Output ===\n');

const claudePty = pty.spawn('sudo', [
    '-u', username,
    binaryPath,
    '--verbose',
    '--dangerously-skip-permissions',
    '--debug-to-stderr'
], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: repoPath,
    env: {
        HOME: userHome,
        USER: username,
        LOGNAME: username,
        PATH: process.env.PATH,
        SHELL: '/bin/bash'
    }
});

console.log(`PTY PID: ${claudePty.pid}\n`);

let bypassSent = false;
let messageTime = null;

claudePty.onData((data) => {
    // Write ALL output to file
    fs.appendFileSync('/tmp/claude-raw-output.txt', data);

    // Also show on screen
    process.stdout.write(data);

    // Auto-accept bypass
    if (!bypassSent && data.includes('Yes, I accept')) {
        console.log('\n\n>>> AUTO-ACCEPTING BYPASS...\n\n');
        setTimeout(() => {
            claudePty.write('2\r');
            bypassSent = true;

            // Wait 3 seconds after bypass, then send message
            setTimeout(() => {
                console.log('\n\n>>> SENDING MESSAGE VIA BRACKETED PASTE...\n\n');
                messageTime = Date.now();

                const msg = 'What is this codebase? Give me a 2 sentence summary.';
                const formatted = "x\b\x1b[200~" + msg + "\x1b[201~";
                claudePty.write(formatted);

                console.log(`Sent: "${msg}"\n\n`);
            }, 3000);
        }, 500);
    }

    // After 10 seconds from message send, check for new session file
    if (messageTime && (Date.now() - messageTime > 10000)) {
        messageTime = null; // Only check once
        console.log('\n\n>>> Checking for new session JSONL file...\n');
        // Will check in exit handler
    }
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\n\n=== EXIT: ${exitCode} ===`);

    // Find newest JSONL file in AnarchistCookBook sessions
    const { execSync } = require('child_process');
    try {
        const newest = execSync(
            'ls -t /home/mmn/.claude/projects/-home-mmn-github-AnarchistCookBook/*.jsonl 2>/dev/null | head -1',
            { encoding: 'utf-8' }
        ).trim();

        if (newest) {
            console.log(`\nNewest session file: ${newest}`);
            const stat = fs.statSync(newest);
            console.log(`Last modified: ${stat.mtime}`);

            // Show last 3 lines
            const content = fs.readFileSync(newest, 'utf-8');
            const lines = content.trim().split('\n');
            console.log(`\nLast 3 lines of JSONL:\n`);
            lines.slice(-3).forEach((line, i) => {
                const obj = JSON.parse(line);
                console.log(`${i + 1}. Type: ${obj.type}, Message: ${obj.message?.content?.substring(0, 50) || obj.summary?.substring(0, 50) || 'N/A'}`);
            });
        }
    } catch (e) {
        console.log('Could not check JSONL files:', e.message);
    }

    console.log(`\nRaw output saved to: /tmp/claude-raw-output.txt`);
    process.exit(exitCode);
});

// 30 second timeout
setTimeout(() => {
    console.log('\n\nTIMEOUT - Killing PTY');
    claudePty.kill();
}, 30000);
