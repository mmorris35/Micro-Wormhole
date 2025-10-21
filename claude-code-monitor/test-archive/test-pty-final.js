#!/usr/bin/env node
// Final PTY test with all fixes

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');

const username = 'mmn';
const sessionId = '1e154dd0-700c-4b6f-a696-6db132b5486a';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/Micro-Wormhole';
const userHome = `/home/${username}`;

console.log('=== PTY Test with All Fixes ===');
console.log('Spawning Claude PTY...');

const claudePty = pty.spawn('sudo', [
    '-u', username,
    binaryPath,
    '--resume', sessionId,
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--print',
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

console.log(`PTY spawned with PID: ${claudePty.pid}`);

let buffer = '';
let gotResponse = false;

claudePty.onData((data) => {
    buffer += data;

    // Look for assistant response
    if (data.includes('"type":"assistant"') || data.includes('"role":"assistant"')) {
        console.log('\n=== GOT ASSISTANT RESPONSE! ===');
        console.log(data.substring(0, 500));
        gotResponse = true;
        setTimeout(() => {
            claudePty.kill();
            process.exit(0);
        }, 1000);
    }

    // Show debug markers
    if (data.includes('[DEBUG]')) {
        const lines = data.split('\n');
        const debugLines = lines.filter(l => l.includes('[DEBUG]'));
        if (debugLines.length > 0) {
            console.log('DEBUG:', debugLines[debugLines.length - 1].substring(0, 100));
        }
    }
});

claudePty.onExit(({ exitCode, signal }) => {
    console.log(`\nEXIT: code=${exitCode}, signal=${signal}`);
    if (!gotResponse) {
        console.log('ERROR: No response received before exit!');
    }
    process.exit(exitCode);
});

// Wait 4 seconds for initialization, then send message
setTimeout(() => {
    console.log('\n=== Sending message after 4 second delay ===');

    const messageObj = {
        type: 'user',
        role: 'user',
        content: [
            {
                type: 'text',
                text: 'Reply with just "TEST OK" if you receive this'
            }
        ],
        timestamp: new Date().toISOString(),
        uuid: uuidv4()
    };

    const jsonLine = JSON.stringify(messageObj);
    console.log('Sending:', jsonLine.substring(0, 100) + '...');

    claudePty.write(jsonLine + '\n');
    console.log('Message sent! Waiting for response...');
}, 4000);

// Overall timeout
setTimeout(() => {
    console.log('\nTest timeout - killing PTY');
    if (!gotResponse) {
        console.log('ERROR: No response after 15 seconds');
    }
    claudePty.kill();
    process.exit(1);
}, 15000);
