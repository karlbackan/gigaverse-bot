import { StatisticsEngine } from '../src/statistics-engine.mjs';

console.log('=== FRESH RECORDING TEST ===\n');

// Create a fresh statistics engine
const stats = new StatisticsEngine();

// Use a unique enemy ID
const testEnemyId = 'FreshTestEnemy_' + Date.now();

console.log('Recording battles with clear actions:\n');

// Record 3 battles with known player and enemy actions
const battles = [
  { turn: 1, playerAction: 'rock', enemyAction: 'paper', result: 'loss' },
  { turn: 2, playerAction: 'paper', enemyAction: 'scissor', result: 'loss' },
  { turn: 3, playerAction: 'scissor', enemyAction: 'rock', result: 'loss' }
];

for (const battle of battles) {
  console.log(`Turn ${battle.turn}: Player=${battle.playerAction}, Enemy=${battle.enemyAction}`);
  
  stats.recordBattle({
    enemyId: testEnemyId,
    turn: battle.turn,
    playerAction: battle.playerAction,
    enemyAction: battle.enemyAction,
    result: battle.result,
    timestamp: Date.now()
  });
}

// Check what was recorded
const enemy = stats.enemyStats.get(testEnemyId);

console.log('\n=== RESULTS ===\n');
console.log('Enemy move counts:');
console.log(`  Rock: ${enemy.moves.rock}`);
console.log(`  Paper: ${enemy.moves.paper}`);
console.log(`  Scissor: ${enemy.moves.scissor}`);

console.log('\nExpected if tracking ENEMY moves correctly:');
console.log('  Rock: 1, Paper: 1, Scissor: 1');

console.log('\nExpected if tracking PLAYER moves incorrectly:');
console.log('  Rock: 1, Paper: 1, Scissor: 1 (same in this case)');

console.log('\nChecking turn-specific data for clarity:');
for (let turn = 1; turn <= 3; turn++) {
  const turnData = enemy.movesByTurn[turn];
  if (turnData) {
    const move = turnData.rock > 0 ? 'rock' : 
                 turnData.paper > 0 ? 'paper' : 'scissor';
    console.log(`Turn ${turn}: ${move}`);
  }
}

console.log('\n📊 CONCLUSION:');
if (enemy.movesByTurn[1].paper === 1) {
  console.log('✅ CORRECT: We ARE tracking enemy moves!');
  console.log('Turn 1 shows paper=1, which was the enemy\'s move.');
} else if (enemy.movesByTurn[1].rock === 1) {
  console.log('❌ WRONG: We are tracking PLAYER moves!');
  console.log('Turn 1 shows rock=1, which was the player\'s move.');
}

// Final check on the suspicious Goblin_1 pattern
console.log('\n\n=== GOBLIN_1 PATTERN ANALYSIS ===\n');
console.log('Goblin_1 shows: Turn 1→rock(99.9%), Turn 2→paper(99.9%), Turn 3→scissor(100%)');
console.log('This is the classic rock-paper-scissor-rock pattern.');
console.log('\nIf this represents ENEMY behavior:');
console.log('- It means Goblin_1 is incredibly predictable (unlikely!)');
console.log('\nIf this represents PLAYER behavior:');
console.log('- It means our bot was using a fixed pattern (very likely!)');
console.log('- The bot was probably programmed to play R→P→S→R early on');
console.log('\n🎯 Most likely: We ARE tracking enemy moves correctly,');
console.log('but the BOT was using a predictable pattern in early development!');