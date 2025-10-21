#!/usr/bin/env node
// Test creating NEW Claude session (not --resume) in a repo

const pty = require('node-pty');

const username = 'mmn';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/AnarchistCookBook';
const userHome = `/home/${username}`;

console.log('=== Testing NEW Claude Session (No --resume) ===');
console.log(`Repo: ${repoPath}`);
console.log('');

// Spawn Claude WITHOUT --resume (creates new session)
const claudePty = pty.spawn('sudo', [
    '-u', username,
    binaryPath,
    '--verbose',
    '--dangerously-skip-permissions',
    '--debug-to-stderr'
], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: repoPath,  // Start in the repo directory
    env: {
        HOME: userHome,
        USER: username,
        LOGNAME: username,
        PATH: process.env.PATH,
        SHELL: '/bin/bash'
    }
});

console.log(`PTY PID: ${claudePty.pid}\n`);

let bypassAccepted = false;
let messageSent = false;
let gotResponse = false;
let outputBuffer = '';

claudePty.onData((data) => {
    outputBuffer += data;

    // Show only important output
    if (data.includes('[DEBUG]')) {
        const match = data.match(/\[DEBUG\] ([^\r\n]+)/);
        if (match && !match[1].includes('Renaming') && !match[1].includes('Writing to temp') && !match[1].includes('Preserving')) {
            const msg = match[1].substring(0, 100);
            console.log(`[DEBUG] ${msg}`);
        }
    }

    // Auto-accept bypass prompt
    if (!bypassAccepted && data.includes('Yes, I accept')) {
        console.log('\n>>> Accepting bypass prompt...\n');
        setTimeout(() => {
            claudePty.write('2\r');
            bypassAccepted = true;
        }, 500);
    }

    // After bypass accepted, send message using bracketed paste
    if (bypassAccepted && !messageSent && data.includes('Start a conversation')) {
        setTimeout(() => {
            console.log('>>> Claude is ready! Sending question about the codebase...\n');

            const question = 'What is this codebase? Give me a 2 sentence summary.';
            const formatted = "x\b\x1b[200~" + question + "\x1b[201~";

            console.log(`Question: "${question}"\n`);
            claudePty.write(formatted);
            messageSent = true;

            console.log('>>> Message sent! Watching for response...\n');
        }, 2000);
    }

    // After message sent, show all output
    if (messageSent && !gotResponse) {
        // Look for Claude's response indicators
        if (data.includes('thinking') ||
            data.includes('Thinking') ||
            data.includes('analyzing') ||
            data.toLowerCase().includes('codebase') ||
            data.toLowerCase().includes('project') ||
            data.toLowerCase().includes('application')) {

            console.log('\n\n=== ✅ CLAUDE IS RESPONDING! ===\n');
            gotResponse = true;
        }

        // Show non-debug output
        if (!data.includes('[DEBUG]') && data.trim().length > 0) {
            // Clean ANSI codes for readability
            const cleaned = data.replace(/\x1b\[[0-9;]*m/g, '');
            if (cleaned.trim()) {
                process.stdout.write(cleaned);
            }
        }
    }
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\n\n=== PTY EXIT: code=${exitCode} ===`);
    console.log(`Output buffer size: ${outputBuffer.length} chars`);
    console.log(`Got response: ${gotResponse ? '✅ YES' : '❌ NO'}`);
    process.exit(exitCode);
});

// 60 second timeout
setTimeout(() => {
    console.log('\n\nTIMEOUT - killing PTY');
    if (gotResponse) {
        console.log('✅ SUCCESS - Claude responded to our codebase question!');
    }
    claudePty.kill();
    process.exit(gotResponse ? 0 : 1);
}, 60000);
