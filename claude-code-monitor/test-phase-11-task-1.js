#!/usr/bin/env node
// Task 11.1 Test - Verify simplified PTY injector works

const injector = require('./lib/claude-pty-injector');
const fs = require('fs');

async function test() {
    console.log('=== Task 11.1 Test: Simplified PTY Injector ===\n');

    try {
        // Step 1: Create new session
        console.log('Step 1: Creating new Claude session...');
        const sessionId = await injector.spawnNewClaudeSession(
            'mmn',
            '/home/mmn/github/AnarchistCookBook'
        );
        console.log(`✅ Session created: ${sessionId}\n`);

        // Verify session info
        const info = injector.getSessionInfo(sessionId);
        console.log('Session Info:');
        console.log(`  - Username: ${info.username}`);
        console.log(`  - Repo: ${info.repoPath}`);
        console.log(`  - PID: ${info.pid}`);
        console.log(`  - Created: ${info.createdAt}\n`);

        // Step 2: Verify hasSession works
        console.log('Step 2: Verifying hasSession()...');
        if (injector.hasSession(sessionId)) {
            console.log('✅ hasSession() works\n');
        } else {
            throw new Error('hasSession() returned false!');
        }

        // Step 3: Send message
        console.log('Step 3: Sending message...');
        await injector.sendMessage(sessionId, 'What is the main backend framework?');
        console.log('✅ Message sent\n');

        // Step 4: Wait for response
        console.log('Step 4: Waiting 10 seconds for response...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Step 5: Check JSONL
        console.log('Step 5: Checking JSONL file...');
        const jsonlPath = `/home/mmn/.claude/projects/-home-mmn-github-AnarchistCookBook/${sessionId}.jsonl`;

        if (!fs.existsSync(jsonlPath)) {
            throw new Error('JSONL file not found!');
        }

        const content = fs.readFileSync(jsonlPath, 'utf-8');
        const lines = content.trim().split('\n');
        console.log(`Total messages: ${lines.length}`);

        let userMsgs = 0;
        let assistantMsgs = 0;

        lines.forEach(line => {
            const obj = JSON.parse(line);
            if (obj.type === 'user') userMsgs++;
            if (obj.type === 'assistant') assistantMsgs++;
        });

        console.log(`User messages: ${userMsgs}`);
        console.log(`Assistant messages: ${assistantMsgs}\n`);

        if (assistantMsgs < 1) {
            throw new Error('No assistant messages found!');
        }

        console.log('✅ Response received!\n');

        // Step 6: Close session
        console.log('Step 6: Closing session...');
        injector.closeSession(sessionId);

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!injector.hasSession(sessionId)) {
            console.log('✅ Session closed successfully\n');
        } else {
            throw new Error('Session still exists after close!');
        }

        console.log('=== ✅ ALL TESTS PASSED ===\n');
        console.log('Task 11.1 Complete:\n');
        console.log('  ✅ spawnNewClaudeSession() works');
        console.log('  ✅ findNewestSession() works');
        console.log('  ✅ sendMessage() with bracketed paste works');
        console.log('  ✅ closeSession() works');
        console.log('  ✅ hasSession() works');
        console.log('  ✅ getSessionInfo() works\n');

        console.log(`JSONL: ${jsonlPath}`);

        process.exit(0);

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

test();
