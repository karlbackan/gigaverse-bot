import { config } from './config.mjs';
import { JWTValidator } from './jwt-validator.mjs';
import { DungeonPlayer } from './dungeon-player.mjs';
import { getDirectEnergy, getDirectDungeonState, resetActionToken } from './direct-api.mjs';
import { sleep } from './utils.mjs';
import readline from 'readline';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export class AccountManager {
  constructor() {
    this.configPath = path.join(process.cwd(), '.gigaverse-runtime.json');
    this.accounts = this.loadAccounts();
    this.validator = new JWTValidator();
    this.energyMode = this.loadEnergyMode(); // Load saved energy mode or default to 40
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Load energy mode from config file
  loadEnergyMode() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        const mode = config.energyMode || 40;
        console.log(`Loaded saved energy mode: ${mode} energy`);
        return mode;
      }
    } catch (error) {
      console.log('Could not load saved energy mode, using default (40)');
    }
    return 40; // Default to 40 energy
  }

  // Save energy mode to config file
  saveEnergyMode() {
    try {
      const config = {
        energyMode: this.energyMode,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.log('Warning: Could not save energy mode:', error.message);
    }
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
    console.log(`⚡ Energy Mode: ${this.energyMode} energy ${this.energyMode === 120 ? '(Juiced)' : '(Regular)'}\n`);
    console.log('OPTIONS:');
    console.log('  1. Check all accounts status');
    console.log('  2. Run single account');
    console.log('  3. Run all valid accounts');
    console.log('  4. Continuous mode (cycle through accounts)');
    console.log('  5. Change energy mode (40/120)');
    console.log('  6. Check broken gear/charms (0 durability)');
    console.log('  7. Run gear maintenance (repair/restore/salvage)');
    console.log('  8. Exit\n');

    const choice = await this.getUserInput('Select option (1-8): ');
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

    // Sort by energy (highest first) for optimal energy usage
    validAccounts.sort((a, b) => b.energy - a.energy);
    console.log(`\n🎮 Running ${validAccounts.length} valid accounts (sorted by energy)...\n`);

    // Show which accounts will be skipped
    const invalidAccounts = results.filter(r => !r.valid);
    if (invalidAccounts.length > 0) {
      console.log('⚠️  Skipping invalid accounts:');
      invalidAccounts.forEach(acc => {
        console.log(`   - ${acc.accountName}: ${acc.error}`);
      });
      console.log('');
    }

    // Show order of execution
    console.log('📋 Execution order:');
    validAccounts.forEach((acc, idx) => {
      console.log(`   ${idx + 1}. ${acc.accountName}: ${acc.energy} energy`);
    });
    console.log('');

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

    // Set energy mode based on menu selection
    config.isJuiced = this.energyMode === 120;
    // CRITICAL: Update energy threshold to match selected mode
    // This prevents bot from trying juiced runs when it doesn't have enough energy
    config.energyThreshold = this.energyMode;
    console.log(`⚡ Using ${this.energyMode} energy mode ${this.energyMode === 120 ? '(Juiced)' : '(Regular)'}`);

    // CRITICAL: Reset BOTH action token AND HTTPS connections when switching accounts
    // This prevents connection reuse that causes "Error handling action" errors
    resetActionToken();

    // Also reset gear API connections
    const { resetGearConnections } = await import('./direct-api-gear.mjs');
    resetGearConnections();

    // Extract wallet address from token
    const parts = account.token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const walletAddress = payload.address || payload.user?.caseSensitiveAddress;

    // CRITICAL: Update config.walletAddress for this account
    // Many API functions use config.walletAddress as default parameter
    // Without this, they might fetch data from the previous account!
    config.walletAddress = walletAddress;

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
        } else if (status === 'account_error') {
          // Account encountered errors - skip to next account
          console.log('\n⚠️  Account encountered errors - moving to next account\n');
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

  // Change energy mode
  async changeEnergyMode() {
    console.clear();
    console.log('=== CHANGE ENERGY MODE ===\n');
    console.log(`Current mode: ${this.energyMode} energy ${this.energyMode === 120 ? '(Juiced)' : '(Regular)'}\n`);
    console.log('Available modes:');
    console.log('  1. 40 energy (Regular)');
    console.log('  2. 120 energy (Juiced)');
    console.log('  3. Cancel\n');

    const choice = await this.getUserInput('Select mode (1-3): ');

    switch (choice) {
      case '1':
        this.energyMode = 40;
        this.saveEnergyMode();
        console.log('\n✅ Energy mode set to 40 (Regular) and saved');
        break;
      case '2':
        this.energyMode = 120;
        this.saveEnergyMode();
        console.log('\n✅ Energy mode set to 120 (Juiced) and saved');
        break;
      case '3':
        console.log('\n❌ Cancelled');
        break;
      default:
        console.log('\n❌ Invalid option');
    }

    await this.getUserInput('\nPress Enter to continue...');
  }

  // Check broken gear/charms across all accounts
  async checkBrokenGearCharms() {
    console.clear();
    console.log('=== BROKEN GEAR & CHARMS (0 DURABILITY) ===\n');
    console.log('Scanning all accounts...\n');

    const { GearManager } = await import('./gear-manager.mjs');
    const { getDirectGearInstances } = await import('./direct-api-gear.mjs');

    let totalBrokenItems = 0;

    // Check each account
    for (const account of this.accounts) {
      try {
        // Extract wallet address from token
        const parts = account.token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        const walletAddress = payload.address || payload.user?.caseSensitiveAddress;

        // Set up config for this account
        process.env.JWT_TOKEN = account.token;
        config.jwtToken = account.token;
        config.walletAddress = walletAddress;

        // Get gear instances for this account
        const gearResponse = await getDirectGearInstances(walletAddress);
        const allItems = gearResponse?.entities || [];

        // Filter for equipped items with 0 durability
        const brokenItems = allItems.filter(item => {
          const slot = item.EQUIPPED_TO_SLOT_CID;
          const durability = item.DURABILITY_CID || 0;
          const isEquipped = slot !== null && slot > -1;
          return isEquipped && durability === 0;
        });

        if (brokenItems.length > 0) {
          console.log(`\n📦 ${account.name} (${walletAddress})`);
          console.log('─'.repeat(70));

          const gearManager = new GearManager(walletAddress);
          await gearManager.initializeItemClassification();

          brokenItems.forEach(item => {
            const itemId = item.GAME_ITEM_ID_CID;
            const slot = item.EQUIPPED_TO_SLOT_CID;
            const slotIndex = item.EQUIPPED_TO_INDEX_CID;
            const rarity = item.RARITY_CID || 0;
            const durability = item.DURABILITY_CID || 0;
            const repairCount = item.REPAIR_COUNT_CID || 0;
            const isCharm = gearManager.isCharm(item);
            const itemType = isCharm ? 'Charm' : 'Gear';
            const maxRepairs = isCharm ? 2 : 5;
            const maxDurability = gearManager.getMaxDurability(rarity, isCharm);

            const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
            const rarityName = rarityNames[rarity] || 'Unknown';
            const emoji = isCharm ? '💎' : '⚙️';

            console.log(`  ${emoji} ${itemType} #${itemId} (${rarityName})`);
            console.log(`     Slot: ${slot}${slotIndex !== null ? ` [Index ${slotIndex}]` : ''}`);
            console.log(`     Durability: ${durability}/${maxDurability} ⚠️  BROKEN`);
            console.log(`     Repairs: ${repairCount}/${maxRepairs}`);

            if (repairCount >= maxRepairs) {
              if (isCharm) {
                console.log(`     → ♻️  Ready to SALVAGE (at max repairs)`);
              } else {
                console.log(`     → 🔄 Ready to RESTORE (at max repairs)`);
              }
            } else {
              console.log(`     → 🔧 Can be REPAIRED`);
            }
            console.log('');
          });

          totalBrokenItems += brokenItems.length;
        }

      } catch (error) {
        console.log(`\n❌ ${account.name}: Error checking gear - ${error.message}`);
      }
    }

    if (totalBrokenItems === 0) {
      console.log('\n✅ No broken gear or charms found across all accounts!');
    } else {
      console.log(`\n📊 Total broken items: ${totalBrokenItems}`);
    }

    await this.getUserInput('\nPress Enter to return to menu...');
  }

  // Run gear maintenance on all accounts
  async runGearMaintenance() {
    console.clear();
    console.log('=== GEAR MAINTENANCE (REPAIR/RESTORE/SALVAGE) ===\n');
    console.log('This will check all accounts and perform maintenance on broken gear/charms.\n');

    const confirm = await this.getUserInput('Proceed with gear maintenance? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('\n❌ Cancelled');
      await this.getUserInput('\nPress Enter to return to menu...');
      return;
    }

    console.log('\n🔧 Starting gear maintenance...\n');

    const { GearManager } = await import('./gear-manager.mjs');
    const { resetGearConnections } = await import('./direct-api-gear.mjs');

    let totalProcessed = 0;

    // Process each account
    for (const account of this.accounts) {
      try {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📦 Processing: ${account.name}`);
        console.log('='.repeat(70));

        // Extract wallet address from token
        const parts = account.token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        const walletAddress = payload.address || payload.user?.caseSensitiveAddress;

        // Set up config for this account
        process.env.JWT_TOKEN = account.token;
        config.jwtToken = account.token;
        config.walletAddress = walletAddress;

        // Reset connections for this account
        resetGearConnections();

        console.log(`Wallet: ${walletAddress}\n`);

        // Create gear manager and check status
        const gearManager = new GearManager(walletAddress);
        await gearManager.initializeItemClassification();

        console.log('🔍 Checking gear status...\n');
        const needsRepair = await gearManager.checkGearStatus();

        if (needsRepair.length === 0) {
          console.log('✅ No broken items found - all gear is functional!\n');
          continue;
        }

        console.log(`Found ${needsRepair.length} broken item(s) that need attention:\n`);

        // Display what will be done
        needsRepair.forEach(item => {
          const emoji = item.type === 'charm' ? '💎' : '⚙️';
          const action = item.shouldRestore ? 'RESTORE' : (item.shouldSalvage ? 'SALVAGE & REPLACE' : 'REPAIR');
          console.log(`  ${emoji} ${item.type.toUpperCase()} #${item.itemId} (Slot ${item.slot}) - Repairs: ${item.repairCount}/${item.type === 'charm' ? 2 : 5}`);
          console.log(`     → Will ${action}`);
        });

        console.log('\n🔧 Performing maintenance...\n');

        // Perform repairs - repairAllGear doesn't return a result object
        await gearManager.repairAllGear(needsRepair);

        // If we get here without throwing, it succeeded
        console.log(`\n✅ ${account.name}: Maintenance completed successfully!`);
        console.log(`   - Items processed: ${needsRepair.length}`);
        totalProcessed += needsRepair.length;

        // Wait between accounts
        if (this.accounts.indexOf(account) < this.accounts.length - 1) {
          console.log('\n⏳ Waiting 3 seconds before next account...\n');
          await sleep(3000);
        }

      } catch (error) {
        console.log(`\n❌ ${account.name}: Error during maintenance - ${error.message}\n`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 MAINTENANCE SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total items processed: ${totalProcessed}`);
    console.log('✅ Gear maintenance complete!\n');

    await this.getUserInput('\nPress Enter to return to menu...');
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

      // Sort by energy (highest first) for optimal energy usage
      validAccounts.sort((a, b) => b.energy - a.energy);
      console.log(`\n🔄 Cycle starting with ${validAccounts.length} accounts (sorted by energy)\n`);

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
          await this.changeEnergyMode();
          break;

        case '6':
          await this.checkBrokenGearCharms();
          break;

        case '7':
          await this.runGearMaintenance();
          break;

        case '8':
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