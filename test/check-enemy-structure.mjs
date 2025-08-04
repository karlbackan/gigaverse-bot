import { DungeonPlayer } from '../src/dungeon-player.mjs';
import { config } from '../src/config.mjs';

// Quick test to check enemy data structure
// We'll override the playTurn method to log enemy data

const originalPlayTurn = DungeonPlayer.prototype.playTurn;

DungeonPlayer.prototype.playTurn = async function(dungeonId, parsedState) {
  const { entity, run } = parsedState;
  
  if (run && run.players && run.players[1]) {
    const enemy = run.players[1];
    
    console.log('\n=== ENEMY STRUCTURE CHECK ===');
    console.log('Enemy object keys:', Object.keys(enemy));
    
    // Check if enemy has weapon data like player
    if (enemy.rock) {
      console.log('\nEnemy weapons found!');
      console.log('Rock:', JSON.stringify(enemy.rock, null, 2));
      console.log('Paper:', JSON.stringify(enemy.paper, null, 2));
      console.log('Scissor:', JSON.stringify(enemy.scissor, null, 2));
    } else {
      console.log('\nNo weapon data found on enemy object');
      console.log('Full enemy object:', JSON.stringify(enemy, null, 2));
    }
    
    process.exit(0); // Exit after checking
  }
  
  return originalPlayTurn.call(this, dungeonId, parsedState);
};

// Run a test
async function checkStructure() {
  const player = new DungeonPlayer();
  
  console.log('This test will check enemy data structure on next dungeon run.');
  console.log('Run this with: node test/check-enemy-structure.mjs');
  console.log('Then run a dungeon normally to see the structure.');
}

console.log('Add this check to your bot temporarily to see enemy structure.');
console.log('The enemy object SHOULD have rock/paper/scissor with currentCharges.');