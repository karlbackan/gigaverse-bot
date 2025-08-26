#!/usr/bin/env node
/**
 * Learning Evaluation Server - Standalone
 * Run this to start the evaluation endpoints server
 */

import LearningEvaluationServer from './src/learning-evaluation-endpoints.mjs';

const server = new LearningEvaluationServer(3001);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down learning evaluation server...');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down learning evaluation server...');
    await server.stop();
    process.exit(0);
});

// Start server
server.start().catch(error => {
    console.error('❌ Failed to start learning evaluation server:', error);
    process.exit(1);
});