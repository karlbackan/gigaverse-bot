import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== DEBUG EXPLORATION & FALLBACK ===\n');

config.minimalOutput = false;
const engine = new DecisionEngine();

// Test with a completely new enemy (no data)
console.log('TEST 1: New enemy with no data, can\'t play rock\n');

const moves = { rock: 0, paper: 0, scissor: 0 };
for (let i = 0; i < 10; i++) {
  console.log(`\n--- Decision ${i + 1} ---`);
  const decision = await engine.makeDecision(
    'NewEnemy' + i, // Always new enemy
    1, 100, 100,
    ['rock', 'paper', 'scissor'],
    { rock: 3, paper: 3, scissor: 3 },
    { healthPercent: 100 },
    { healthPercent: 100, charges: { rock: 0, paper: 3, scissor: 3 } }
  );
  moves[decision]++;
  console.log(`DECISION: ${decision}`);
}

console.log(`\nRESULTS:`);
console.log(`Rock: ${moves.rock}`);
console.log(`Paper: ${moves.paper} (should be 0 or very low)`);
console.log(`Scissor: ${moves.scissor}`);

// Test the fallback strategy directly
console.log('\n\nTEST 2: Fallback strategy behavior\n');

// Create a scenario that will use fallback
const fallbackMoves = { rock: 0, paper: 0, scissor: 0 };
for (let i = 0; i < 10; i++) {
  const decision = await engine.makeDecision(
    'NoDataEnemy' + i, 
    1, 100, 100,
    ['rock', 'paper', 'scissor'],
    { rock: 3, paper: 3, scissor: 3 },
    { healthPercent: 100 },
    { healthPercent: 100 }
  );
  fallbackMoves[decision]++;
}

console.log('Fallback strategy distribution (no charge info):');
console.log(`Rock: ${fallbackMoves.rock}`);
console.log(`Paper: ${fallbackMoves.paper}`);
console.log(`Scissor: ${fallbackMoves.scissor}`);

console.log('\n\nCONCLUSION:');
console.log('The issue is that when there\'s no data, it uses the fallback strategy');
console.log('which doesn\'t respect charge constraints for smart exploration.');
console.log('It should check enemyPossibleMoves in the fallback path too!');