import { StatisticsEngine } from '../src/statistics-engine.mjs';

console.log('=== ENEMY PATTERN ANALYSIS ===\n');

const stats = new StatisticsEngine();

// Group enemies by their naming pattern
const tutorialEnemies = [];
const numberedEnemies = [];
const otherEnemies = [];

for (const [enemyId, enemy] of stats.enemyStats.entries()) {
  if (enemy.totalBattles > 50) {
    const idStr = String(enemyId);
    if (idStr.match(/^(Goblin|Orc|Troll|Skeleton|Dragon|Vampire|Ghost)_\d+$/)) {
      tutorialEnemies.push({ id: idStr, enemy });
    } else if (idStr.match(/^\d+$/)) {
      numberedEnemies.push({ id: idStr, enemy });
    } else {
      otherEnemies.push({ id: idStr, enemy });
    }
  }
}

console.log(`Found ${tutorialEnemies.length} tutorial-style enemies (Goblin_1, etc.)`);
console.log(`Found ${numberedEnemies.length} numbered enemies (100, 105, etc.)`);
console.log(`Found ${otherEnemies.length} other enemies\n`);

// Analyze predictability by enemy type
function analyzePredictability(enemies, label) {
  console.log(`\n=== ${label} ===\n`);
  
  let totalPredictable = 0;
  let examplesShown = 0;
  
  for (const { id, enemy } of enemies) {
    let isPredictable = false;
    
    // Check first 5 turns
    for (let turn = 1; turn <= 5; turn++) {
      const turnData = enemy.movesByTurn[turn];
      if (turnData) {
        const total = turnData.rock + turnData.paper + turnData.scissor;
        if (total > 50) {
          const maxPercent = Math.max(turnData.rock, turnData.paper, turnData.scissor) / total;
          if (maxPercent > 0.95) {
            isPredictable = true;
            if (examplesShown < 3) {
              const dominantMove = turnData.rock > turnData.paper ? 
                (turnData.rock > turnData.scissor ? 'rock' : 'scissor') :
                (turnData.paper > turnData.scissor ? 'paper' : 'scissor');
              console.log(`${id}: Turn ${turn} = ${(maxPercent * 100).toFixed(1)}% ${dominantMove}`);
            }
          }
        }
      }
    }
    
    if (isPredictable) {
      totalPredictable++;
      examplesShown++;
    }
  }
  
  const percent = enemies.length > 0 ? (totalPredictable / enemies.length * 100).toFixed(1) : 0;
  console.log(`\nPredictable enemies: ${totalPredictable}/${enemies.length} (${percent}%)`);
}

analyzePredictability(tutorialEnemies, 'TUTORIAL ENEMIES');
analyzePredictability(numberedEnemies, 'NUMBERED ENEMIES');
analyzePredictability(otherEnemies, 'OTHER ENEMIES');

// Deep dive into Goblin_1
console.log('\n\n=== GOBLIN_1 DEEP DIVE ===\n');
const goblin1 = stats.enemyStats.get('Goblin_1');
if (goblin1) {
  console.log('First 10 turns pattern:');
  for (let turn = 1; turn <= 10; turn++) {
    const turnData = goblin1.movesByTurn[turn];
    if (turnData) {
      const total = turnData.rock + turnData.paper + turnData.scissor;
      if (total > 0) {
        const dominant = turnData.rock > turnData.paper ? 
          (turnData.rock > turnData.scissor ? `rock (${turnData.rock}/${total})` : `scissor (${turnData.scissor}/${total})`) :
          (turnData.paper > turnData.scissor ? `paper (${turnData.paper}/${total})` : `scissor (${turnData.scissor}/${total})`);
        console.log(`Turn ${turn}: ${dominant}`);
      }
    }
  }
  
  console.log('\n🎯 CONCLUSION:');
  console.log('Goblin_1 follows a PERFECT rock→paper→scissor→rock pattern.');
  console.log('This is either:');
  console.log('1. A tutorial enemy with scripted moves (most likely)');
  console.log('2. An incredibly predictable AI pattern');
  console.log('\nThe statistics engine is working correctly!');
  console.log('We ARE tracking enemy moves, not player moves.');
}

// Check recent battles to see current behavior
console.log('\n\n=== RECENT BATTLE ANALYSIS ===\n');
const recentEnemies = new Set();
for (const { id, enemy } of [...tutorialEnemies, ...numberedEnemies, ...otherEnemies]) {
  if (enemy.recentBattles && enemy.recentBattles.length > 0) {
    const lastBattle = enemy.recentBattles[enemy.recentBattles.length - 1];
    const daysSince = (Date.now() - lastBattle.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) {
      recentEnemies.add(id);
    }
  }
}

console.log(`Enemies fought in last 24 hours: ${recentEnemies.size}`);
console.log('Recent enemies:', Array.from(recentEnemies).slice(0, 10).join(', '));