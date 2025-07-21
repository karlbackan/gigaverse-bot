import { validateConfig, config } from './config.mjs';
import { testConnection, getPlayerState, initializeFireballApi } from './api.mjs';
import { DungeonPlayer } from './dungeon-player.mjs';
import { GearManager } from './gear-manager.mjs';
import { sleep, formatTime, calculateEnergyRegenTime } from './utils.mjs';

console.log(`
╔═══════════════════════════════════════╗
║      Gigaverse Dungetron Bot          ║
║        Regular Mode (40 Energy)       ║
╚═══════════════════════════════════════╝
`);

// Initialize components
let dungeonPlayer;
let gearManager;
let isRunning = true;

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down bot gracefully...');
  isRunning = false;
  process.exit(0);
});

// Main bot loop
async function runBot() {
  try {
    // Validate configuration
    validateConfig();

    // Test API connection
    console.log('Connecting to Gigaverse API...');
    if (!(await testConnection())) {
      throw new Error('Failed to connect to API. Check your JWT token.');
    }

    // Statistics API disabled (requires Hasura JWT)

    // Initialize components
    dungeonPlayer = new DungeonPlayer();
    gearManager = new GearManager();

    console.log('\nBot initialized successfully!');
    console.log('Starting main loop...\n');

    // Main loop
    while (isRunning) {
      try {
        // Get current player state
        const playerState = await getPlayerState();
        const energy = parseInt(playerState.account.energy) || 0;
        
        console.log(`\n[${new Date().toLocaleTimeString()}] Energy: ${energy}`);

        // Gear maintenance disabled - API not working
        // await gearManager.performMaintenance();

        // Check if we can play
        let shouldWait = true;
        
        if (energy >= config.energyThreshold) {
          // Play dungeon - returns whether we should wait after
          const dungeonResult = await dungeonPlayer.playDungeon();
          
          if (dungeonResult === 'daily_limit') {
            console.log('\n🛑 Daily dungeon limit reached. Stopping bot.');
            console.log('The bot will stop checking until tomorrow.');
            return; // Exit the bot completely
          }
          
          shouldWait = dungeonResult !== 'continue_playing';
        } else {
          // Calculate time until we have enough energy
          const regenTime = calculateEnergyRegenTime(
            energy,
            config.energyThreshold,
            1111111 // Regular regen rate (1 energy per 9 seconds)
          );
          
          console.log(`Not enough energy. Need ${config.energyThreshold - energy} more.`);
          console.log(`Time until ready: ${formatTime(regenTime)}`);
        }

        // Only show stats and wait message if we're actually waiting
        if (shouldWait) {
          // Display bot stats
          const status = dungeonPlayer.getStatus();
          if (status.stats.turnsRecorded > 0) {
            console.log(`\nBot Stats:`);
            console.log(`- Enemies analyzed: ${status.stats.enemiesAnalyzed}`);
            console.log(`- Recent win rate: ${(status.stats.recentWinRate * 100).toFixed(1)}%`);
          }
          
          console.log(`\nWaiting ${formatTime(config.checkInterval)} before next check...`);
          await sleep(config.checkInterval);
        }

      } catch (loopError) {
        console.error('Error in main loop:', loopError.message);
        console.log('Retrying in 30 seconds...');
        await sleep(30000);
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Display usage instructions
console.log('Starting bot...');
console.log('\nIMPORTANT: This bot is for educational purposes only.');
console.log('Make sure you have permission to use automation with Gigaverse.');
console.log('Using bots may violate the game\'s Terms of Service.\n');

console.log('Configuration:');
const dungeonMode = config.isJuiced ? 'Juiced' : 'Regular';
console.log(`- Dungeon: Dungetron 5000 (${dungeonMode}, ${config.energyThreshold} energy)`);
console.log(`- Repair threshold: ${config.repairThreshold}%`);
console.log(`- Check interval: ${formatTime(config.checkInterval)}`);
console.log('\nPress Ctrl+C to stop the bot.\n');

// Start the bot
runBot();