#!/usr/bin/env node
import 'dotenv/config';
import { DatabaseStatisticsEngine } from './src/database-statistics-engine.mjs';

async function debugTieBug() {
  console.log('🔍 Debugging Tie Result Bug...\n');
  
  const statsEngine = new DatabaseStatisticsEngine();
  
  try {
    // Get recent paper vs rock ties (should be wins)
    const paperRockTies = await statsEngine.db.all(`
      SELECT 
        player_move, enemy_move, result,
        datetime(timestamp/1000, 'unixepoch') as time,
        enemy_id, turn
      FROM battles 
      WHERE player_move = 'paper' AND enemy_move = 'rock' AND result = 'tie'
      ORDER BY timestamp DESC 
      LIMIT 5
    `);
    
    console.log('Recent Paper vs Rock "ties" (should be wins):');
    paperRockTies.forEach(battle => {
      console.log(`${battle.time}: Enemy ${battle.enemy_id} T${battle.turn} - ${battle.player_move} vs ${battle.enemy_move} = ${battle.result}`);
    });
    
    // Get recent scissor vs rock ties (should be losses)  
    const scissorRockTies = await statsEngine.db.all(`
      SELECT 
        player_move, enemy_move, result,
        datetime(timestamp/1000, 'unixepoch') as time,
        enemy_id, turn
      FROM battles 
      WHERE player_move = 'scissor' AND enemy_move = 'rock' AND result = 'tie'
      ORDER BY timestamp DESC 
      LIMIT 5
    `);
    
    console.log('\nRecent Scissor vs Rock "ties" (should be losses):');
    scissorRockTies.forEach(battle => {
      console.log(`${battle.time}: Enemy ${battle.enemy_id} T${battle.turn} - ${battle.player_move} vs ${battle.enemy_move} = ${battle.result}`);
    });
    
    // Check if there are any NULL moves being recorded
    const nullMoves = await statsEngine.db.all(`
      SELECT 
        player_move, enemy_move, result, COUNT(*) as count
      FROM battles 
      WHERE player_move IS NULL OR enemy_move IS NULL
      GROUP BY player_move, enemy_move, result
    `);
    
    if (nullMoves.length > 0) {
      console.log('\nBattles with NULL moves:');
      nullMoves.forEach(battle => {
        console.log(`${battle.player_move || 'NULL'} vs ${battle.enemy_move || 'NULL'} = ${battle.result} (${battle.count} times)`);
      });
    }
    
    // Check if there are any unexpected move values
    const unexpectedMoves = await statsEngine.db.all(`
      SELECT DISTINCT player_move, enemy_move 
      FROM battles 
      WHERE (player_move NOT IN ('rock', 'paper', 'scissor') AND player_move IS NOT NULL)
         OR (enemy_move NOT IN ('rock', 'paper', 'scissor') AND enemy_move IS NOT NULL)
    `);
    
    if (unexpectedMoves.length > 0) {
      console.log('\nUnexpected move values:');
      unexpectedMoves.forEach(battle => {
        console.log(`Player: "${battle.player_move}", Enemy: "${battle.enemy_move}"`);
      });
    }
    
    // Test the rock-paper-scissors logic manually
    console.log('\n🧪 Testing Result Logic:');
    const testCases = [
      { player: 'paper', enemy: 'rock', expected: 'win' },
      { player: 'scissor', enemy: 'rock', expected: 'loss' },
      { player: 'rock', enemy: 'rock', expected: 'tie' },
      { player: 'rock', enemy: 'scissor', expected: 'win' }
    ];
    
    testCases.forEach(test => {
      let result = 'draw';
      if (test.player === 'rock' && test.enemy === 'scissor') result = 'win';
      else if (test.player === 'scissor' && test.enemy === 'paper') result = 'win';
      else if (test.player === 'paper' && test.enemy === 'rock') result = 'win';
      else if (test.player === test.enemy) result = 'draw';
      else result = 'lose';
      
      // Convert draw to tie for comparison
      const finalResult = result === 'draw' ? 'tie' : result;
      const status = finalResult === test.expected ? '✅' : '❌';
      
      console.log(`${status} ${test.player} vs ${test.enemy}: got ${finalResult}, expected ${test.expected}`);
    });
    
  } catch (error) {
    console.error('Error debugging tie bug:', error);
  } finally {
    await statsEngine.db.close();
  }
}

// Run the debug analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  debugTieBug().catch(console.error);
}

export { debugTieBug };