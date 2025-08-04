import { StatisticsEngine } from '../src/statistics-engine.mjs';

console.log('=== DEBUG PLAYER/ENEMY TRACKING ===\n');

const stats = new StatisticsEngine();

// Check Goblin_1 which shows the suspicious pattern
const goblin1 = stats.enemyStats.get('Goblin_1');

if (goblin1) {
  console.log('Goblin_1 Statistics:');
  console.log(`Total battles: ${goblin1.totalBattles}`);
  console.log('\nMove distribution:');
  console.log(`  Rock: ${goblin1.moves.rock} (${(goblin1.moves.rock / goblin1.totalBattles * 100).toFixed(1)}%)`);
  console.log(`  Paper: ${goblin1.moves.paper} (${(goblin1.moves.paper / goblin1.totalBattles * 100).toFixed(1)}%)`);
  console.log(`  Scissor: ${goblin1.moves.scissor} (${(goblin1.moves.scissor / goblin1.totalBattles * 100).toFixed(1)}%)`);
  
  console.log('\nTurn-specific patterns:');
  for (let turn = 1; turn <= 5; turn++) {
    if (goblin1.movesByTurn[turn]) {
      const turnData = goblin1.movesByTurn[turn];
      const total = turnData.rock + turnData.paper + turnData.scissor;
      console.log(`\nTurn ${turn} (${total} samples):`);
      console.log(`  Rock: ${turnData.rock} (${(turnData.rock / total * 100).toFixed(1)}%)`);
      console.log(`  Paper: ${turnData.paper} (${(turnData.paper / total * 100).toFixed(1)}%)`);
      console.log(`  Scissor: ${turnData.scissor} (${(turnData.scissor / total * 100).toFixed(1)}%)`);
    }
  }
  
  // Check recent battles to see the pattern
  console.log('\nLast 10 battles:');
  const recentBattles = goblin1.recentBattles.slice(-10);
  recentBattles.forEach((battle, i) => {
    console.log(`  ${i+1}. Turn ${battle.turn}: ${battle.move}`);
  });
  
  console.log('\n🤔 ANALYSIS:');
  console.log('If Goblin_1 plays rock 99.9% on turn 1, paper 99.9% on turn 2, etc...');
  console.log('This is EXTREMELY suspicious and suggests we might be tracking');
  console.log('the PLAYER\'s moves (our bot) instead of the enemy\'s moves!');
  console.log('\nBots often follow patterns, but 99.9% consistency is unrealistic for enemies.');
}

// Let's check a few more enemies
console.log('\n\n=== CHECKING OTHER ENEMIES ===\n');

let suspiciousCount = 0;
let totalChecked = 0;

for (const [enemyId, enemy] of stats.enemyStats.entries()) {
  if (enemy.totalBattles > 100) {
    totalChecked++;
    
    // Check for suspiciously high turn consistency
    for (const [turn, moves] of Object.entries(enemy.movesByTurn)) {
      const total = moves.rock + moves.paper + moves.scissor;
      if (total > 50) {
        const maxPercent = Math.max(moves.rock, moves.paper, moves.scissor) / total;
        if (maxPercent > 0.95) {
          suspiciousCount++;
          console.log(`${enemyId} Turn ${turn}: ${maxPercent * 100}% plays same move!`);
          break;
        }
      }
    }
  }
}

console.log(`\n📊 Summary: ${suspiciousCount}/${totalChecked} enemies show suspicious patterns`);

if (suspiciousCount > totalChecked * 0.5) {
  console.log('\n❌ CRITICAL ISSUE: We are likely tracking PLAYER moves instead of ENEMY moves!');
  console.log('The patterns are too consistent to be enemy behavior.');
} else {
  console.log('\n✅ Tracking seems correct - patterns show reasonable variety.');
}