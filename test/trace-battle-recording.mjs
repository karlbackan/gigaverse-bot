import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

console.log('=== TRACE BATTLE RECORDING ===\n');

// Enable debug mode to see what's happening
config.debug = true;
config.minimalOutput = false;

const engine = new DecisionEngine();

// Simulate recording a battle with clear player/enemy actions
console.log('Recording test battle:\n');
console.log('Turn 1: Player plays ROCK, Enemy plays PAPER');

engine.recordTurn(
  'TestEnemy',
  1,
  'rock',      // playerAction
  'paper',     // enemyAction
  'loss'
);

console.log('\nTurn 2: Player plays PAPER, Enemy plays SCISSOR');

engine.recordTurn(
  'TestEnemy',
  2,
  'paper',     // playerAction
  'scissor',   // enemyAction
  'loss'
);

console.log('\nTurn 3: Player plays SCISSOR, Enemy plays ROCK');

engine.recordTurn(
  'TestEnemy',
  3,
  'scissor',   // playerAction
  'rock',      // enemyAction
  'loss'
);

// Now check what was recorded
console.log('\n\n=== CHECKING RECORDED DATA ===\n');

const testEnemy = engine.statisticsEngine.enemyStats.get('TestEnemy');

if (testEnemy) {
  console.log('TestEnemy recorded moves:');
  console.log(`  Rock: ${testEnemy.moves.rock}`);
  console.log(`  Paper: ${testEnemy.moves.paper}`);
  console.log(`  Scissor: ${testEnemy.moves.scissor}`);
  
  console.log('\nExpected enemy moves: rock=1, paper=1, scissor=1');
  
  if (testEnemy.moves.rock === 1 && testEnemy.moves.paper === 1 && testEnemy.moves.scissor === 1) {
    console.log('✅ CORRECT: We are tracking enemy moves!');
  } else {
    console.log('❌ WRONG: Something is mixed up!');
  }
  
  console.log('\nTurn-by-turn breakdown:');
  for (let turn = 1; turn <= 3; turn++) {
    const turnData = testEnemy.movesByTurn[turn];
    if (turnData) {
      console.log(`Turn ${turn}: rock=${turnData.rock}, paper=${turnData.paper}, scissor=${turnData.scissor}`);
    }
  }
  
  console.log('\n📊 ANALYSIS:');
  console.log('If we see:');
  console.log('- Turn 1: paper=1 (enemy played paper) ✅');
  console.log('- Turn 2: scissor=1 (enemy played scissor) ✅');
  console.log('- Turn 3: rock=1 (enemy played rock) ✅');
  console.log('Then we are correctly tracking ENEMY moves.');
  console.log('\nBut if we see:');
  console.log('- Turn 1: rock=1 (player played rock) ❌');
  console.log('- Turn 2: paper=1 (player played paper) ❌');
  console.log('- Turn 3: scissor=1 (player played scissor) ❌');
  console.log('Then we are incorrectly tracking PLAYER moves!');
}

// Let's also check the actual API to see what lastMove contains
console.log('\n\n=== HYPOTHESIS ===\n');
console.log('The pattern rock->paper->scissor->rock with 99.9% consistency');
console.log('strongly suggests we are tracking the PLAYER (bot) moves.');
console.log('\nThis could mean:');
console.log('1. The bot was using a fixed pattern early in development');
console.log('2. OR we have the player/enemy indices swapped');
console.log('3. OR lastMove refers to the player\'s last move, not enemy\'s');
console.log('\nThe recent battles show more variety because the bot now has');
console.log('exploration and better decision making!');