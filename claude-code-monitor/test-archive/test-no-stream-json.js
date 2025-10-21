#!/usr/bin/env node
// Test WITHOUT stream-json flags (like AgentAPI does)

const pty = require('node-pty');

const username = 'mmn';
const sessionId = '1907a3de-990e-47ce-b54c-1f1f674da75e';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/AnarchistCookBook';
const userHome = `/home/${username}`;

console.log('=== Testing WITHOUT stream-json flags (AgentAPI approach) ===');
console.log(`Session: ${sessionId}`);
console.log('');

// Spawn Claude WITHOUT stream-json flags - just like AgentAPI does!
const claudePty = pty.spawn('sudo', [
    '-u', username,
    binaryPath,
    '--resume', sessionId,
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
let bypassAccepted = false;
let messageSent = false;
let outputBuffer = '';

claudePty.onData((data) => {
    outputBuffer += data;

    // Auto-accept bypass prompt
    if (!bypassAccepted && data.includes('Yes, I accept')) {
        console.log('Accepting bypass prompt...');
        setTimeout(() => {
            claudePty.write('2\r');
            bypassAccepted = true;
            console.log('Bypass accepted\n');
        }, 500);
    }

    // Send message after bypass accepted
    if (bypassAccepted && !messageSent) {
        setTimeout(() => {
            console.log('Sending message via bracketed paste...');

            const messageText = 'Reply with exactly "NO STREAM JSON OK"';
            const formatted = "x\b\x1b[200~" + messageText + "\x1b[201~";

            console.log(`Message: "${messageText}"\n`);

            claudePty.write(formatted);
            messageSent = true;

            console.log('Message sent! Watching output...\n');
            console.log('=== OUTPUT START ===\n');
        }, 1000);
    }

    // After message sent, show ALL output
    if (messageSent) {
        process.stdout.write(data);

        // Check for response indicators
        if (data.includes('NO STREAM JSON OK') ||
            data.toLowerCase().includes('claude') ||
            data.includes('thinking') ||
            data.includes('response')) {
            console.log('\n\n=== ✅ GOT ACTIVITY! ===');
            gotResponse = true;
        }
    }
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\n\n=== PTY EXIT: code=${exitCode} ===`);
    console.log(gotResponse ? '✅ SUCCESS' : '❌ FAILED');
    process.exit(exitCode);
});

// Longer timeout - 60 seconds
setTimeout(() => {
    console.log('\n\nTIMEOUT - killing PTY');
    console.log(`\nFinal output buffer length: ${outputBuffer.length} chars`);
    claudePty.kill();
    process.exit(1);
}, 60000);
