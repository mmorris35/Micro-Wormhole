#!/usr/bin/env node
// Test script to send a message via PTY

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');

const username = 'mmn';
const sessionId = '1e154dd0-700c-4b6f-a696-6db132b5486a';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/Micro-Wormhole';
const userHome = `/home/${username}`;

console.log('Spawning Claude PTY...');

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

console.log(`PTY spawned with PID: ${claudePty.pid}`);

claudePty.onData((data) => {
    console.log('OUTPUT:', data);
});

claudePty.onExit(({ exitCode, signal }) => {
    console.log(`EXIT: code=${exitCode}, signal=${signal}`);
    process.exit(exitCode);
});

// Wait for Claude to initialize, then send a message
setTimeout(() => {
    console.log('Sending test message...');

    const messageObj = {
        type: 'user',
        role: 'user',
        content: [
            {
                type: 'text',
                text: 'Hello from browser test! Can you confirm you received this?'
            }
        ],
        timestamp: new Date().toISOString(),
        uuid: uuidv4()
    };

    const jsonLine = JSON.stringify(messageObj);
    console.log('Message JSON:', jsonLine);

    claudePty.write(jsonLine + '\n');
    console.log('Message sent!');
}, 3500);

// Timeout after 30 seconds
setTimeout(() => {
    console.log('Test timeout');
    claudePty.kill();
    process.exit(1);
}, 30000);
