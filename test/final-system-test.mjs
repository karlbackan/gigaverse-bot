import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== FINAL COMPREHENSIVE SYSTEM TEST ===\n');

config.minimalOutput = true;
const engine = new DecisionEngine();

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  scenarios: []
};

async function testScenario(name, setup, validate) {
  console.log(`\n${name}`);
  console.log('='.repeat(60));
  
  const result = await setup();
  const passed = validate(result);
  
  testResults.scenarios.push({ name, passed });
  if (passed) {
    testResults.passed++;
    console.log('✅ PASS');
  } else {
    testResults.failed++;
    console.log('❌ FAIL');
  }
}

// TEST 1: Guaranteed Win (100% accuracy)
await testScenario(
  'TEST 1: Guaranteed Win Detection',
  async () => {
    const decisions = [];
    for (let i = 0; i < 10; i++) {
      const decision = await engine.makeDecision(
        'Enemy1', 1, 100, 100,
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 },
        { healthPercent: 100 },
        { healthPercent: 100, charges: { rock: 2, paper: 0, scissor: 0 } }
      );
      decisions.push(decision);
    }
    return decisions;
  },
  (decisions) => {
    console.log(`Enemy can only play rock → Bot should always play paper`);
    console.log(`Results: ${decisions.join(', ')}`);
    return decisions.every(d => d === 'paper');
  }
);

// TEST 2: Charge Elimination in Predictions
await testScenario(
  'TEST 2: Charge Elimination Overrides Statistics',
  async () => {
    // Build history where enemy loves rock
    const enemyId = 'RockLover';
    for (let i = 0; i < 30; i++) {
      engine.recordTurn(enemyId, i, 'paper', 'rock', 'win');
    }
    
    // But now enemy can't play rock!
    const decision = await engine.makeDecision(
      enemyId, 31, 100, 100,
      ['rock', 'paper', 'scissor'],
      { rock: 3, paper: 3, scissor: 3 },
      { healthPercent: 100 },
      { healthPercent: 100, charges: { rock: 0, paper: 2, scissor: 2 } }
    );
    
    console.log(`Enemy history: 30x rock, but now has 0 rock charges`);
    console.log(`Decision: ${decision} (should NOT be paper)`);
    return decision !== 'paper';
  },
  (result) => result
);

// TEST 3: Smart Exploration
await testScenario(
  'TEST 3: Smart Exploration Efficiency',
  async () => {
    const enemyId = 'SmartExploreTest';
    // No history - will use exploration
    
    const oldRate = engine.params.explorationRate;
    engine.params.explorationRate = 1.0; // Force exploration
    
    const moves = { rock: 0, paper: 0, scissor: 0 };
    for (let i = 0; i < 50; i++) {
      const decision = await engine.makeDecision(
        enemyId + i, // New enemy each time to force exploration
        1, 100, 100,
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 },
        { healthPercent: 100 },
        { healthPercent: 100, charges: { rock: 0, paper: 3, scissor: 3 } }
      );
      moves[decision]++;
    }
    
    engine.params.explorationRate = oldRate;
    
    console.log(`Enemy can't play rock (50 explorations)`);
    console.log(`Rock: ${moves.rock}, Paper: ${moves.paper}, Scissor: ${moves.scissor}`);
    console.log(`Paper should be 0 (only counters rock)`);
    return moves.paper === 0;
  },
  (result) => result
);

// TEST 4: Charge Pattern Learning
await testScenario(
  'TEST 4: Charge-Based Behavior Patterns',
  async () => {
    const enemyId = 'ConservationTest';
    
    // Train conservation behavior - when low on rock, plays paper
    for (let i = 0; i < 10; i++) {
      engine.recordTurn(enemyId, i, 'scissor', 'paper', 'win',
        null, { charges: { rock: 1, paper: 3, scissor: 3 } });
    }
    
    // Test prediction with same charge state
    const decision = await engine.makeDecision(
      enemyId, 11, 100, 100,
      ['rock', 'paper', 'scissor'],
      { rock: 3, paper: 3, scissor: 3 },
      { healthPercent: 100 },
      { healthPercent: 100, charges: { rock: 1, paper: 3, scissor: 3 } }
    );
    
    console.log(`Learned: Enemy conserves rock (plays paper when rock=1)`);
    console.log(`Decision: ${decision} (scissor is optimal)`);
    return decision === 'scissor';
  },
  (result) => result
);

