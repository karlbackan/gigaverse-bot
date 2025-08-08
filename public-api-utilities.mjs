#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000
});

// ============================================
// PUBLIC ENDPOINT UTILITIES (No Auth Required)
// ============================================

/**
 * Get complete account information for any address
 */
export async function getAccountInfo(address) {
  try {
    console.log(chalk.blue(`\n📊 Fetching account info for ${address.substring(0, 10)}...`));
    
    // Fetch all public data in parallel
    const [account, gameAccount, energy, gear, balances, gameItems] = await Promise.all([
      api.get(`/account/${address}`),
      api.get(`/user/gameaccount/${address}`),
      api.get(`/offchain/player/energy/${address}`),
      api.get(`/gear/instances/${address}`),
      api.get(`/importexport/balances/${address}`),
      api.get(`/indexer/player/gameitems/${address}`)
    ]);
    
    return {
      account: account.data,
      gameAccount: gameAccount.data,
      energy: energy.data?.entities?.[0],
      gear: gear.data?.entities || [],
      balances: balances.data?.entities || [],
      gameItems: gameItems.data?.entities || []
    };
  } catch (error) {
    console.error(chalk.red(`Failed to fetch account info: ${error.message}`));
    return null;
  }
}

/**
 * Monitor player energy levels
 */
