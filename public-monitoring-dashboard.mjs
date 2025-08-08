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

// Account configuration
const accounts = [
  { num: 1, address: '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0', name: 'Main/Loki' },
  { num: 2, address: '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816', name: 'Account 2' },
  { num: 3, address: '0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963', name: 'Account 3' },
  { num: 4, address: '0x2153433D4c13f72b5b10af5dF5fC93866Eea046b', name: 'Account 4' },
  { num: 5, address: '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81', name: 'Account 5' }
];

// Dashboard state
let dashboardData = {};
let updateCount = 0;

// Fetch account data
async function fetchAccountData(account) {
  try {
    const [energy, gear, gameAccount, gameItems] = await Promise.all([
      api.get(`/offchain/player/energy/${account.address}`),
      api.get(`/gear/instances/${account.address}`),
      api.get(`/user/gameaccount/${account.address}`),
      api.get(`/indexer/player/gameitems/${account.address}`)
    ]);
    
    const energyData = energy.data?.entities?.[0]?.parsedData || {};
    const gearItems = gear.data?.entities || [];
    const equipped = gearItems.filter(g => g.EQUIPPED_TO_SLOT_CID > -1);
    const items = gameItems.data?.entities || [];
    
    return {
      ...account,
      energy: energyData.energyValue || 0,
      maxEnergy: 240,
      isJuiced: energyData.isPlayerJuiced || false,
      canEnterGame: gameAccount.data?.canEnterGame || false,
      totalGear: gearItems.length,
      equippedGear: equipped.length,
      gameItems: items.length,
      canPlayRegular: energyData.energyValue >= 40,
      canPlayJuiced: energyData.energyValue >= 120 && energyData.isPlayerJuiced,
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    return {
      ...account,
      error: error.message,
      lastUpdate: new Date().toISOString()
    };
  }
}

// Clear screen and move cursor to top
function clearScreen() {
  console.clear();
  process.stdout.write('\x1B[2J\x1B[0f');
}

// Render energy bar
function renderEnergyBar(energy, max, width = 20) {
  const filled = Math.floor((energy / max) * width);
  const empty = width - filled;
  
  let bar = '';
  for (let i = 0; i < filled; i++) {
    bar += '█';
  }
  for (let i = 0; i < empty; i++) {
    bar += '░';
  }
  
  // Color based on energy level
  if (energy >= 120) return chalk.green(bar);
  if (energy >= 40) return chalk.yellow(bar);
  return chalk.red(bar);
}

// Render dashboard
function renderDashboard() {
  clearScreen();
  
  // Header
  console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold('         🎮 GIGAVERSE PUBLIC API MONITORING DASHBOARD 🎮                    ') + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════════════════╝'));
  
  // Timestamp and update count
  const timestamp = new Date().toLocaleString();
  console.log(chalk.gray(`Last Update: ${timestamp} | Updates: ${updateCount} | Refresh: 30s`));
  console.log();
  
  // Account status table header
  console.log(chalk.yellow('┌─────┬──────────────┬────────────────────────┬───────┬────────┬────────────┐'));
  console.log(chalk.yellow('│ Acc │ Name         │ Energy                 │ Game  │ Gear   │ Status     │'));
  console.log(chalk.yellow('├─────┼──────────────┼────────────────────────┼───────┼────────┼────────────┤'));
  
  // Sort accounts by energy
  const sortedAccounts = Object.values(dashboardData).sort((a, b) => (b.energy || 0) - (a.energy || 0));
  
  // Render each account
  for (const account of sortedAccounts) {
    if (account.error) {
      console.log(chalk.red(`│  ${account.num}  │ ${account.name.padEnd(12)} │ ERROR: ${account.error.substring(0, 20).padEnd(22)} │`));
      continue;
    }
    
    const energyBar = renderEnergyBar(account.energy, account.maxEnergy);
    const energyText = `${String(account.energy).padStart(3)}/${account.maxEnergy}`;
    const gameStatus = account.canEnterGame ? chalk.green('✓') : chalk.red('✗');
    const gearText = `${account.equippedGear}/${account.totalGear}`;
    
    let status = '';
    if (account.canPlayJuiced) {
      status = chalk.cyan('JUICED');
    } else if (account.canPlayRegular) {
      status = chalk.green('READY');
    } else {
      const needed = 40 - account.energy;
      const minutes = needed * 6;
      status = chalk.red(`${minutes}m`);
    }
    
    const juicedIcon = account.isJuiced ? chalk.cyan('🍹') : '  ';
    
    console.log(
      chalk.yellow('│') +
      ` ${String(account.num).padEnd(3)} ` + chalk.yellow('│') +
      ` ${account.name.padEnd(12)} ` + chalk.yellow('│') +
      ` ${energyBar} ${energyText} ${juicedIcon} ` + chalk.yellow('│') +
      `   ${gameStatus}   ` + chalk.yellow('│') +
      ` ${gearText.padEnd(6)} ` + chalk.yellow('│') +
      ` ${status.padEnd(10)} ` + chalk.yellow('│')
    );
  }
  
  console.log(chalk.yellow('└─────┴──────────────┴────────────────────────┴───────┴────────┴────────────┘'));
  
  // Summary statistics
  console.log();
  console.log(chalk.cyan('📊 Summary Statistics:'));
  
  const totalEnergy = sortedAccounts.reduce((sum, a) => sum + (a.energy || 0), 0);
  const readyAccounts = sortedAccounts.filter(a => a.canPlayRegular).length;
  const juicedReady = sortedAccounts.filter(a => a.canPlayJuiced).length;
  const totalGear = sortedAccounts.reduce((sum, a) => sum + (a.totalGear || 0), 0);
  
  console.log(chalk.white(`   Total Energy: ${totalEnergy} | Ready: ${readyAccounts}/5 | Juiced Ready: ${juicedReady}/5 | Total Gear: ${totalGear}`));
  
  // Best account to play
  const bestAccount = sortedAccounts.find(a => a.canPlayJuiced) || sortedAccounts.find(a => a.canPlayRegular);
  if (bestAccount) {
    console.log(chalk.green(`   🎯 Best Account: #${bestAccount.num} ${bestAccount.name} (${bestAccount.energy} energy)`));
  } else {
    const nextReady = sortedAccounts[0];
    if (nextReady && nextReady.energy < 40) {
      const timeToReady = (40 - nextReady.energy) * 6;
      console.log(chalk.yellow(`   ⏳ Next Ready: #${nextReady.num} in ${timeToReady} minutes`));
    }
  }
  
  // Analytics tracking
  console.log();
  console.log(chalk.gray('Tracking analytics events...'));
  
  // Controls
  console.log();
  console.log(chalk.gray('Press Ctrl+C to exit'));
}

// Update dashboard data
async function updateDashboard() {
  updateCount++;
  
  // Fetch all account data in parallel
  const updates = await Promise.all(
    accounts.map(account => fetchAccountData(account))
  );
  
  // Update dashboard data
  for (const update of updates) {
    dashboardData[update.num] = update;
  }
  
  // Track analytics event
  try {
    await api.post('/analytics/event', {
      event: 'dashboard_update',
      data: {
        updateCount,
        timestamp: Date.now(),
        totalEnergy: Object.values(dashboardData).reduce((sum, a) => sum + (a.energy || 0), 0)
      }
    });
  } catch (error) {
    // Silent fail for analytics
  }
  
  // Render the dashboard
  renderDashboard();
}

// Main monitoring loop
async function startMonitoring() {
  console.log(chalk.cyan('🚀 Starting Gigaverse Monitoring Dashboard...'));
  console.log(chalk.gray('Fetching initial data...'));
  
  // Initial update
  await updateDashboard();
  
  // Set up refresh interval (30 seconds)
  setInterval(updateDashboard, 30000);
  
  // Handle exit
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Dashboard stopped. Goodbye!'));
    process.exit(0);
  });
}

// Start the dashboard
startMonitoring().catch(error => {
  console.error(chalk.red('Failed to start dashboard:'), error);
  process.exit(1);
});