// TEST 5: Robustness Features
await testScenario(
  'TEST 5: Win Streak Reduces Exploration',
  async () => {
    const enemyId = 'WinStreakTest';
    
    // Build winning history
    for (let i = 0; i < 30; i++) {
      engine.recordTurn(enemyId, i, 'paper', 'rock', 'win');
    }
    
    // Count explorations in next 20 decisions
    let explorations = 0;
    const originalLog = console.log;
    console.log = (msg) => {
      if (msg.includes('Explore')) explorations++;
      originalLog(msg);
    };
    
    for (let i = 0; i < 20; i++) {
      await engine.makeDecision(
        enemyId, 31 + i, 100, 100,
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 },
        { healthPercent: 100 },
        { healthPercent: 100, charges: { rock: 3, paper: 3, scissor: 3 } }
      );
    }
    
    console.log = originalLog;
    
    console.log(`Win rate: 100% (30 wins)`);
    console.log(`Explorations in 20 decisions: ${explorations} (should be ~1-2)`);
    return explorations <= 3;
  },
  (result) => result
);

// TEST 6: Integration - Complex Scenario
await testScenario(
  'TEST 6: Complex Integration Scenario',
  async () => {
    const enemyId = 'ComplexTest';
    
    // Build complex history
    for (let i = 0; i < 15; i++) {
      // Early game: enemy plays rock
      engine.recordTurn(enemyId, i, 'paper', 'rock', 'win');
    }
    for (let i = 15; i < 25; i++) {
      // Mid game: enemy shifts to scissor
      engine.recordTurn(enemyId, i, 'rock', 'scissor', 'win');
    }
    
    // Late game: enemy low on scissor charges
    const decisions = [];
    for (let turn = 25; turn < 30; turn++) {
      const decision = await engine.makeDecision(
        enemyId, turn, 100, 50, // Player winning
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 },
        { healthPercent: 67 },
        { healthPercent: 33, charges: { rock: 2, paper: 2, scissor: 0 } }
      );
      decisions.push(decision);
    }
    
    console.log(`Complex scenario: Enemy shifted patterns, now out of scissor`);
    console.log(`Decisions: ${decisions.join(', ')}`);
    const paperCount = decisions.filter(d => d === 'paper').length;
    const scissorCount = decisions.filter(d => d === 'scissor').length;
    console.log(`Paper: ${paperCount}, Scissor: ${scissorCount} (both are good)`);
    return decisions.every(d => d !== 'rock'); // Rock is bad (only beats scissor)
  },
  (result) => result
);

// SUMMARY
console.log('\n' + '='.repeat(60));
console.log('FINAL TEST RESULTS');
console.log('='.repeat(60));

testResults.scenarios.forEach(scenario => {
  console.log(`${scenario.passed ? '✅' : '❌'} ${scenario.name}`);
});

console.log(`\nTOTAL: ${testResults.passed}/${testResults.scenarios.length} passed`);

if (testResults.failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! System is working perfectly!');
  console.log('\nKey achievements:');
  console.log('- 100% accuracy on guaranteed wins');
  console.log('- Charge constraints override statistical predictions');
  console.log('- Smart exploration never wastes moves');
  console.log('- Pattern learning adapts to charge-based behaviors');
  console.log('- Robustness features prevent overfitting');
  console.log('- All systems integrate seamlessly');
} else {
  console.log(`\n⚠️  ${testResults.failed} tests failed - investigation needed`);
}