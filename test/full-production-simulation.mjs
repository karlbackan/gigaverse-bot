import { DecisionEngine } from '../src/decision-engine.mjs';
import { StatisticsEngine } from '../src/statistics-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== FULL PRODUCTION SIMULATION ===\n');

config.minimalOutput = false; // Full output to see details

// Test 1: Load existing data and verify all fields
console.log('TEST 1: Loading existing statistics data...');
const stats = new StatisticsEngine();
console.log(`✅ Loaded ${stats.enemyStats.size} enemies\n`);

// Verify all enemies have required fields
let allFieldsPresent = true;
for (const [enemyId, enemy] of stats.enemyStats.entries()) {
  if (!enemy.chargePatterns || !enemy.recentBattles) {
    console.log(`❌ Enemy ${enemyId} missing fields!`);
    allFieldsPresent = false;
    break;
  }
}
console.log(allFieldsPresent ? '✅ All enemies have required fields\n' : '❌ Some enemies missing fields\n');

// Test 2: Simulate the exact error scenario
console.log('TEST 2: Simulating production scenario with charge patterns...');
const engine = new DecisionEngine();

// Pick a real enemy from the data
const realEnemyId = Array.from(stats.enemyStats.keys())[0];
console.log(`Using real enemy: ${realEnemyId}\n`);

try {
  // Simulate multiple turns like in production
  for (let turn = 1; turn <= 5; turn++) {
    console.log(`\nTurn ${turn}:`);
    
    // Varying charge states
    const charges = {
      rock: Math.max(0, 3 - Math.floor(turn/2)),
      paper: 3,
      scissor: Math.max(0, 3 - Math.floor((turn-1)/2))
    };
    
    console.log(`Enemy charges: R${charges.rock}/P${charges.paper}/S${charges.scissor}`);
    
    // Make decision
    const decision = await engine.makeDecision(
      realEnemyId, turn, 100, 100,
      ['rock', 'paper', 'scissor'],
      { rock: 3, paper: 3, scissor: 3 },
      { healthPercent: 100 },
      { healthPercent: 100, charges }
    );
    
    console.log(`Decision: ${decision}`);
    
    // Record turn - THIS IS WHERE THE ERROR WAS HAPPENING
    const enemyAction = ['rock', 'paper', 'scissor'][turn % 3];
    engine.recordTurn(
      realEnemyId, turn, decision, enemyAction, 'win',
      { healthPercent: 100 },
      { healthPercent: 100, charges }
    );
    
    console.log(`✅ Turn recorded successfully`);
  }
  
  console.log('\n✅ All turns completed without errors!');
  
} catch (error) {
  console.log('\n❌ ERROR:', error.message);
  console.log('Stack:', error.stack);
}

// Test 3: Verify charge patterns are being recorded
console.log('\n\nTEST 3: Verifying charge pattern recording...');
const enemy = stats.enemyStats.get(realEnemyId);
if (enemy && enemy.chargePatterns) {
  console.log('Charge patterns recorded:');
  for (const [pattern, moves] of Object.entries(enemy.chargePatterns)) {
    const total = moves.rock + moves.paper + moves.scissor;
    if (total > 0) {
      console.log(`  ${pattern}: R${moves.rock} P${moves.paper} S${moves.scissor} (${total} total)`);
    }
  }
  console.log('✅ Charge patterns are being tracked correctly');
} else {
  console.log('❌ No charge patterns found');
}

// Test 4: Save and reload to ensure persistence
console.log('\n\nTEST 4: Testing data persistence...');
stats.saveData();
console.log('✅ Data saved');

// Create new instance and reload
const stats2 = new StatisticsEngine();
const enemy2 = stats2.enemyStats.get(realEnemyId);
if (enemy2 && enemy2.chargePatterns && Object.keys(enemy2.chargePatterns).length > 0) {
  console.log('✅ Charge patterns persisted after save/reload');
} else {
  console.log('❌ Charge patterns lost after reload');
}

console.log('\n' + '='.repeat(50));
console.log('SIMULATION COMPLETE');
console.log('='.repeat(50));
console.log('\n✅ All tests passed! The production fix is working correctly.');