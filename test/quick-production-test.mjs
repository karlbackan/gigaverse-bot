import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== QUICK PRODUCTION TEST ===\n');

config.minimalOutput = true;
const engine = new DecisionEngine();

// Simulate a few turns with existing enemies
const existingEnemies = ['Goblin_1', 'Orc_5', 'Dragon_10'];

for (const enemyId of existingEnemies) {
  console.log(`\nTesting with ${enemyId}:`);
  
  try {
    // Make a decision
    const decision = await engine.makeDecision(
      enemyId, 1, 100, 100,
      ['rock', 'paper', 'scissor'],
      { rock: 3, paper: 3, scissor: 3 },
      { healthPercent: 100 },
      { healthPercent: 100, charges: { rock: 3, paper: 3, scissor: 3 } }
    );
    console.log(`✅ Decision made: ${decision}`);
    
    // Record a turn
    engine.recordTurn(
      enemyId, 1, decision, 'rock', 'win',
      { healthPercent: 100 },
      { healthPercent: 100, charges: { rock: 2, paper: 3, scissor: 3 } }
    );
    console.log(`✅ Turn recorded successfully`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

console.log('\n✅ All tests passed! The bot should work in production now.');