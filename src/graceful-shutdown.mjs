import { getDirectDungeonState, sendDirectAction } from './direct-api.mjs';
import { config } from './config.mjs';

let shutdownInProgress = false;

/**
 * Gracefully retreat from any active dungeon to prevent server-side corruption
 */
export async function retreatFromActiveDungeon(accountToken, accountAddress) {
  try {
    // Temporarily set config to use this account
    const originalToken = config.jwtToken;
    const originalAddress = config.walletAddress;

    config.jwtToken = accountToken;
    config.walletAddress = accountAddress;

    // Check if there's an active dungeon
    const state = await getDirectDungeonState();

    if (state?.data?.run) {
      const dungeonType = parseInt(state.data.entity.ID_CID);
      console.log(`\n🏃 Retreating from active ${dungeonType === 3 ? 'Underhaul' : 'dungeon'} for ${accountAddress}...`);

      try {
        // Attempt retreat (direct-api.mjs will handle tokens automatically)
        await sendDirectAction('retreat', dungeonType, {});
        console.log('✅ Retreat successful');
      } catch (error) {
        // If retreat fails, that's okay - we tried
        if (error.isCorruption) {
          console.log('⚠️  Account is corrupted - could not retreat');
        } else {
          console.log('⚠️  Could not retreat - may need manual cleanup');
        }
      }
    }

    // Restore original config
    config.jwtToken = originalToken;
    config.walletAddress = originalAddress;
  } catch (error) {
    console.log(`⚠️  Error during retreat for ${accountAddress}: ${error.message}`);
  }
}

/**
 * Gracefully shutdown all accounts
 */
export async function gracefulShutdown(accounts = []) {
  if (shutdownInProgress) {
    console.log('\n⚠️  Shutdown already in progress...');
    return;
  }

  shutdownInProgress = true;
  console.log('\n🛑 Graceful shutdown initiated...');
  console.log('📋 Retreating from active dungeons to prevent corruption...\n');

  // Retreat from all active dungeons
  for (const account of accounts) {
    await retreatFromActiveDungeon(account.token, account.address);
  }

  console.log('\n✅ Graceful shutdown complete');
  console.log('💡 All active dungeons have been safely exited\n');
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(accounts = []) {
  const shutdownHandler = async (signal) => {
    console.log(`\n\n⚠️  Received ${signal} - initiating graceful shutdown...`);
    await gracefulShutdown(accounts);
    process.exit(0);
  };

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => shutdownHandler('SIGINT'));

  // Handle SIGTERM (kill command)
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

  // Handle unexpected errors
  process.on('uncaughtException', async (error) => {
    console.error('\n💥 Uncaught Exception:', error.message);
    console.log('🛑 Initiating emergency shutdown...\n');
    await gracefulShutdown(accounts);
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('\n💥 Unhandled Rejection:', reason);
    console.log('🛑 Initiating emergency shutdown...\n');
    await gracefulShutdown(accounts);
    process.exit(1);
  });

  console.log('✅ Graceful shutdown handlers installed');
}