export async function monitorEnergy(address, interval = 60000) {
  console.log(chalk.green(`\n⚡ Starting energy monitor for ${address.substring(0, 10)}...`));
  console.log(chalk.gray(`Checking every ${interval / 1000} seconds\n`));
  
  const checkEnergy = async () => {
    try {
      const response = await api.get(`/offchain/player/energy/${address}`);
      const energy = response.data?.entities?.[0]?.parsedData;
      
      if (energy) {
        const timestamp = new Date().toLocaleTimeString();
        const energyBar = '█'.repeat(Math.floor(energy.energyValue / 10)) + 
                         '░'.repeat(Math.floor((240 - energy.energyValue) / 10));
        
        console.log(`[${timestamp}] Energy: ${chalk.yellow(energy.energyValue)}/240 [${energyBar}]`);
        
        if (energy.isPlayerJuiced) {
          console.log(chalk.cyan('   🍹 Player is JUICED!'));
        }
        
        if (energy.energyValue >= 40) {
          console.log(chalk.green('   ✅ Ready to play dungeon!'));
        } else {
          const regenTime = (40 - energy.energyValue) * 6; // 6 mins per energy
          console.log(chalk.red(`   ⏳ Need ${40 - energy.energyValue} more energy (${regenTime} minutes)`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`Energy check failed: ${error.message}`));
    }
  };
  
  // Initial check
  await checkEnergy();
  
  // Set up interval
  const intervalId = setInterval(checkEnergy, interval);
  
  // Return stop function
  return () => clearInterval(intervalId);
}

/**
 * Track analytics events (public endpoint)
 */
export async function trackEvent(eventName, eventData = {}) {
  try {
    const response = await api.post('/analytics/event', {
      event: eventName,
      data: eventData,
      timestamp: Date.now()
    });
    
    if (response.data?.success) {
      console.log(chalk.green(`✅ Event tracked: ${eventName}`));
      return true;
    }
  } catch (error) {
    console.error(chalk.red(`Failed to track event: ${error.message}`));
    return false;
  }
}

/**
 * Get player gear analysis
 */
export async function analyzeGear(address) {
  try {
    console.log(chalk.blue(`\n🛡️  Analyzing gear for ${address.substring(0, 10)}...`));
    
    const response = await api.get(`/gear/instances/${address}`);
    const gearItems = response.data?.entities || [];
    
    const equipped = gearItems.filter(g => g.EQUIPPED_TO_SLOT_CID > -1);
    const unequipped = gearItems.filter(g => g.EQUIPPED_TO_SLOT_CID === -1);
    
    console.log(chalk.yellow(`\n📊 Gear Statistics:`));
    console.log(`   Total gear items: ${gearItems.length}`);
    console.log(`   Equipped: ${equipped.length}`);
    console.log(`   In inventory: ${unequipped.length}`);
    
    if (equipped.length > 0) {
      console.log(chalk.green(`\n🎯 Equipped Items:`));
      equipped.forEach(item => {
        const slot = getSlotName(item.EQUIPPED_TO_SLOT_CID);
        console.log(`   Slot ${slot}: ${item.docId}`);
      });
    }
    
    return {
      total: gearItems.length,
      equipped: equipped,
      unequipped: unequipped
    };
  } catch (error) {
    console.error(chalk.red(`Failed to analyze gear: ${error.message}`));
    return null;
  }
}

function getSlotName(slotId) {
  const slots = {
    0: 'Head',
    1: 'Chest',
    2: 'Legs',
    3: 'Feet',
    4: 'Weapon',
    5: 'Shield'
  };
  return slots[slotId] || slotId;
}

/**
 * Check if account can play
 */
export async function checkPlayability(address) {
  try {
    console.log(chalk.blue(`\n🎮 Checking playability for ${address.substring(0, 10)}...`));
    
    const [gameAccount, energy] = await Promise.all([
      api.get(`/user/gameaccount/${address}`),
      api.get(`/offchain/player/energy/${address}`)
    ]);
    
    const canEnterGame = gameAccount.data?.canEnterGame;
    const currentEnergy = energy.data?.entities?.[0]?.parsedData?.energyValue || 0;
    const isJuiced = energy.data?.entities?.[0]?.parsedData?.isPlayerJuiced || false;
    
    console.log(chalk.yellow(`\n📊 Playability Status:`));
    console.log(`   Can enter game: ${canEnterGame ? chalk.green('YES') : chalk.red('NO')}`);
    console.log(`   Current energy: ${currentEnergy}/240`);
    console.log(`   Juiced status: ${isJuiced ? chalk.cyan('JUICED') : chalk.gray('Normal')}`);
    
    const canPlayRegular = currentEnergy >= 40;
    const canPlayJuiced = currentEnergy >= 120 && isJuiced;
    
    console.log(chalk.yellow(`\n🎯 Dungeon Availability:`));
    console.log(`   Regular dungeon (40 energy): ${canPlayRegular ? chalk.green('READY') : chalk.red('NOT READY')}`);
    console.log(`   Juiced dungeon (120 energy): ${canPlayJuiced ? chalk.green('READY') : chalk.red('NOT READY')}`);
    
    if (!canPlayRegular) {
      const timeToRegular = (40 - currentEnergy) * 6;
      console.log(chalk.gray(`   Time until regular: ${timeToRegular} minutes`));
    }
    
    return {
      canEnterGame,
      currentEnergy,
      isJuiced,
      canPlayRegular,
      canPlayJuiced
    };
  } catch (error) {
    console.error(chalk.red(`Failed to check playability: ${error.message}`));
    return null;
  }
}

/**
 * Compare multiple accounts
 */
export async function compareAccounts(addresses) {
  console.log(chalk.blue(`\n📊 Comparing ${addresses.length} accounts...\n`));
  
  const results = [];
  
  for (const address of addresses) {
    const info = await getAccountInfo(address);
    if (info) {
      results.push({
        address,
        energy: info.energy?.parsedData?.energyValue || 0,
        isJuiced: info.energy?.parsedData?.isPlayerJuiced || false,
        canEnterGame: info.gameAccount?.canEnterGame || false,
        gearCount: info.gear.length,
        itemCount: info.gameItems.length,
        noob: info.gameAccount?.noob
      });
    }
  }
  
  // Sort by energy
  results.sort((a, b) => b.energy - a.energy);
  
  console.log(chalk.yellow('Account Comparison:'));
  console.log('━'.repeat(80));
  console.log('Address         Energy  Juiced  Can Play  Gear  Items  Noob');
  console.log('━'.repeat(80));
  
  results.forEach(r => {
    const shortAddr = r.address.substring(0, 10) + '...';
    const energyStr = String(r.energy).padEnd(6);
    const juicedStr = (r.isJuiced ? '✓' : '✗').padEnd(7);
    const canPlayStr = (r.canEnterGame ? '✓' : '✗').padEnd(9);
    const gearStr = String(r.gearCount).padEnd(5);
    const itemStr = String(r.itemCount).padEnd(6);
    const noobStr = r.noob || 'N/A';
    
    const energyColor = r.energy >= 40 ? chalk.green : chalk.red;
    
    console.log(
      `${shortAddr}  ${energyColor(energyStr)}  ${juicedStr}  ${canPlayStr}  ${gearStr}  ${itemStr}  ${noobStr}`
    );
  });
  
  console.log('━'.repeat(80));
  
  return results;
}

/**
 * Track player progress over time
 */
export async function trackProgress(address, duration = 3600000) { // 1 hour default
  console.log(chalk.blue(`\n📈 Tracking progress for ${address.substring(0, 10)}...`));
  console.log(chalk.gray(`Duration: ${duration / 60000} minutes\n`));
  
  const history = [];
  const startTime = Date.now();
  
  const track = async () => {
    try {
      const energy = await api.get(`/offchain/player/energy/${address}`);
      const energyValue = energy.data?.entities?.[0]?.parsedData?.energyValue || 0;
      
      history.push({
        timestamp: Date.now(),
        energy: energyValue
      });
      
      // Show mini graph
      const graph = history.slice(-20).map(h => {
        const bar = Math.floor(h.energy / 40);
        return ['░', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'][Math.min(bar, 8)];
      }).join('');
      
      console.log(`[${new Date().toLocaleTimeString()}] Energy: ${energyValue} ${graph}`);
      
    } catch (error) {
      console.error(chalk.red(`Tracking error: ${error.message}`));
    }
  };
  
  // Initial track
  await track();
  
  // Set up interval
  const intervalId = setInterval(track, 60000); // Every minute
  
  // Auto-stop after duration
  setTimeout(() => {
    clearInterval(intervalId);
    console.log(chalk.green('\n✅ Tracking complete!'));
    
    // Show summary
    const maxEnergy = Math.max(...history.map(h => h.energy));
    const minEnergy = Math.min(...history.map(h => h.energy));
    const avgEnergy = history.reduce((sum, h) => sum + h.energy, 0) / history.length;
    
    console.log(chalk.yellow('\n📊 Summary:'));
    console.log(`   Max energy: ${maxEnergy}`);
    console.log(`   Min energy: ${minEnergy}`);
    console.log(`   Average: ${avgEnergy.toFixed(1)}`);
    console.log(`   Data points: ${history.length}`);
  }, duration);
  
  return () => clearInterval(intervalId);
}

// ============================================
// CLI INTERFACE
// ============================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  const addresses = {
    '1': '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0',
    '2': '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816',
    '3': '0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963',
    '4': '0x2153433D4c13f72b5b10af5dF5fC93866Eea046b',
    '5': '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81'
  };
  
  const help = () => {
    console.log(chalk.yellow('\n🎮 Gigaverse Public API Utilities\n'));
    console.log('Commands:');
    console.log('  info <address|1-5>      - Get complete account info');
    console.log('  energy <address|1-5>    - Monitor energy levels');
    console.log('  gear <address|1-5>      - Analyze gear');
    console.log('  check <address|1-5>     - Check playability');
    console.log('  compare                 - Compare all 5 accounts');
    console.log('  track <address|1-5>     - Track progress over time');
    console.log('  event <name> [data]     - Track analytics event');
    console.log('  help                    - Show this help');
    console.log('\nExamples:');
    console.log('  npm run public info 1');
    console.log('  npm run public energy 0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0');
    console.log('  npm run public compare');
    console.log('  npm run public event "test_event" \'{"value": 123}\'');
  };
  
  const getAddress = (input) => {
    if (addresses[input]) return addresses[input];
    if (input?.startsWith('0x')) return input;
    console.error(chalk.red('Invalid address or account number'));
    process.exit(1);
  };
  
  switch (command) {
    case 'info':
      if (!args[0]) {
        console.error(chalk.red('Address required'));
        help();
      } else {
        const info = await getAccountInfo(getAddress(args[0]));
        if (info) {
          console.log(chalk.green('\n✅ Account info retrieved successfully'));
        }
      }
      break;
      
    case 'energy':
      if (!args[0]) {
        console.error(chalk.red('Address required'));
        help();
      } else {
        await monitorEnergy(getAddress(args[0]));
        // Keep process alive
        process.stdin.resume();
      }
      break;
      
    case 'gear':
      if (!args[0]) {
        console.error(chalk.red('Address required'));
        help();
      } else {
        await analyzeGear(getAddress(args[0]));
      }
      break;
      
    case 'check':
      if (!args[0]) {
        console.error(chalk.red('Address required'));
        help();
      } else {
        await checkPlayability(getAddress(args[0]));
      }
      break;
      
    case 'compare':
      await compareAccounts(Object.values(addresses));
      break;
      
    case 'track':
      if (!args[0]) {
        console.error(chalk.red('Address required'));
        help();
      } else {
        await trackProgress(getAddress(args[0]));
        // Keep process alive
        process.stdin.resume();
      }
      break;
      
    case 'event':
      if (!args[0]) {
        console.error(chalk.red('Event name required'));
        help();
      } else {
        const eventData = args[1] ? JSON.parse(args[1]) : {};
        await trackEvent(args[0], eventData);
      }
      break;
      
    case 'help':
    default:
      help();
      break;
  }
}