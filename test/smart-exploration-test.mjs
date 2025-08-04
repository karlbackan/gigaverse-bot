import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== SMART EXPLORATION TEST ===\n');

config.minimalOutput = false;
const engine = new DecisionEngine();

// Force 100% exploration to test smart logic
engine.params.explorationRate = 1.0;

const enemyId = 'SmartExploreTest';

// Build minimal history
for (let i = 1; i <= 5; i++) {
  engine.recordTurn(enemyId, i, 'rock', 'scissor', 'win');
}

console.log('Test 1: Enemy can only play paper/scissor (rock: 0 charges)');
console.log('Expected: Should explore rock (beats scissor) and scissor (beats paper)');
console.log('NOT paper (only beats rock, which enemy can\'t play)\n');

const results = { rock: 0, paper: 0, scissor: 0 };
for (let i = 0; i < 100; i++) {
  const decision = await engine.makeDecision(
    enemyId, 6, 100, 100,
    ['rock', 'paper', 'scissor'],
    { rock: 3, paper: 3, scissor: 3 },
    { healthPercent: 100 },
    { healthPercent: 100, charges: { rock: 0, paper: 2, scissor: 2 } }
  );
  results[decision]++;
}

console.log('\nResults from 100 explorations:');
console.log(`Rock: ${results.rock} (beats scissor - USEFUL)`)
console.log(`Paper: ${results.paper} (beats rock which enemy can't play - USELESS)`)
console.log(`Scissor: ${results.scissor} (beats paper - USEFUL)\n`);

if (results.paper === 0) {
  console.log('✅ PASS: Never explored paper (correct!)');
} else {
  console.log(`❌ FAIL: Explored paper ${results.paper} times (should be 0)`);
}

console.log('\n---\n');

console.log('Test 2: Enemy can only play rock (paper: 0, scissor: 0 charges)');
console.log('Expected: Should only explore paper (beats rock)\n');

const results2 = { rock: 0, paper: 0, scissor: 0 };
for (let i = 0; i < 100; i++) {
  const decision = await engine.makeDecision(
    enemyId, 7, 100, 100,
    ['rock', 'paper', 'scissor'],
    { rock: 3, paper: 3, scissor: 3 },
    { healthPercent: 100 },
    { healthPercent: 100, charges: { rock: 3, paper: 0, scissor: 0 } }
  );
  results2[decision]++;
}

console.log('\nResults from 100 explorations:');
console.log(`Rock: ${results2.rock} (beats scissor which enemy can't play - USELESS)`)
console.log(`Paper: ${results2.paper} (beats rock - USEFUL)`)
console.log(`Scissor: ${results2.scissor} (beats paper which enemy can't play - USELESS)\n`);

if (results2.rock === 0 && results2.scissor === 0 && results2.paper === 100) {
  console.log('✅ PASS: Only explored paper (correct!)');
} else {
  console.log(`❌ FAIL: Expected 100 paper, got rock:${results2.rock} paper:${results2.paper} scissor:${results2.scissor}`);
}

console.log('\n---\n');

console.log('Test 3: Enemy has all charges (normal exploration)');
const results3 = { rock: 0, paper: 0, scissor: 0 };
for (let i = 0; i < 300; i++) {
  const decision = await engine.makeDecision(
    enemyId, 8, 100, 100,
    ['rock', 'paper', 'scissor'],
    { rock: 3, paper: 3, scissor: 3 },
    { healthPercent: 100 },
    { healthPercent: 100, charges: { rock: 3, paper: 3, scissor: 3 } }
  );
  results3[decision]++;
}

console.log('\nResults from 300 explorations:');
console.log(`Rock: ${results3.rock} (~100 expected)`)
console.log(`Paper: ${results3.paper} (~100 expected)`)
console.log(`Scissor: ${results3.scissor} (~100 expected)\n`);

const variance = Math.max(
  Math.abs(results3.rock - 100),
  Math.abs(results3.paper - 100),
  Math.abs(results3.scissor - 100)
);

if (variance < 50) {
  console.log('✅ PASS: Roughly equal distribution when all moves possible');
} else {
  console.log('❌ FAIL: Distribution too skewed');
}

console.log('\n=== SUMMARY ===');
console.log('Smart exploration ensures we only explore moves that:');
console.log('1. Counter what the enemy CAN play');
console.log('2. Avoid moves that only counter what enemy CAN\'T play');
console.log('This makes exploration more efficient and strategic!');