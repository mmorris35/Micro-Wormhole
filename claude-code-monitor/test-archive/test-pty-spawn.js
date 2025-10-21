#!/usr/bin/env node
// Test script to debug PTY spawning

const pty = require('node-pty');
const fs = require('fs');

const logFile = '/tmp/pty-test.log';
const log = (msg) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    console.log(msg);
};

log('=== Starting PTY spawn test ===');

const username = 'mmn';
const sessionId = '1e154dd0-700c-4b6f-a696-6db132b5486a';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/Micro-Wormhole';
const userHome = `/home/${username}`;

log(`Username: ${username}`);
log(`SessionID: ${sessionId}`);
log(`Binary: ${binaryPath}`);
log(`RepoPath: ${repoPath}`);
log(`UserHome: ${userHome}`);

try {
    log('Spawning PTY...');

    const claudePty = pty.spawn('sudo', [
        '-u', username,
        binaryPath,
        '--resume', sessionId,
        '--input-format', 'stream-json',
        '--output-format', 'stream-json',
        '--print',
        '--verbose',
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
            PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            SHELL: '/bin/bash'
        }
    });

    log(`PTY spawned with PID: ${claudePty.pid}`);

    claudePty.onData((data) => {
        log(`DATA: ${data.substring(0, 500)}`);
    });

    claudePty.onExit(({ exitCode, signal }) => {
        log(`EXIT: code=${exitCode}, signal=${signal}`);
        process.exit(exitCode);
    });

    // Keep alive for 10 seconds
    setTimeout(() => {
        log('Test timeout - closing PTY');
        claudePty.kill();
    }, 10000);

} catch (error) {
    log(`ERROR: ${error.message}`);
    log(`STACK: ${error.stack}`);
    process.exit(1);
}
