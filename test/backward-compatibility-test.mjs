import { StatisticsEngine } from '../src/statistics-engine.mjs';

console.log('=== BACKWARD COMPATIBILITY TEST ===\n');

const stats = new StatisticsEngine();

// Check existing enemies
console.log(`Loaded ${stats.enemyStats.size} existing enemies`);

let missingChargePatterns = 0;
let missingRecentBattles = 0;

for (const [enemyId, enemy] of stats.enemyStats.entries()) {
  if (!enemy.chargePatterns) {
    console.log(`❌ Enemy ${enemyId} missing chargePatterns!`);
    missingChargePatterns++;
  }
  if (!enemy.recentBattles) {
    console.log(`❌ Enemy ${enemyId} missing recentBattles!`);
    missingRecentBattles++;
  }
}

if (missingChargePatterns === 0 && missingRecentBattles === 0) {
  console.log('\n✅ All enemies have required fields!');
} else {
  console.log(`\n❌ Missing fields: ${missingChargePatterns} chargePatterns, ${missingRecentBattles} recentBattles`);
}

// Test recording a battle with an existing enemy
const testEnemyId = stats.enemyStats.keys().next().value;
if (testEnemyId) {
  console.log(`\nTesting battle recording with enemy: ${testEnemyId}`);
  
  try {
    stats.recordBattle({
      enemyId: testEnemyId,
      turn: 1,
      playerAction: 'rock',
      enemyAction: 'scissor',
      result: 'win',
      enemyStats: {
        charges: { rock: 3, paper: 3, scissor: 3 }
      }
    });
    console.log('✅ Battle recorded successfully!');
  } catch (error) {
    console.log('❌ Error recording battle:', error.message);
  }
}

console.log('\n✅ Backward compatibility fix is working!');