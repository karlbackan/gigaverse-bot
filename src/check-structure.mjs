import { config } from './config.mjs';
import { DecisionEngine } from './decision-engine.mjs';
import * as sdk from '@fireballgg/gigaverse-sdk';

console.log('=== Gigaverse Bot Structure Check ===\n');

// Check 1: SDK imports
console.log('✓ SDK imports working');
console.log('  - Dungeon types:', Object.keys(sdk.DungeonType));
console.log('  - Endpoints:', sdk.GIGAVERSE_ENDPOINT);

// Check 2: Decision Engine
console.log('\n✓ Decision Engine loaded');
const engine = new DecisionEngine();
console.log('  - Random action:', engine.getRandomAction());

// Check 3: Config
console.log('\n✓ Configuration loaded');
console.log('  - Dungeon type:', config.dungeonType);
console.log('  - Energy threshold:', config.energyThreshold);
console.log('  - Repair threshold:', config.repairThreshold);

console.log('\n✓ All core components are properly structured');
console.log('\nTo run the bot:');
console.log('1. Add your JWT token to .env');
console.log('2. Run: npm start');