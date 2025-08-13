import { DatabaseStatisticsEngine } from './src/database-statistics-engine.mjs';
import { config } from './src/config.mjs';

console.log('Verifying that corrected turn numbers and enemy IDs are stored in database...');

async function verifyDatabaseData() {
  const statsEngine = new DatabaseStatisticsEngine();
  // Wait a moment for database to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  
  try {
    console.log('\n=== Recent Battle Records ===');
    
    // Query recent battles from today's session
    const query = `
      SELECT 
        enemy_id,
        turn,
        player_move,
        enemy_move,
        result,
        timestamp
      FROM battles 
      WHERE DATE(timestamp/1000, 'unixepoch') = DATE('now')
      ORDER BY timestamp DESC 
      LIMIT 30
    `;
    
    const battles = await statsEngine.db.all(query);
    
    console.log(`Found ${battles.length} recent battles:`);
    
    // Group by enemy to check turn progression
    const enemyBattles = {};
    
    battles.forEach(battle => {
      if (!enemyBattles[battle.enemy_id]) {
        enemyBattles[battle.enemy_id] = [];
      }
      enemyBattles[battle.enemy_id].push(battle);
    });
    
    // Check each enemy's turn progression
    Object.keys(enemyBattles).sort().forEach(enemyId => {
      const enemyTurns = enemyBattles[enemyId].sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`\n--- Enemy ${enemyId} ---`);
      console.log(`Total battles: ${enemyTurns.length}`);
      
      let expectedTurn = 1;
      let turnProgression = [];
      let hasCorrectProgression = true;
      
      enemyTurns.forEach(battle => {
        turnProgression.push(`T${battle.turn}`);
        
        if (battle.turn !== expectedTurn) {
          hasCorrectProgression = false;
        }
        
        console.log(`  T${battle.turn}: ${battle.player_move}→${battle.enemy_move} ${battle.result}`);
        expectedTurn = battle.turn + 1;
      });
      
      console.log(`  Turn progression: ${turnProgression.join('→')}`);
      console.log(`  ✅ Correct progression: ${hasCorrectProgression ? 'YES' : 'NO'}`);
      
      // Check for any duplicate turn numbers
      const turnCounts = {};
      enemyTurns.forEach(battle => {
        turnCounts[battle.turn] = (turnCounts[battle.turn] || 0) + 1;
      });
      
      const duplicates = Object.keys(turnCounts).filter(turn => turnCounts[turn] > 1);
      if (duplicates.length > 0) {
        console.log(`  ⚠️  Duplicate turns found: ${duplicates.join(', ')}`);
      }
    });
    
    console.log('\n=== Validation Check Results ===');
    
    // Check if we have the specific battles we saw in the logs
    const testBattles = [
      { enemy_id: 23, turn: 1, player_move: 'paper', enemy_move: 'rock', result: 'win' },
      { enemy_id: 23, turn: 7, player_move: 'rock', enemy_move: 'scissor', result: 'win' },
      { enemy_id: 24, turn: 1, player_move: 'rock', enemy_move: 'scissor', result: 'win' },
      { enemy_id: 24, turn: 3, player_move: 'paper', enemy_move: 'rock', result: 'win' }
    ];
    
    for (const testBattle of testBattles) {
      const found = battles.find(b => 
        b.enemy_id === testBattle.enemy_id && 
        b.turn === testBattle.turn &&
        b.player_move === testBattle.player_move &&
        b.enemy_move === testBattle.enemy_move &&
        b.result === testBattle.result
      );
      
      if (found) {
        console.log(`✅ Found: Enemy ${testBattle.enemy_id} T${testBattle.turn}: ${testBattle.player_move}→${testBattle.enemy_move} ${testBattle.result}`);
      } else {
        console.log(`❌ Missing: Enemy ${testBattle.enemy_id} T${testBattle.turn}: ${testBattle.player_move}→${testBattle.enemy_move} ${testBattle.result}`);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total recent battles analyzed: ${battles.length}`);
    console.log(`Unique enemies: ${Object.keys(enemyBattles).length}`);
    
    // Check overall data integrity
    let totalCorrectProgression = 0;
    let totalEnemies = Object.keys(enemyBattles).length;
    
    Object.keys(enemyBattles).forEach(enemyId => {
      const enemyTurns = enemyBattles[enemyId].sort((a, b) => a.timestamp - b.timestamp);
      let correctProgression = true;
      
      for (let i = 0; i < enemyTurns.length; i++) {
        if (enemyTurns[i].turn !== i + 1) {
          correctProgression = false;
          break;
        }
      }
      
      if (correctProgression) {
        totalCorrectProgression++;
      }
    });
    
    console.log(`Enemies with correct turn progression: ${totalCorrectProgression}/${totalEnemies}`);
    console.log(`Data integrity: ${totalCorrectProgression === totalEnemies ? '✅ PERFECT' : '⚠️  ISSUES FOUND'}`);
    
  } catch (error) {
    console.error('Error verifying database data:', error);
  }
}

// Run the verification
verifyDatabaseData().then(() => {
  console.log('\nDatabase verification completed!');
}).catch(error => {
  console.error('Verification failed:', error);
});