#!/usr/bin/env node
// Test sending simple message format to Claude PTY

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');

const username = 'mmn';
const sessionId = '1907a3de-990e-47ce-b54c-1f1f674da75e';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/AnarchistCookBook';
const userHome = `/home/${username}`;

console.log('=== Testing Simple Message Format ===');
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

claudePty.onData((data) => {
    process.stdout.write(data);

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

// Wait 4 seconds for init, then send SIMPLE format message
setTimeout(() => {
    console.log('\n=== SENDING SIMPLE FORMAT MESSAGE ===\n');

    const message = {
        type: 'user',
        role: 'user',
        content: 'Reply with exactly "SIMPLE FORMAT OK"',
        timestamp: new Date().toISOString(),
        uuid: uuidv4()
    };

    const jsonLine = JSON.stringify(message);
    console.log('Message:', jsonLine.substring(0, 100));
    claudePty.write(jsonLine + '\n');
    console.log('Sent!\n');
}, 4000);

// Timeout after 20 seconds
setTimeout(() => {
    console.log('\n\nTIMEOUT - killing PTY');
    claudePty.kill();
    process.exit(1);
}, 20000);
