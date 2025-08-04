import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== DEBUG CHARGE ELIMINATION ===\n');

config.minimalOutput = false; // Full output
const engine = new DecisionEngine();
const enemyId = 'RockLoverDebug';

// Build strong history - enemy ALWAYS plays rock
console.log('Building history: 30 battles where enemy always plays rock...\n');
for (let i = 0; i < 30; i++) {
  engine.recordTurn(enemyId, i, 'paper', 'rock', 'win');
}

// Now test when enemy CAN'T play rock
console.log('TEST: Enemy has 0 rock charges (can only play paper/scissor)\n');

const decision = await engine.makeDecision(
  enemyId, 31, 100, 100,
  ['rock', 'paper', 'scissor'],
  { rock: 3, paper: 3, scissor: 3 },
  { healthPercent: 100 },
  { healthPercent: 100, charges: { rock: 0, paper: 2, scissor: 2 } }
);

console.log(`\nFINAL DECISION: ${decision}`);
console.log(`\nANALYSIS:`);
console.log(`- Historical data: Enemy played rock 30/30 times (100%)`);
console.log(`- Current constraint: Enemy CANNOT play rock (0 charges)`);
console.log(`- Correct choices: rock or scissor (counter paper/scissor)`);
console.log(`- Wrong choice: paper (only counters rock which is impossible)`);
console.log(`\nResult: ${decision === 'paper' ? '❌ FAIL - Chose paper!' : '✅ PASS - Avoided paper'}`);