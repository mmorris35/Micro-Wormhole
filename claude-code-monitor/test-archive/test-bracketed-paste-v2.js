#!/usr/bin/env node
// Test using bracketed paste mode with detailed debugging

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
let bypassPromptSeen = false;
let bypassAccepted = false;
let streamStarted = false;
let messageSent = false;

claudePty.onData((data) => {
    // Check state transitions
    if (!bypassPromptSeen && data.includes('Bypass Permissions mode')) {
        bypassPromptSeen = true;
        console.log('STATE: Bypass prompt appeared');
    }

    if (!streamStarted && data.includes('Stream started')) {
        streamStarted = true;
        console.log('STATE: Stream started (ready for input)');
    }

    // Show debug output
    if (data.includes('[DEBUG]') && !data.includes('Renaming') && !data.includes('Writing to temp')) {
        const match = data.match(/\[DEBUG\] ([^\r\n]+)/);
        if (match) {
            const msg = match[1].substring(0, 80);
            if (!msg.includes('Preserving file') && !msg.includes('Applied original')) {
                console.log(`  [DEBUG] ${msg}`);
            }
        }
    }

    // Auto-accept bypass prompt
    if (bypassPromptSeen && !bypassAccepted && data.includes('Yes, I accept')) {
        console.log('\nACTION: Sending "2" to accept bypass...');
        setTimeout(() => {
            claudePty.write('2\r');
            bypassAccepted = true;
            console.log('ACTION: Bypass accepted\n');
        }, 500);
    }

    // Send message after stream starts
    if (streamStarted && bypassAccepted && !messageSent) {
        setTimeout(() => {
            console.log('ACTION: Sending message via bracketed paste...\n');

            const messageText = 'Reply with exactly "BRACKETED PASTE OK"';

            // AgentAPI format (from their claude.go):
            // "x\b" + "\x1b[200~" + messageText + "\x1b[201~"
            const formatted = "x\b\x1b[200~" + messageText + "\x1b[201~";

            console.log(`  Message text: "${messageText}"`);
            console.log(`  Formatted length: ${formatted.length} bytes`);
            console.log(`  First 50 chars: ${JSON.stringify(formatted.substring(0, 50))}`);

            claudePty.write(formatted);
            messageSent = true;

            console.log('\nACTION: Message sent! Waiting for response...\n');
        }, 1000);
    }

    // Check for response
    if (messageSent) {
        // Check for any output that might be a response
        if (data.includes('BRACKETED PASTE OK') ||
            data.includes('"type":"assistant"') ||
            data.includes('"role":"assistant"')) {
            console.log('\n\n=== ✅ GOT RESPONSE! ===\n');
            console.log(data.substring(0, 500));
            gotResponse = true;
            setTimeout(() => {
                claudePty.kill();
                process.exit(0);
            }, 1000);
        }

        // Also log any non-DEBUG output after message sent
        if (!data.includes('[DEBUG]') && data.trim().length > 0) {
            console.log('OUTPUT:', data.substring(0, 100).replace(/\r?\n/g, ' ').replace(/\x1b\[[0-9;]*m/g, ''));
        }
    }
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\n\nPTY EXIT: code=${exitCode}`);
    console.log(`\nState at exit:`);
    console.log(`  - Bypass prompt seen: ${bypassPromptSeen}`);
    console.log(`  - Bypass accepted: ${bypassAccepted}`);
    console.log(`  - Stream started: ${streamStarted}`);
    console.log(`  - Message sent: ${messageSent}`);
    console.log(`  - Got response: ${gotResponse}`);

    if (gotResponse) {
        console.log('\n✅ SUCCESS - Claude responded!');
    } else {
        console.log('\n❌ FAILED - No response');
    }
    process.exit(exitCode);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('\n\nTIMEOUT - killing PTY');
    claudePty.kill();
    process.exit(1);
}, 30000);
