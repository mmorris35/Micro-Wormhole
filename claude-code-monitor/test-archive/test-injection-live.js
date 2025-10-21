#!/usr/bin/env node
// Test PTY injection with live output display

const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');

const username = 'mmn';
const sessionId = '962305cb-19dd-4806-a358-ad2a3668d67c';
const repoPath = '/home/mmn/github/AnarchistCookBook';

console.log('=== Testing PTY Injection with Live Output ===');
console.log(`Session: ${sessionId.substring(0, 8)}`);
console.log(`Repo: ${repoPath}`);
console.log('');

const wrapperScript = '/opt/claude-monitor/spawn-claude.sh';

console.log('Spawning PTY...');
const claudePty = pty.spawn(wrapperScript, [username, sessionId, repoPath], {
    name: 'xterm-color',
    cols: 80,
    rows: 24
});

console.log(`PTY PID: ${claudePty.pid}\n`);
console.log('=== LIVE OUTPUT ===\n');

let lastOutputTime = Date.now();

claudePty.onData((data) => {
    process.stdout.write(data);
    lastOutputTime = Date.now();
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\n\n=== PTY EXITED: code ${exitCode} ===`);
    process.exit(exitCode);
});

// Wait 4 seconds for init
setTimeout(() => {
    console.log('\n=== SENDING MESSAGE ===\n');

    const messageObj = {
        type: 'user',
        role: 'user',
        content: [{ type: 'text', text: 'Say only "INJECTION TEST OK"' }],
        timestamp: new Date().toISOString(),
        uuid: uuidv4()
    };

    claudePty.write(JSON.stringify(messageObj) + '\n');
    console.log('Message sent!\n');
}, 4000);

// Check if output stalled
setInterval(() => {
    const timeSinceOutput = Date.now() - lastOutputTime;
    if (timeSinceOutput > 10000) {
        console.log(`\n\n⚠️  No output for ${Math.floor(timeSinceOutput/1000)}s - Claude may be stuck`);
    }
}, 5000);

// Timeout after 30 seconds
setTimeout(() => {
    console.log('\n\n=== TIMEOUT ===');
    claudePty.kill();
    process.exit(1);
}, 30000);
