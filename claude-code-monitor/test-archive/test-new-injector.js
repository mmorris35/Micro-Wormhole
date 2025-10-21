#!/usr/bin/env node
// Test the updated claude-pty-injector with NEW session creation

const injector = require('./lib/claude-pty-injector');
const fs = require('fs');

async function test() {
    console.log('=== Testing New Claude PTY Injector ===\n');

    try {
        // Create NEW Claude session
        console.log('Creating new Claude session in AnarchistCookBook repo...');
        const sessionId = await injector.spawnNewClaudeSession(
            'mmn',
            '/home/mmn/github/AnarchistCookBook'
        );

        console.log(`\n✅ Session created successfully!`);
        console.log(`Session ID: ${sessionId}\n`);

        // Wait 2 seconds for Claude to be fully ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Send a question about the codebase
        console.log('Sending question to Claude...');
        const question = 'What backend framework is this codebase using? Answer in one sentence.';
        await injector.sendMessage(sessionId, question);

        console.log(`Question sent: "${question}"\n`);

        // Wait 10 seconds for response to be written to JSONL
        console.log('Waiting 10 seconds for Claude to respond...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Check JSONL file
        const jsonlPath = `/home/mmn/.claude/projects/-home-mmn-github-AnarchistCookBook/${sessionId}.jsonl`;
        console.log(`Checking JSONL file: ${jsonlPath}\n`);

        if (!fs.existsSync(jsonlPath)) {
            console.log('❌ JSONL file not found!');
            process.exit(1);
        }

        const content = fs.readFileSync(jsonlPath, 'utf-8');
        const lines = content.trim().split('\n');

        console.log(`Total messages: ${lines.length}\n`);

        lines.forEach((line, i) => {
            const obj = JSON.parse(line);
            const type = obj.type;
            const role = obj.message?.role;
            const text = obj.message?.content?.[0]?.text ||
                        obj.message?.content ||
                        obj.summary ||
                        'N/A';

            console.log(`${i + 1}. [${type}/${role}]`);
            if (text && typeof text === 'string') {
                const preview = text.substring(0, 120).replace(/\n/g, ' ');
                console.log(`   ${preview}${text.length > 120 ? '...' : ''}\n`);
            }
        });

        if (lines.length > 2) {
            console.log('\n✅ SUCCESS - Claude responded!');
            console.log(`\nView full conversation:`);
            console.log(`cat ${jsonlPath} | jq .`);
            process.exit(0);
        } else {
            console.log('\n❌ FAILED - Only warmup messages, no response to our question');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

test();
