import { StatisticsEngine } from '../src/statistics-engine.mjs';
import { DecisionEngine } from '../src/decision-engine.mjs';

console.log('=== SESSION PERSISTENCE DEMONSTRATION ===\n');

// Simulate Session 1
console.log('SESSION 1: Starting fresh bot...');
const session1 = new DecisionEngine();
console.log(''); // loadData() will print message

// Check what's already in memory
const enemy4Stats = session1.statisticsEngine.enemyStats.get(4);
if (enemy4Stats) {
  console.log(`Enemy 4 already has ${enemy4Stats.totalBattles} battles recorded from previous sessions!`);
} else {
  console.log('Enemy 4 has no previous data');
}

// Simulate a few battles
console.log('\nSimulating 5 battles against Enemy 4...');
for (let i = 1; i <= 5; i++) {
  session1.recordTurn(
    4, // Enemy ID
    i, // Turn
    'rock',
    'paper',
    'lose',
    { healthPercent: 80 },
    { healthPercent: 80 },
    { rock: { attack: 25, defense: 20, charges: 3 } }
  );
}

// Force save
session1.statisticsEngine.saveData();
console.log('✓ Data saved to disk\n');

// Simulate Session 2 (bot restart)
console.log('SESSION 2: Bot restarted...');
const session2 = new DecisionEngine();
console.log(''); // loadData() will print message

// Check if previous data was loaded
const enemy4StatsAfter = session2.statisticsEngine.enemyStats.get(4);
if (enemy4StatsAfter) {
  console.log(`Enemy 4 now has ${enemy4StatsAfter.totalBattles} total battles (includes Session 1)!`);
  console.log(`Move distribution: Rock=${enemy4StatsAfter.moves.rock}, Paper=${enemy4StatsAfter.moves.paper}, Scissor=${enemy4StatsAfter.moves.scissor}`);
}

// Make a prediction based on accumulated data
console.log('\nMaking prediction based on all historical data:');
const prediction = session2.statisticsEngine.predictNextMove(
  4, // Enemy ID
  1, // Turn
  { healthPercent: 80 },
  { healthPercent: 80 }
);

if (prediction) {
  console.log(`Confidence: ${(prediction.confidence * 100).toFixed(0)}%`);
  console.log(`Predictions: Rock=${(prediction.predictions.rock * 100).toFixed(0)}%, Paper=${(prediction.predictions.paper * 100).toFixed(0)}%, Scissor=${(prediction.predictions.scissor * 100).toFixed(0)}%`);
}

// Show all enemies with data
console.log('\n=== ALL ENEMIES WITH SAVED DATA ===');
const allEnemies = Array.from(session2.statisticsEngine.enemyStats.keys())
  .filter(id => typeof id === 'number') // Only numeric IDs
  .sort((a, b) => a - b);

allEnemies.forEach(enemyId => {
  const stats = session2.statisticsEngine.enemyStats.get(enemyId);
  console.log(`Enemy ${enemyId}: ${stats.totalBattles} battles`);
});

console.log('\n✓ All data persists across sessions!');