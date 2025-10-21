#!/usr/bin/env node
// Test auto-accepting bypass permissions prompt

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');

const username = 'mmn';
const sessionId = '1907a3de-990e-47ce-b54c-1f1f674da75e';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/AnarchistCookBook';
const userHome = `/home/${username}`;

console.log('=== Testing Auto-Accept Bypass Prompt ===');
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
    process.stdout.write(data);

    // Check for bypass permissions prompt
    if (!sentBypassAccept && (data.includes('Bypass Permissions mode') || data.includes('Yes, I accept'))) {
        console.log('\n\n=== DETECTED BYPASS PROMPT - SENDING "2" + ENTER ===\n');
        setTimeout(() => {
            claudePty.write('2\r');  // Select option 2 + Enter
            sentBypassAccept = true;
        }, 500);
    }

    // After accepting bypass, wait 2 seconds then send message
    if (sentBypassAccept && !sentMessage && data.includes('[DEBUG]')) {
        setTimeout(() => {
            console.log('\n=== BYPASS ACCEPTED - SENDING MESSAGE ===\n');
            const message = {
                type: 'user',
                role: 'user',
                content: 'Reply with exactly "AUTO BYPASS OK"',
                timestamp: new Date().toISOString(),
                uuid: uuidv4()
            };
            claudePty.write(JSON.stringify(message) + '\n');
            sentMessage = true;
            console.log('Message sent!\n');
        }, 2000);
    }

    // Check for assistant response in stdout
    if (data.includes('"type":"assistant"') || data.includes('"role":"assistant"')) {
        console.log('\n\n=== GOT ASSISTANT RESPONSE IN STDOUT! ===');
        gotResponse = true;
        setTimeout(() => {
            claudePty.kill();
            process.exit(0);
        }, 1000);
    }
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\n\nPTY EXIT: code=${exitCode}`);
    console.log(gotResponse ? 'SUCCESS' : 'FAILED - no response');
    process.exit(exitCode);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('\n\nTIMEOUT - killing PTY');
    claudePty.kill();
    process.exit(1);
}, 30000);
