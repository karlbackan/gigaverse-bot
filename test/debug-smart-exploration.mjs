import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== DEBUG SMART EXPLORATION ===\n');

config.minimalOutput = false; // Full output to see what's happening
const engine = new DecisionEngine();
const enemyId = 'DebugTest';

// Build minimal history
for (let i = 1; i <= 20; i++) {
  engine.recordTurn(enemyId, i, 'paper', 'rock', 'win');
}

// Force 100% exploration
engine.params.explorationRate = 1.0;

console.log('Running 10 decisions with enemy who can\'t play rock (0/2/2 charges)...\n');

const results = { rock: 0, paper: 0, scissor: 0 };
for (let i = 1; i <= 10; i++) {
  console.log(`\n--- Decision ${i} ---`);
  const decision = await engine.makeDecision(
    enemyId, 21, 100, 100,
    ['rock', 'paper', 'scissor'],
    { rock: 3, paper: 3, scissor: 3 },
    { healthPercent: 100 },
    { healthPercent: 100, charges: { rock: 0, paper: 2, scissor: 2 } }
  );
  results[decision]++;
  console.log(`FINAL DECISION: ${decision}\n`);
}

console.log('\n=== RESULTS ===');
console.log(`Rock: ${results.rock} (beats scissor - USEFUL)`);
console.log(`Paper: ${results.paper} (beats rock which enemy CAN'T play - USELESS)`);
console.log(`Scissor: ${results.scissor} (beats paper - USEFUL)`);

if (results.paper > 0) {
  console.log(`\n❌ PROBLEM: Played paper ${results.paper} times!`);
  console.log('This suggests the issue might be:');
  console.log('1. Statistical prediction overriding exploration');
  console.log('2. Fallback strategy being used instead of exploration');
  console.log('3. Edge case in the smart exploration logic');
} else {
  console.log('\n✅ SUCCESS: Never played paper!');
}