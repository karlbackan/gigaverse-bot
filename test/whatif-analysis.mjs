import { StatisticsEngine } from '../src/statistics-engine.mjs';
import { DecisionEngine } from '../src/decision-engine.mjs';

console.log('=== WHAT-IF SCENARIO ANALYSIS ===\n');

// Simulate different scenarios to test robustness

// Scenario 1: Enemy with changing patterns
async function testPatternChange() {
  console.log('SCENARIO 1: Enemy changes pattern mid-game');
  const engine = new DecisionEngine();
  
  // Phase 1: Enemy plays predictably (rock-paper-scissor)
  for (let i = 1; i <= 30; i++) {
    const turn = i;
    const enemyMove = ['rock', 'paper', 'scissor'][(i - 1) % 3];
    engine.recordTurn(1, turn, 'rock', enemyMove, 'draw');
  }
  
  // Check prediction confidence
  const pred1 = engine.statisticsEngine.predictNextMove(1, 31);
  console.log(`After 30 turns of pattern: Confidence = ${pred1?.confidence || 0}`);
  
  // Phase 2: Enemy switches to all rock
  for (let i = 31; i <= 60; i++) {
    engine.recordTurn(1, i, 'paper', 'rock', 'win');
  }
  
  const pred2 = engine.statisticsEngine.predictNextMove(1, 61);
  console.log(`After pattern change: Confidence = ${pred2?.confidence || 0}`);
  console.log('');
}

// Scenario 2: Very few samples
async function testLowSampleSize() {
  console.log('SCENARIO 2: Making decisions with minimal data');
  const engine = new DecisionEngine();
  
  // Only 3 battles
  engine.recordTurn(2, 1, 'rock', 'scissor', 'win');
  engine.recordTurn(2, 2, 'paper', 'rock', 'win');
  engine.recordTurn(2, 3, 'scissor', 'paper', 'win');
  
  const pred = engine.statisticsEngine.predictNextMove(2, 4);
  console.log(`With only 3 samples: Confidence = ${pred?.confidence || 0}`);
  
  // What would we decide?
  const decision = await engine.makeDecision(2, 4, 80, 80, ['rock', 'paper', 'scissor']);
  console.log(`Decision made: ${decision}`);
  console.log('');
}

// Scenario 3: Truly random enemy
async function testRandomEnemy() {
  console.log('SCENARIO 3: Enemy plays randomly');
  const engine = new DecisionEngine();
  
  // Simulate 100 random moves
  const moves = ['rock', 'paper', 'scissor'];
  let rockCount = 0, paperCount = 0, scissorCount = 0;
  
  for (let i = 1; i <= 100; i++) {
    const enemyMove = moves[Math.floor(Math.random() * 3)];
    if (enemyMove === 'rock') rockCount++;
    else if (enemyMove === 'paper') paperCount++;
    else scissorCount++;
    
    engine.recordTurn(3, i, moves[i % 3], enemyMove, 'draw');
  }
  
  console.log(`Enemy played: R=${rockCount}, P=${paperCount}, S=${scissorCount}`);
  const pred = engine.statisticsEngine.predictNextMove(3, 101);
  console.log(`Confidence against random: ${pred?.confidence || 0}`);
  console.log('');
}

// Scenario 4: Adaptive enemy (counters our moves)
async function testAdaptiveEnemy() {
  console.log('SCENARIO 4: Enemy adapts to counter our moves');
  const engine = new DecisionEngine();
  
  const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
  let lastPlayerMove = 'rock';
  
  for (let i = 1; i <= 50; i++) {
    // Enemy counters our last move
    const enemyMove = counters[lastPlayerMove];
    
    // We play somewhat predictably
    const playerMove = ['rock', 'rock', 'paper', 'scissor'][i % 4];
    lastPlayerMove = playerMove;
    
    const result = playerMove === 'rock' && enemyMove === 'scissor' ? 'win' :
                   playerMove === 'paper' && enemyMove === 'rock' ? 'win' :
                   playerMove === 'scissor' && enemyMove === 'paper' ? 'win' :
                   playerMove === enemyMove ? 'draw' : 'lose';
    
    engine.recordTurn(4, i, playerMove, enemyMove, result);
  }
  
  const analysis = engine.statisticsEngine.getAnalysisReport(4);
  console.log(`Win rate against adaptive enemy: ${analysis ? (analysis.totalBattles - analysis.moves.rock) / analysis.totalBattles : 0}`);
  console.log('');
}

// Scenario 5: Confidence threshold impact
async function testConfidenceThresholds() {
  console.log('SCENARIO 5: Impact of confidence thresholds');
  const engine = new DecisionEngine();
  
  // Create a somewhat predictable pattern
  for (let i = 1; i <= 20; i++) {
    const enemyMove = Math.random() < 0.6 ? 'rock' : (Math.random() < 0.5 ? 'paper' : 'scissor');
    engine.recordTurn(5, i, 'paper', enemyMove, enemyMove === 'rock' ? 'win' : 'lose');
  }
  
  const pred = engine.statisticsEngine.predictNextMove(5, 21);
  console.log(`Prediction confidence: ${pred?.confidence || 0}`);
  console.log(`Would use prediction at 60% threshold: ${pred && pred.confidence > 0.6 ? 'YES' : 'NO'}`);
  console.log(`Would use prediction at 70% threshold: ${pred && pred.confidence > 0.7 ? 'NO' : 'NO'}`);
  console.log('');
}

// Run all scenarios
async function runAllScenarios() {
  await testPatternChange();
  await testLowSampleSize();
  await testRandomEnemy();
  await testAdaptiveEnemy();
  await testConfidenceThresholds();
  
  console.log('=== IMPROVEMENT RECOMMENDATIONS ===\n');
  console.log('1. EXPLORATION BONUS: Add 5-10% random play even with high confidence');
  console.log('   - Prevents exploitation by adaptive enemies');
  console.log('   - Helps discover pattern changes faster\n');
  
  console.log('2. RECENCY WEIGHTING: Weight recent battles more heavily');
  console.log('   - Last 10 battles: 2x weight');
  console.log('   - Helps adapt to pattern changes\n');
  
  console.log('3. MINIMUM SAMPLE THRESHOLD: Require 10+ battles before trusting patterns');
  console.log('   - Prevents overfitting to small samples');
  console.log('   - Falls back to balanced play\n');
  
  console.log('4. PATTERN STABILITY CHECK: Track prediction accuracy');
  console.log('   - If accuracy drops below 40%, reduce confidence');
  console.log('   - Triggers re-evaluation of patterns\n');
  
  console.log('5. DEFENSIVE FALLBACK: When losing streak detected');
  console.log('   - Play the counter to enemy\'s favorite move');
  console.log('   - Simple but effective recovery strategy\n');
}

runAllScenarios().catch(console.error);