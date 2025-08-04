import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== VERIFY CHARGE PATTERNS ===\n');

config.minimalOutput = false;
const engine = new DecisionEngine();

// Test with a new enemy to ensure clean test
const testEnemyId = 'ChargePatternTest_' + Date.now();

console.log(`Creating new test enemy: ${testEnemyId}\n`);

// Record some battles with specific charge patterns
const patterns = [
  { charges: { rock: 3, paper: 3, scissor: 3 }, action: 'rock' },
  { charges: { rock: 2, paper: 3, scissor: 3 }, action: 'rock' },
  { charges: { rock: 1, paper: 3, scissor: 3 }, action: 'paper' },  // Conservation
  { charges: { rock: 1, paper: 3, scissor: 3 }, action: 'scissor' }, // Conservation
  { charges: { rock: 0, paper: 3, scissor: 3 }, action: 'paper' },
  { charges: { rock: 0, paper: 3, scissor: 3 }, action: 'scissor' },
];

console.log('Recording battles with charge patterns...\n');

for (let i = 0; i < patterns.length; i++) {
  const { charges, action } = patterns[i];
  console.log(`Turn ${i+1}: Enemy charges R${charges.rock}/P${charges.paper}/S${charges.scissor}, plays ${action}`);
  
  engine.recordTurn(
    testEnemyId, i+1, 'rock', action, 'loss',
    { healthPercent: 100 },
    { healthPercent: 100, charges }
  );
}

// Check if patterns were recorded
console.log('\nChecking recorded patterns...');
const enemy = engine.statisticsEngine.enemyStats.get(testEnemyId);

if (enemy && enemy.chargePatterns) {
  console.log('\nCharge patterns found:');
  for (const [pattern, moves] of Object.entries(enemy.chargePatterns)) {
    const total = moves.rock + moves.paper + moves.scissor;
    if (total > 0) {
      console.log(`  ${pattern}: rock=${moves.rock}, paper=${moves.paper}, scissor=${moves.scissor}`);
    }
  }
  
  // Check specific patterns
  if (enemy.chargePatterns['rock_conservation']) {
    console.log('\n✅ Detected rock conservation pattern!');
  }
  if (enemy.chargePatterns['no_rock']) {
    console.log('✅ Detected no_rock pattern!');
  }
} else {
  console.log('❌ No charge patterns found!');
}

// Now save and check persistence
console.log('\n\nTesting persistence...');
engine.statisticsEngine.saveData();
console.log('Data saved.');

// Create new engine and check
const engine2 = new DecisionEngine();
const enemy2 = engine2.statisticsEngine.enemyStats.get(testEnemyId);

if (enemy2 && enemy2.chargePatterns && Object.keys(enemy2.chargePatterns).length > 0) {
  console.log('✅ Charge patterns persisted after save/reload!');
  console.log('Patterns after reload:', Object.keys(enemy2.chargePatterns));
} else {
  console.log('❌ Charge patterns not found after reload');
  if (enemy2) {
    console.log('Enemy exists but chargePatterns:', enemy2.chargePatterns);
  }
}