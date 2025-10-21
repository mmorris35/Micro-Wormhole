#!/usr/bin/env node
// Test using bracketed paste mode like AgentAPI does

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');

const username = 'mmn';
const sessionId = '1907a3de-990e-47ce-b54c-1f1f674da75e';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/AnarchistCookBook';
const userHome = `/home/${username}`;

console.log('=== Testing Bracketed Paste Mode (AgentAPI Method) ===');
console.log(`Session: ${sessionId}`);
console.log('');

// Spawn Claude
const claudePty = pty.spawn('sudo', [
    '-u', username,
    binaryPath,
    '--resume', sessionId,
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--debug-to-stderr'
], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
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

let gotResponse = false;
let sentBypassAccept = false;
let sentMessage = false;

claudePty.onData((data) => {
    // Don't spam output, just show important parts
    if (data.includes('[DEBUG]')) {
        const match = data.match(/\[DEBUG\] ([^\r\n]+)/);
        if (match && !match[1].includes('Renaming') && !match[1].includes('Writing to temp')) {
            console.log('DEBUG:', match[1].substring(0, 100));
        }
    }

    if (data.includes('WARNING: Claude Code')) {
        console.log('  Bypass prompt detected...');
    }

    // Check for bypass permissions prompt
    if (!sentBypassAccept && (data.includes('Bypass Permissions mode') || data.includes('Yes, I accept'))) {
        console.log('  Accepting bypass prompt...\n');
        setTimeout(() => {
            claudePty.write('2\r');  // Select option 2 + Enter
            sentBypassAccept = true;
        }, 500);
    }

    // After accepting bypass, wait 2 seconds then send message
    if (sentBypassAccept && !sentMessage && data.includes('Stream started')) {
        setTimeout(() => {
            console.log('=== SENDING MESSAGE USING BRACKETED PASTE MODE ===\n');

            const messageText = 'Reply with exactly "BRACKETED PASTE OK"';

            // AgentAPI format:
            // 1. "x\b" - type and delete a character (prevents echo)
            // 2. "\x1b[200~" - bracketed paste start
            // 3. message content
            // 4. "\x1b[201~" - bracketed paste end
            const formatted = "x\b" + "\x1b[200~" + messageText + "\x1b[201~";

            claudePty.write(formatted);
            sentMessage = true;
            console.log(`Sent: "${messageText}"`);
            console.log('Waiting for response...\n');
        }, 2000);
    }

    // Check for ANY assistant response
    if (sentMessage && (data.includes('"type":"assistant"') || data.includes('"role":"assistant"') || data.includes('BRACKETED PASTE OK'))) {
        console.log('\n\n=== ✅ GOT RESPONSE! ===\n');
        console.log(data.substring(0, 500));
        gotResponse = true;
        setTimeout(() => {
            claudePty.kill();
            process.exit(0);
        }, 1000);
    }
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\n\nPTY EXIT: code=${exitCode}`);
    if (gotResponse) {
        console.log('✅ SUCCESS - Claude responded to bracketed paste message!');
    } else {
        console.log('❌ FAILED - No response received');
    }
    process.exit(exitCode);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('\n\nTIMEOUT - killing PTY');
    claudePty.kill();
    process.exit(1);
}, 30000);
