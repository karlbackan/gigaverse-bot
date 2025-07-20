import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Authentication
  jwtToken: process.env.JWT_TOKEN,
  walletAddress: process.env.WALLET_ADDRESS,

  // Bot Settings
  dungeonType: 1, // Dungetron 5000 (Normal mode)
  underhaulDungeonType: 3, // Dungetron Underhaul (Fallback when hitting limits)
  energyThreshold: parseInt(process.env.ENERGY_THRESHOLD || '40'),
  repairThreshold: parseInt(process.env.REPAIR_THRESHOLD || '30'),
  minEnergyToRun: parseInt(process.env.MIN_ENERGY_TO_RUN || '40'),

  // Delays
  actionDelay: parseInt(process.env.ACTION_DELAY || '2000'),
  runDelay: parseInt(process.env.RUN_DELAY || '5000'),
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '60000'),

  // Debug
  debug: process.env.DEBUG === 'true',

  // Upgrade selection weights
  upgradeWeights: {
    maxArmor: 1.5,        // AddMaxArmor multiplier
    attack: 1.1,          // Weapon attack upgrade multiplier
    defense: 1.0,         // Weapon defense upgrade multiplier
    maxHealth: 0.6,       // AddMaxHealth multiplier
    healThreshold: 0.3    // Health percentage threshold for healing (30%)
  }
};

// Validate configuration
export function validateConfig() {
  if (!config.jwtToken) {
    throw new Error('JWT_TOKEN is required in .env file');
  }
  if (!config.walletAddress) {
    throw new Error('WALLET_ADDRESS is required in .env file');
  }
  
  console.log('Configuration loaded successfully');
  if (config.debug) {
    console.log('Debug mode enabled');
  }
}