'use strict';

const fs = require('fs').promises;
const logger = require('./logger');

class ClaudeJSONLParser {
    /**
     * Parse a single JSONL line
     */
    parseLine(line) {
        try {
            return JSON.parse(line);
        } catch (error) {
            logger.error('Failed to parse JSONL line:', error);
            return null;
        }
    }

    /**
     * Read entire JSONL file
     */
    async readSession(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n');

            const messages = lines
                .filter(line => line.trim().length > 0)
                .map(line => this.parseLine(line))
                .filter(msg => msg !== null);

            return messages;
        } catch (error) {
            logger.error(`Failed to read session ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Read last N messages from session
     */
    async readRecentMessages(filePath, count = 50) {
        try {
            const allMessages = await this.readSession(filePath);
            return allMessages.slice(-count);
        } catch (error) {
            logger.error('Failed to read recent messages:', error);
            throw error;
        }
    }

    /**
     * Read messages with pagination
     */
    async readMessagesPage(filePath, offset = 0, limit = 50) {
        try {
            const allMessages = await this.readSession(filePath);
            const start = Math.max(0, offset);
            const end = Math.min(allMessages.length, offset + limit);

            return {
                messages: allMessages.slice(start, end),
                total: allMessages.length,
                offset: start,
                limit,
                hasMore: end < allMessages.length
            };
        } catch (error) {
            logger.error('Failed to read message page:', error);
            throw error;
        }
    }

    /**
     * Extract tool calls from messages
     */
    extractToolCalls(messages) {
        const toolCalls = [];

        for (const msg of messages) {
            if (msg.type === 'assistant' && msg.content) {
                for (const block of msg.content) {
                    if (block.type === 'tool_use') {
                        toolCalls.push({
                            id: block.id,
                            name: block.name,
                            input: block.input,
                            timestamp: msg.timestamp
                        });
                    }
                }
            }
        }

        return toolCalls;
    }

    /**
     * Extract file operations from messages
     */
    extractFileOperations(messages) {
        const operations = [];

        for (const msg of messages) {
            if (msg.type === 'assistant' && msg.content) {
                for (const block of msg.content) {
                    if (block.type === 'tool_use') {
                        const toolName = block.name;

                        if (['Read', 'Write', 'Edit', 'Glob', 'Grep'].includes(toolName)) {
                            operations.push({
                                tool: toolName,
                                file: block.input?.file_path || block.input?.pattern || 'unknown',
                                timestamp: msg.timestamp,
                                id: block.id
                            });
                        }
                    }
                }
            }
        }

        return operations;
    }

    /**
     * Get session summary statistics
     */
    async getSessionSummary(filePath) {
        try {
            const messages = await this.readSession(filePath);
            const toolCalls = this.extractToolCalls(messages);
            const fileOps = this.extractFileOperations(messages);

            return {
                totalMessages: messages.length,
                userMessages: messages.filter(m => m.type === 'user').length,
                assistantMessages: messages.filter(m => m.type === 'assistant').length,
                toolCalls: toolCalls.length,
                fileOperations: fileOps.length,
                firstMessage: messages[0]?.timestamp,
                lastMessage: messages[messages.length - 1]?.timestamp
            };
        } catch (error) {
            logger.error('Failed to get session summary:', error);
            throw error;
        }
    }

    /**
     * Stream new messages (for real-time updates)
     */
    async getNewMessages(filePath, afterTimestamp) {
        try {
            const messages = await this.readSession(filePath);

            if (!afterTimestamp) {
                return messages;
            }

            return messages.filter(msg => {
                return msg.timestamp && new Date(msg.timestamp) > new Date(afterTimestamp);
            });
        } catch (error) {
            logger.error('Failed to get new messages:', error);
            throw error;
        }
    }
}

const parser = new ClaudeJSONLParser();
module.exports = parser;
