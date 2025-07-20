#!/usr/bin/env node

import { AccountManager } from './src/account-manager.mjs';

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Bot stopped by user\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Bot terminated\n');
  process.exit(0);
});

// Main function
async function main() {
  console.log('Starting Gigaverse Multi-Account Bot...\n');
  
  try {
    const manager = new AccountManager();
    await manager.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the bot
main().catch(console.error);