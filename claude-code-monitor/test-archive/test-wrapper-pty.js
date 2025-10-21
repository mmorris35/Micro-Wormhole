#!/usr/bin/env node
// Test PTY spawning using the wrapper script approach

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');

const username = 'mmn';
const sessionId = '1e154dd0-700c-4b6f-a696-6db132b5486a';
const repoPath = '/home/mmn/github/Micro-Wormhole';

console.log('=== Testing Wrapper Script via PTY ===');
console.log(`Session: ${sessionId}`);
console.log(`User: ${username}`);
console.log(`Repo: ${repoPath}`);
console.log('');

// Use the wrapper script exactly as claude-pty-injector.js does
const wrapperScript = '/tmp/spawn-claude.sh';

console.log('Spawning PTY with wrapper script...');

const claudePty = pty.spawn(wrapperScript, [
    username,
    sessionId,
    repoPath
], {
    name: 'xterm-color',
    cols: 80,
    rows: 24
});

console.log(`PTY spawned with PID: ${claudePty.pid}\n`);

let buffer = '';
let gotResponse = false;
let wrapperOutput = [];

claudePty.onData((data) => {
    buffer += data;

    // Capture wrapper messages
    if (data.includes('[WRAPPER]')) {
        const lines = data.split('\n').filter(l => l.includes('[WRAPPER]'));
        wrapperOutput.push(...lines);
        console.log('WRAPPER:', lines.join('\n         '));
    }

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
        const lines = data.split('\n').filter(l => l.includes('[DEBUG]'));
        if (lines.length > 0) {
            console.log('DEBUG:', lines[lines.length - 1].substring(0, 100));
        }
    }
});

claudePty.onExit(({ exitCode, signal }) => {
    console.log(`\n=== PTY EXIT ===`);
    console.log(`Exit code: ${exitCode}`);
    console.log(`Signal: ${signal}`);
    console.log(`\nWrapper output captured:`);
    wrapperOutput.forEach(line => console.log(`  ${line}`));

    if (!gotResponse) {
        console.log('\nERROR: No response received before exit!');
        console.log(`\nLast 500 chars of buffer:\n${buffer.slice(-500)}`);
    }
    process.exit(exitCode);
});

// Wait 4 seconds for initialization
setTimeout(() => {
    console.log('\n=== Sending test message (after 4s delay) ===');

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
    console.log('Message:', jsonLine.substring(0, 100) + '...');

    claudePty.write(jsonLine + '\n');
    console.log('Message sent! Waiting for response...\n');
}, 4000);

// Overall timeout
setTimeout(() => {
    console.log('\nTest timeout after 15 seconds');
    if (!gotResponse) {
        console.log('ERROR: No response received');
    }
    claudePty.kill();
    process.exit(1);
}, 15000);
