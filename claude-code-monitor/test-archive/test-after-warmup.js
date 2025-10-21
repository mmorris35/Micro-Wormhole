#!/usr/bin/env node
// Test sending message AFTER warmup completes

const pty = require('node-pty');
const fs = require('fs');

const username = 'mmn';
const binaryPath = '/home/mmn/.vscode-server/extensions/anthropic.claude-code-2.0.21-linux-x64/resources/native-binary/claude';
const repoPath = '/home/mmn/github/AnarchistCookBook';
const userHome = `/home/${username}`;

console.log('=== Test: Send Message After Warmup Completes ===\n');

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

let sessionId = null;
let bypassSent = false;
let warmupComplete = false;
let messageSent = false;

claudePty.onData((data) => {
    // Extract session ID from debug output
    if (!sessionId && data.includes('sessionId')) {
        const match = data.match(/"sessionId":"([a-f0-9-]+)"/);
        if (match) {
            sessionId = match[1];
            console.log(`Session ID: ${sessionId}\n`);
        }
    }

    // Auto-accept bypass
    if (!bypassSent && data.includes('Yes, I accept')) {
        console.log('Accepting bypass...');
        setTimeout(() => {
            claudePty.write('2\r');
            bypassSent = true;
        }, 500);
    }

    // Detect warmup completion (when Claude responds to warmup)
    if (!warmupComplete && data.includes('"role":"assistant"')) {
        console.log('Warmup completed! Claude has context loaded.\n');
        warmupComplete = true;

        // Wait 2 seconds after warmup, then send our message
        setTimeout(() => {
            console.log('Sending message via bracketed paste...');

            const question = 'What backend framework is this codebase using?';
            const formatted = "x\b\x1b[200~" + question + "\x1b[201~";

            console.log(`Question: "${question}"\n`);
            claudePty.write(formatted);
            messageSent = true;

            console.log('Message sent! Waiting 10 seconds for response...\n');

            // Check JSONL after 10 seconds
            setTimeout(() => {
                console.log('Checking JSONL file...\n');
                if (sessionId) {
                    const jsonlPath = `/home/mmn/.claude/projects/-home-mmn-github-AnarchistCookBook/${sessionId}.jsonl`;
                    try {
                        const content = fs.readFileSync(jsonlPath, 'utf-8');
                        const lines = content.trim().split('\n');
                        console.log(`Total messages in session: ${lines.length}\n`);

                        lines.forEach((line, i) => {
                            const obj = JSON.parse(line);
                            const type = obj.type;
                            const role = obj.message?.role;
                            const contentPreview = obj.message?.content?.[0]?.text?.substring(0, 80) ||
                                                  obj.message?.content?.substring(0, 80) ||
                                                  obj.summary?.substring(0, 80) ||
                                                  'N/A';

                            console.log(`${i + 1}. [${type}/${role}] ${contentPreview}`);
                        });

                        if (lines.length > 2) {
                            console.log('\n✅ SUCCESS - Claude processed our message!');
                            claudePty.kill();
                            process.exit(0);
                        } else {
                            console.log('\n❌ Only warmup messages - our message not processed');
                        }
                    } catch (e) {
                        console.log('Error reading JSONL:', e.message);
                    }
                }

                claudePty.kill();
                process.exit(1);
            }, 10000);
        }, 2000);
    }
});

claudePty.onExit(({ exitCode }) => {
    console.log(`\nPTY EXIT: ${exitCode}`);
    process.exit(exitCode);
});

// 30 second timeout
setTimeout(() => {
    console.log('\nTIMEOUT');
    claudePty.kill();
    process.exit(1);
}, 30000);
