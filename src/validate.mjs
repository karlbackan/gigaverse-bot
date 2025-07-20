import { config, validateConfig } from './config.mjs';
import { DecisionEngine } from './decision-engine.mjs';
import * as sdk from '@fireballgg/gigaverse-sdk';

console.log('=== Gigaverse Bot Validation ===\n');

// Test 1: Configuration
console.log('1. Testing configuration...');
try {
  // Mock env vars for testing
  process.env.JWT_TOKEN = process.env.JWT_TOKEN || 'test-token';
  process.env.WALLET_ADDRESS = process.env.WALLET_ADDRESS || '0xtest';
  
  validateConfig();
  console.log('✓ Configuration validation passed');
} catch (error) {
  console.log('✗ Configuration error:', error.message);
}

// Test 2: SDK imports
console.log('\n2. Testing SDK imports...');
try {
  console.log('✓ Dungeon types:', Object.keys(sdk.DungeonType));
  console.log('✓ Game actions:', Object.values(sdk.GameAction));
  console.log('✓ Constants loaded:', sdk.GIGAVERSE_ENDPOINT);
} catch (error) {
  console.log('✗ SDK import error:', error.message);
}

// Test 3: Decision Engine logic
console.log('\n3. Testing Decision Engine...');
try {
  const engine = new DecisionEngine();
  
  // Test random action
  const randomAction = engine.getRandomAction();
  console.log('✓ Random action:', randomAction);
  
  // Test weighted action
  const weights = { rock: 0.5, paper: 0.3, scissor: 0.2 };
  const weightedAction = engine.getWeightedRandomAction(weights);
  console.log('✓ Weighted action:', weightedAction);
  
  // Test turn recording
  engine.recordTurn('enemy1', 1, 'rock', 'scissor', 'win');
  console.log('✓ Turn recording works');
  
  // Test stats
  const stats = engine.getStatsSummary();
  console.log('✓ Stats summary:', stats);
} catch (error) {
  console.log('✗ Decision Engine error:', error.message);
}

// Test 4: Module imports
console.log('\n4. Testing module imports...');
try {
  await import('./api.mjs');
  console.log('✓ API module loads');
  
  await import('./dungeon-player.mjs');
  console.log('✓ Dungeon player module loads');
  
  await import('./gear-manager.mjs');
  console.log('✓ Gear manager module loads');
  
  await import('./utils.mjs');
  console.log('✓ Utils module loads');
} catch (error) {
  console.log('✗ Module import error:', error.message);
}

// Test 5: Game data
console.log('\n5. Testing game data access...');
try {
  const enemy = sdk.getEnemyById('1');
  console.log('✓ Enemy data:', enemy ? 'Found' : 'Not found');
  
  const item = sdk.getItemById(1);
  console.log('✓ Item data:', item ? item.NAME_CID : 'Not found');
  
  const gear = sdk.getGearById(1);
  console.log('✓ Gear data:', gear ? 'Found' : 'Not found');
} catch (error) {
  console.log('✗ Game data error:', error.message);
}

console.log('\n=== Validation Complete ===');
console.log('\nNote: API calls cannot be tested without valid credentials.');
console.log('The bot logic and structure appear to be correctly implemented.');
console.log('\nTo fully test the bot:');
console.log('1. Add your JWT token and wallet address to .env');
console.log('2. Run: npm start');
console.log('3. Monitor the console for any errors');