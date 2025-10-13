'use strict';

const fs = require('fs');
const logger = require('./logger');

/**
 * Get list of system users with home directories in /home
 */
function getSystemUsers() {
    try {
        const passwdContent = fs.readFileSync('/etc/passwd', 'utf8');
        const lines = passwdContent.split('\n');
        const users = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            const parts = line.split(':');
            if (parts.length < 7) continue;

            const username = parts[0];
            const homeDir = parts[5];

            // Filter to users with home directories in /home
            // Exclude system users like nobody, daemon, etc.
            if (homeDir.startsWith('/home/')) {
                users.push({
                    username: username,
                    homeDir: homeDir
                });
            }
        }

        logger.info(`Found ${users.length} system users`);
        return users;
    } catch (error) {
        logger.error('Failed to read /etc/passwd:', error);
        return [];
    }
}

/**
 * Validate that a user exists on the system
 */
function validateUser(username) {
    const users = getSystemUsers();
    return users.some(u => u.username === username);
}

/**
 * Get home directory for a user
 */
function getUserHomeDir(username) {
    const users = getSystemUsers();
    const user = users.find(u => u.username === username);
    return user ? user.homeDir : null;
}

module.exports = {
    getSystemUsers,
    validateUser,
    getUserHomeDir
};
