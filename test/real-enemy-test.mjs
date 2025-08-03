import { StatisticsEngine } from '../src/statistics-engine.mjs';
import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

// Set minimal output for cleaner test results
config.minimalOutput = true;

// Simulate real game data with numeric enemy IDs
async function testRealEnemyIDs() {
  console.log('=== REAL ENEMY ID TEST ===\n');
  
  const decisionEngine = new DecisionEngine();
  const statsEngine = decisionEngine.statisticsEngine;
  
  // Simulate battles with numeric enemy IDs (1-16)
  for (let enemyId = 1; enemyId <= 16; enemyId++) {
    console.log(`\nTesting Enemy ${enemyId}:`);
    
    // Simulate 10 battles against this enemy
    for (let battle = 1; battle <= 10; battle++) {
      let playerHealth = 100;
      let enemyHealth = 100;
      
      // Simulate a battle with 5 turns
      for (let turn = 1; turn <= 5 && playerHealth > 0 && enemyHealth > 0; turn++) {
        // Simulate available weapons
        const availableWeapons = ['rock', 'paper', 'scissor'];
        const weaponCharges = { rock: 3, paper: 3, scissor: 3 };
        
        // Player stats
        const playerStats = {
          health: playerHealth,
          maxHealth: 100,
          healthPercent: playerHealth,
          shield: 0,
          maxShield: 0,
          shieldPercent: 0,
          weapons: {
            rock: { attack: 25, defense: 20 },
            paper: { attack: 25, defense: 20 },
            scissor: { attack: 25, defense: 20 }
          }
        };
        
        const enemyStats = {
          health: enemyHealth,
          maxHealth: 100,
          healthPercent: enemyHealth,
          shield: 10,
          maxShield: 20,
          shieldPercent: 50
        };
        
        // Make decision
        const playerMove = await decisionEngine.makeDecision(
          enemyId, // Using numeric ID
          turn,
          playerHealth,
          enemyHealth,
          availableWeapons,
          weaponCharges,
          playerStats,
          enemyStats
        );
        
        // Simulate enemy move (random for this test)
        const moves = ['rock', 'paper', 'scissor'];
        const enemyMove = moves[Math.floor(Math.random() * 3)];
        
        // Determine result
        let result = 'draw';
        if (playerMove === 'rock' && enemyMove === 'scissor') result = 'win';
        else if (playerMove === 'scissor' && enemyMove === 'paper') result = 'win';
        else if (playerMove === 'paper' && enemyMove === 'rock') result = 'win';
        else if (playerMove !== enemyMove) result = 'lose';
        
        // Update health
        if (result === 'win') {
          enemyHealth -= 30;
        } else if (result === 'lose') {
          playerHealth -= 25;
        } else {
          enemyHealth -= 10;
          playerHealth -= 10;
        }
        
        // Record the turn
        decisionEngine.recordTurn(
          enemyId, // Using numeric ID
          turn,
          playerMove,
          enemyMove,
          result,
          playerStats,
          enemyStats,
          {
            rock: { attack: 25, defense: 20, charges: 3 },
            paper: { attack: 25, defense: 20, charges: 3 },
            scissor: { attack: 25, defense: 20, charges: 3 }
          }
        );
        
        if (battle === 10) {
          console.log(`  Enemy ${enemyId} T${turn}: ${playerMove}→${enemyMove} ${result}`);
        }
      }
    }
    
    // Show statistics for this enemy
    const report = statsEngine.getAnalysisReport(enemyId);
    if (report) {
      console.log(`  Battles: ${report.totalBattles}`);
      console.log(`  Favorite move: ${report.favoriteMove}`);
    }
  }
  
  // Export statistics
  statsEngine.exportStatistics();
  console.log('\n✅ Statistics exported with numeric enemy IDs (1-16)');
  
  // Show all recorded enemies
  console.log('\nRecorded enemies:', Array.from(statsEngine.enemyStats.keys()).sort((a, b) => a - b));
}

// Run the test
testRealEnemyIDs().catch(console.error);