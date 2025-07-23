import { config } from './config.mjs';
import { JWTValidator } from './jwt-validator.mjs';
import { DungeonPlayer } from './dungeon-player.mjs';
import { getDirectEnergy, getDirectDungeonState, resetActionToken } from './direct-api.mjs';
import { sleep } from './utils.mjs';
import readline from 'readline';
import dotenv from 'dotenv';

export class AccountManager {
  constructor() {
    this.accounts = this.loadAccounts();
    this.validator = new JWTValidator();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Load accounts from config
  loadAccounts() {
    // Re-read dotenv to ensure fresh values
    dotenv.config();
    
    // Try to load from environment variables first
    const accounts = [];
    
    // Check for individual JWT tokens (JWT_TOKEN_1, JWT_TOKEN_2, etc.)
    for (let i = 1; i <= 10; i++) {
      const token = process.env[`JWT_TOKEN_${i}`];
      const name = process.env[`ACCOUNT_NAME_${i}`] || `Account ${i}`;
      
      if (token) {
        accounts.push({ name, token });
      }
    }

    // If no numbered tokens, check for the default JWT_TOKEN
    if (accounts.length === 0 && process.env.JWT_TOKEN) {
      accounts.push({
        name: process.env.ACCOUNT_NAME || 'Main Account',
        token: process.env.JWT_TOKEN
      });
    }

    return accounts;
  }

  // Get user input
  async getUserInput(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  // Display main menu
  async showMainMenu() {
    console.clear();
    console.log('========================================');
    console.log('    🎮 GIGAVERSE MULTI-ACCOUNT BOT 🎮   ');
    console.log('========================================\n');

    if (this.accounts.length === 0) {
      console.log('❌ No accounts configured!');
      console.log('\nPlease add JWT tokens to your .env file:');
      console.log('  JWT_TOKEN_1=your_first_token');
      console.log('  JWT_TOKEN_2=your_second_token');
      console.log('  ACCOUNT_NAME_1=Account 1 (optional)');
      console.log('  ACCOUNT_NAME_2=Account 2 (optional)\n');
      this.rl.close();
      process.exit(1);
    }

    console.log(`📊 ${this.accounts.length} accounts configured\n`);
    console.log('OPTIONS:');
    console.log('  1. Check all accounts status');
    console.log('  2. Run single account');
    console.log('  3. Run all valid accounts');
    console.log('  4. Continuous mode (cycle through accounts)');
    console.log('  5. Exit\n');

    const choice = await this.getUserInput('Select option (1-5): ');
    return choice;
  }

  // Check all accounts
  async checkAllAccounts() {
    console.clear();
    console.log('=== ACCOUNT STATUS CHECK ===\n');

    const results = await this.validator.validateAll(this.accounts);
    
    console.log('\n--- SUMMARY ---');
    const valid = results.filter(r => r.valid).length;
    const expired = results.filter(r => r.expired).length;
    const invalid = results.filter(r => !r.valid && !r.expired).length;
    
    console.log(`✅ Valid: ${valid}`);
    console.log(`❌ Expired: ${expired}`);
    console.log(`⚠️  Invalid: ${invalid}`);
    console.log(`📊 Total: ${results.length}\n`);

    // Show valid accounts with energy
    const validAccounts = results.filter(r => r.valid);
    if (validAccounts.length > 0) {
      console.log('Valid accounts with energy:');
      validAccounts.forEach(acc => {
        console.log(`  • ${acc.accountName}: ${acc.energy} energy`);
      });
    }

    await this.getUserInput('\nPress Enter to continue...');
    return results;
  }

  // Select single account
  async selectAccount() {
    console.clear();
    console.log('=== SELECT ACCOUNT ===\n');

    // First validate all accounts
    const results = await this.validator.validateAll(this.accounts);
    const validAccounts = results.filter(r => r.valid);

    if (validAccounts.length === 0) {
      console.log('\n❌ No valid accounts available!');
      await this.getUserInput('\nPress Enter to continue...');
      return null;
    }

    console.log('\nValid accounts:');
    validAccounts.forEach((acc, index) => {
      console.log(`  ${index + 1}. ${acc.accountName} (Energy: ${acc.energy})`);
    });

    const choice = await this.getUserInput('\nSelect account number (or 0 to cancel): ');
    const index = parseInt(choice) - 1;

    if (index < 0 || index >= validAccounts.length) {
      return null;
    }

    // Find the original account object
    const selectedResult = validAccounts[index];
    const account = this.accounts.find(a => a.name === selectedResult.accountName);
    
    return account;
  }

  // Run single account
  async runSingleAccount(account) {
    console.clear();
    console.log(`=== RUNNING ${account.name.toUpperCase()} ===\n`);

    // Use the same logic as runAllAccounts - run until no energy
    await this.runAccountUntilComplete(account);

    await this.getUserInput('\nPress Enter to return to menu...');
  }

  // Run all valid accounts
  async runAllAccounts() {
    console.clear();
    console.log('=== RUNNING ALL VALID ACCOUNTS ===\n');

    // First check which accounts are valid
    const results = await this.validator.validateAll(this.accounts);
    const validAccounts = results.filter(r => r.valid);

    if (validAccounts.length === 0) {
      console.log('\n❌ No valid accounts to run!');
      await this.getUserInput('\nPress Enter to continue...');
      return;
    }

    console.log(`\n🎮 Running ${validAccounts.length} valid accounts...\n`);
    
    // Show which accounts will be skipped
    const invalidAccounts = results.filter(r => !r.valid);
    if (invalidAccounts.length > 0) {
      console.log('⚠️  Skipping invalid accounts:');
      invalidAccounts.forEach(acc => {
        console.log(`   - ${acc.accountName}: ${acc.error}`);
      });
      console.log('');
    }
    
    await sleep(2000);

    // Run each valid account
    for (let i = 0; i < validAccounts.length; i++) {
      const result = validAccounts[i];
      const account = this.accounts.find(a => a.name === result.accountName);
      if (!account) continue;

      console.log(`\n${'='.repeat(50)}`);
      console.log(`   ACCOUNT: ${account.name}`);
      console.log(`${'='.repeat(50)}\n`);

      await this.runAccountUntilComplete(account);
      
      if (i < validAccounts.length - 1) {
        console.log('\n⏳ Waiting 5 seconds before next account...\n');
        await sleep(5000);
      }
    }

    console.log('\n✅ All accounts completed!');
    await this.getUserInput('\nPress Enter to return to menu...');
  }

  // Run account until no energy or dungeon complete
  async runAccountUntilComplete(account) {
    process.env.JWT_TOKEN = account.token;
    config.jwtToken = account.token;
    
    // Reset action token when switching accounts
    resetActionToken();

    // Extract wallet address from token
    const parts = account.token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const walletAddress = payload.address || payload.user?.caseSensitiveAddress;

    const player = new DungeonPlayer(walletAddress);
    let hasEnergy = true;

    while (hasEnergy) {
      try {
        // Play dungeon - let the player handle all energy and state checks
        const status = await player.playDungeon();
        
        if (status === 'continue_playing') {
          // Continue immediately
          await sleep(2000);
        } else if (status === 'no_energy') {
          // Not enough energy to start new game
          hasEnergy = false;
          break;
        } else if (status === 'completed') {
          // Dungeon complete, check if we can run another
          console.log('\n🔄 Checking for next run...\n');
          await sleep(5000);
          // Loop will continue and check energy for next run
        } else {
          // Other statuses (wait, daily_limit, etc)
          await sleep(5000);
        }

      } catch (error) {
        console.error('❌ Error:', error.message);
        
        // If token is invalid (401), skip this account
        if (error.response?.status === 401 || error.message?.includes('401')) {
          console.log('⚠️  Token is invalid for game endpoints. Skipping this account.');
          break;
        }
        
        // For other errors, also break to avoid infinite loops
        break;
      }
    }
  }

  // Continuous mode - cycle through accounts
  async continuousMode() {
    console.clear();
    console.log('=== CONTINUOUS MODE ===\n');
    console.log('This mode will cycle through all accounts continuously.');
    console.log('Press Ctrl+C to stop.\n');

    const confirm = await this.getUserInput('Start continuous mode? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      return;
    }

    console.log('\n🔄 Starting continuous mode...\n');

    while (true) {
      // Check all accounts
      const results = await this.validator.validateAll(this.accounts);
      const validAccounts = results.filter(r => r.valid && r.energy >= config.energyThreshold);

      if (validAccounts.length === 0) {
        console.log('\n😴 No accounts have enough energy. Waiting 5 minutes...\n');
        await sleep(300000); // 5 minutes
        continue;
      }

      // Run each account with energy
      for (const result of validAccounts) {
        const account = this.accounts.find(a => a.name === result.accountName);
        if (!account) continue;

        console.log(`\n${'='.repeat(50)}`);
        console.log(`   ACCOUNT: ${account.name}`);
        console.log(`${'='.repeat(50)}\n`);

        await this.runAccountUntilComplete(account);
        
        console.log('\n⏳ Waiting 10 seconds before next account...\n');
        await sleep(10000);
      }

      console.log('\n🔄 Cycle complete. Waiting 2 minutes before next cycle...\n');
      await sleep(120000); // 2 minutes
    }
  }

  // Main run method
  async run() {
    let running = true;

    while (running) {
      const choice = await this.showMainMenu();

      switch (choice) {
        case '1':
          await this.checkAllAccounts();
          break;
        
        case '2':
          const account = await this.selectAccount();
          if (account) {
            await this.runSingleAccount(account);
          }
          break;
        
        case '3':
          await this.runAllAccounts();
          break;
        
        case '4':
          await this.continuousMode();
          break;
        
        case '5':
          running = false;
          console.log('\n👋 Goodbye!\n');
          break;
        
        default:
          console.log('\n❌ Invalid option!');
          await sleep(1000);
      }
    }

    this.rl.close();
  }

  // Cleanup
  close() {
    this.rl.close();
  }
}