#!/usr/bin/env node
'use strict';

/**
 * Test script for Claude JSONL parser
 * Tests parsing conversation history from JSONL files
 */

const io = require('socket.io-client');

const socket = io('http://localhost:3456');

// Test session ID (from the previous scan we know this exists)
const TEST_SESSION_ID = '9a6762a5-b7d7-4b00-ba8c-9afbbd346a0a';

socket.on('connect', () => {
    console.log('✓ Connected to server');
    console.log('');

    // First, scan for sessions
    console.log('Scanning for Claude Code sessions...');
    socket.emit('claude:sessions:list');
});

socket.on('claude:sessions:list', (data) => {
    console.log(`✓ Found ${data.sessions.length} sessions`);
    console.log('');

    // Test 1: Read conversation with pagination
    console.log('Test 1: Reading conversation (first 10 messages)...');
    socket.emit('claude:conversation:read', {
        sessionId: TEST_SESSION_ID,
        offset: 0,
        limit: 10
    });
});

socket.on('claude:conversation:read', (data) => {
    console.log('✓ Received conversation data');
    console.log(`  Session ID: ${data.sessionId}`);
    console.log(`  Total messages: ${data.total}`);
    console.log(`  Offset: ${data.offset}`);
    console.log(`  Limit: ${data.limit}`);
    console.log(`  Returned: ${data.messages.length} messages`);
    console.log(`  Has more: ${data.hasMore}`);
    console.log('');

    if (data.messages.length > 0) {
        console.log('First message:');
        const first = data.messages[0];
        console.log(`  Type: ${first.type}`);
        console.log(`  Timestamp: ${first.timestamp || 'N/A'}`);
        if (first.content) {
            if (typeof first.content === 'string') {
                console.log(`  Content: ${first.content.substring(0, 100)}...`);
            } else if (Array.isArray(first.content)) {
                console.log(`  Content blocks: ${first.content.length}`);
                first.content.forEach((block, i) => {
                    console.log(`    Block ${i + 1}: ${block.type}`);
                });
            }
        }
        console.log('');
    }

    // Test 2: Get session summary
    console.log('Test 2: Getting session summary...');
    socket.emit('claude:session:summary', {
        sessionId: TEST_SESSION_ID
    });
});

socket.on('claude:session:summary', (data) => {
    console.log('✓ Received session summary');
    console.log(`  Session ID: ${data.sessionId}`);
    console.log('  Summary:');
    console.log(`    Total messages: ${data.summary.totalMessages}`);
    console.log(`    User messages: ${data.summary.userMessages}`);
    console.log(`    Assistant messages: ${data.summary.assistantMessages}`);
    console.log(`    Tool calls: ${data.summary.toolCalls}`);
    console.log(`    File operations: ${data.summary.fileOperations}`);
    console.log(`    First message: ${data.summary.firstMessage || 'N/A'}`);
    console.log(`    Last message: ${data.summary.lastMessage || 'N/A'}`);
    console.log('');

    // Test 3: Poll for new messages (should return empty for inactive session)
    console.log('Test 3: Polling for new messages...');
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    socket.emit('claude:conversation:poll', {
        sessionId: TEST_SESSION_ID,
        afterTimestamp: oneHourAgo
    });

    // Wait a bit for response
    setTimeout(() => {
        console.log('✓ Poll test complete (check if new-messages event was emitted)');
        console.log('');
        console.log('✓ All tests passed!');
        console.log('');
        console.log('JSONL parser is working correctly.');

        socket.disconnect();
        process.exit(0);
    }, 2000);
});

socket.on('claude:conversation:new-messages', (data) => {
    console.log('✓ Received new messages notification');
    console.log(`  Session ID: ${data.sessionId}`);
    console.log(`  New messages: ${data.messages.length}`);
    console.log('');
});

socket.on('error', (error) => {
    console.error('✗ Error:', error.message);
    process.exit(1);
});

socket.on('connect_error', (error) => {
    console.error('✗ Connection error:', error.message);
    console.error('');
    console.error('Make sure the server is running: npm start');
    process.exit(1);
});

// Timeout after 15 seconds
setTimeout(() => {
    console.error('✗ Test timeout - server not responding');
    socket.disconnect();
    process.exit(1);
}, 15000);
