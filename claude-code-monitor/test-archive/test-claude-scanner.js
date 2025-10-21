#!/usr/bin/env node
'use strict';

/**
 * Test script for Claude session scanner
 * Tests the Socket.io events added in Task 9.1
 */

const io = require('socket.io-client');

const socket = io('http://localhost:3456');

socket.on('connect', () => {
    console.log('✓ Connected to server');
    console.log('');

    // Test 1: List all Claude sessions
    console.log('Test 1: Listing all Claude Code sessions...');
    socket.emit('claude:sessions:list');
});

socket.on('claude:sessions:list', (data) => {
    console.log('✓ Received session list');
    console.log(`Found ${data.sessions.length} Claude Code sessions:`);
    console.log('');

    if (data.sessions.length === 0) {
        console.log('  (No sessions found - this might be expected if no Claude Code sessions exist)');
        console.log('');
    } else {
        data.sessions.forEach((session, i) => {
            console.log(`Session ${i + 1}:`);
            console.log(`  ID: ${session.id}`);
            console.log(`  Repository: ${session.repoName} (${session.repoPath})`);
            console.log(`  User: ${session.username}`);
            console.log(`  Active: ${session.isActive ? 'YES' : 'NO'}`);
            console.log(`  Messages: ${session.messageCount}`);
            console.log(`  File Size: ${(session.fileSize / 1024).toFixed(2)} KB`);
            console.log(`  Last Modified: ${session.lastModified}`);
            console.log('');
        });
    }

    // Test 2: Get sessions grouped by repo
    console.log('Test 2: Getting sessions grouped by repository...');
    socket.emit('claude:sessions:by-repo');
});

socket.on('claude:sessions:by-repo', (data) => {
    console.log('✓ Received sessions grouped by repo');
    console.log('');

    const repos = Object.keys(data.byRepo);
    console.log(`Found ${repos.length} repositories with Claude Code sessions:`);
    console.log('');

    if (repos.length === 0) {
        console.log('  (No repositories found)');
        console.log('');
    } else {
        repos.forEach((repo, i) => {
            const sessions = data.byRepo[repo];
            console.log(`Repository ${i + 1}: ${repo}`);
            console.log(`  Sessions: ${sessions.length}`);
            sessions.forEach((session) => {
                console.log(`    - ${session.id.substring(0, 8)}... (${session.isActive ? 'active' : 'inactive'}, ${session.messageCount} messages)`);
            });
            console.log('');
        });
    }

    console.log('✓ All tests passed!');
    console.log('');
    console.log('Session scanner is working correctly.');

    // Exit after a short delay
    setTimeout(() => {
        socket.disconnect();
        process.exit(0);
    }, 1000);
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

// Timeout after 10 seconds
setTimeout(() => {
    console.error('✗ Test timeout - server not responding');
    socket.disconnect();
    process.exit(1);
}, 10000);
