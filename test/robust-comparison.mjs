import { DecisionEngine } from '../src/decision-engine.mjs';
import { RobustDecisionEngine } from '../src/decision-engine-robust.mjs';

console.log('=== ROBUSTNESS COMPARISON TEST ===\n');

// Test against different enemy types
async function compareEngines() {
  const standardEngine = new DecisionEngine();
  const robustEngine = new RobustDecisionEngine();
  
  const scenarios = [
    {
      name: 'Pattern Changer',
      description: 'Plays R-P-S for 20 turns, then all Rock',
      getMove: (turn) => turn <= 20 ? ['rock', 'paper', 'scissor'][(turn - 1) % 3] : 'rock'
    },
    {
      name: 'Adaptive Counter',
      description: 'Always counters our last move',
      lastPlayerMove: 'rock',
      getMove: function(turn, playerMove) {
        const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        const move = counter[this.lastPlayerMove];
        this.lastPlayerMove = playerMove;
        return move;
      }
    },
    {
      name: '95% Biased',
      description: '95% Rock, 5% random',
      getMove: () => Math.random() < 0.95 ? 'rock' : ['paper', 'scissor'][Math.floor(Math.random() * 2)]
    },
    {
      name: 'True Random',
      description: 'Completely random moves',
      getMove: () => ['rock', 'paper', 'scissor'][Math.floor(Math.random() * 3)]
    }
  ];

  for (const [idx, scenario] of scenarios.entries()) {
    console.log(`\n${scenario.name}: ${scenario.description}`);
    console.log('-'.repeat(60));
    
    const enemyId = idx + 100; // Use unique IDs
    let standardWins = 0;
    let robustWins = 0;
    const battles = 50;
    
    // Test standard engine
    for (let turn = 1; turn <= battles; turn++) {
      const decision = await standardEngine.makeDecision(
        enemyId, turn, 80, 80, 
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 }
      );
      
      const enemyMove = scenario.getMove(turn, decision);
      const result = getResult(decision, enemyMove);
      if (result === 'win') standardWins++;
      
      standardEngine.recordTurn(enemyId, turn, decision, enemyMove, result);
    }
    
    // Test robust engine  
    for (let turn = 1; turn <= battles; turn++) {
      const decision = await robustEngine.makeDecision(
        enemyId + 1000, turn, 80, 80,
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 }
      );
      
      const enemyMove = scenario.getMove(turn, decision);
      const result = getResult(decision, enemyMove);
      if (result === 'win') robustWins++;
      
      robustEngine.recordTurn(enemyId + 1000, turn, decision, enemyMove, result);
    }
    
    console.log(`Standard Engine: ${standardWins}/${battles} wins (${(standardWins/battles*100).toFixed(1)}%)`);
    console.log(`Robust Engine:   ${robustWins}/${battles} wins (${(robustWins/battles*100).toFixed(1)}%)`);
    console.log(`Improvement:     ${robustWins > standardWins ? '+' : ''}${robustWins - standardWins} wins`);
  }
  
  // Show exploration statistics
  const robustSummary = robustEngine.getAnalysisSummary();
  console.log('\n=== ROBUST ENGINE STATISTICS ===');
  console.log(`Exploration moves: ~${(robustSummary.explorationRate * 100).toFixed(0)}% of decisions`);
  console.log(`Average confidence: ${(robustSummary.averageConfidence * 100).toFixed(0)}%`);
}

function getResult(playerMove, enemyMove) {
  if (playerMove === enemyMove) return 'draw';
  if ((playerMove === 'rock' && enemyMove === 'scissor') ||
      (playerMove === 'paper' && enemyMove === 'rock') ||
      (playerMove === 'scissor' && enemyMove === 'paper')) {
    return 'win';
  }
  return 'lose';
}

// Additional test: Low sample performance
async function testLowSampleRobustness() {
  console.log('\n\n=== LOW SAMPLE ROBUSTNESS TEST ===');
  console.log('Testing with only 5 battles per enemy...\n');
  
  const robust = new RobustDecisionEngine();
  
  // Only 5 samples of a heavily biased enemy
  for (let i = 1; i <= 5; i++) {
    robust.recordTurn(200, i, 'paper', 'rock', 'win');
  }
  
  // What does it predict?
  console.log('After 5 battles against rock-heavy enemy:');
  for (let turn = 6; turn <= 10; turn++) {
    const decision = await robust.makeDecision(
      200, turn, 80, 80,
      ['rock', 'paper', 'scissor'],
      { rock: 3, paper: 3, scissor: 3 }
    );
    console.log(`Turn ${turn}: Chose ${decision}`);
  }
}

// Run tests
compareEngines()
  .then(() => testLowSampleRobustness())
  .catch(console.error);