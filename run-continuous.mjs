#!/usr/bin/env node

import { AccountManager } from './src/account-manager.mjs';
import { sleep } from './src/utils.mjs';
import { config } from './src/config.mjs';

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Bot stopped by user\n');
  process.exit(0);
});

// Continuous mode without interactive prompts
async function runContinuous() {
  console.log('=== CONTINUOUS MODE (Non-Interactive) ===\n');
  console.log('Cycling through all accounts continuously.');
  console.log('Press Ctrl+C to stop.\n');

  const manager = new AccountManager();

  while (true) {
    // Check all accounts
    const results = await manager.validator.validateAll(manager.accounts);
    const validAccounts = results.filter(r => r.valid && r.energy >= config.energyThreshold);

    if (validAccounts.length === 0) {
      console.log('\n😴 No accounts have enough energy. Waiting 5 minutes...\n');
      await sleep(300000);
      continue;
    }

    // Sort by energy (highest first)
    validAccounts.sort((a, b) => b.energy - a.energy);
    console.log(`\n🔄 Cycle starting with ${validAccounts.length} accounts (sorted by energy)\n`);

    // Run each account with energy
    for (const result of validAccounts) {
      const account = manager.accounts.find(a => a.name === result.accountName);
      if (!account) continue;

      console.log(`\n${'='.repeat(50)}`);
      console.log(`   ACCOUNT: ${account.name}`);
      console.log(`${'='.repeat(50)}\n`);

      await manager.runAccountUntilComplete(account);

      console.log('\n⏳ Waiting 10 seconds before next account...\n');
      await sleep(10000);
    }

    console.log('\n🔄 Cycle complete. Waiting 2 minutes before next cycle...\n');
    await sleep(120000);
  }
}

runContinuous().catch(console.error);
