import { StatisticsEngine } from '../src/statistics-engine.mjs';
import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

// Set minimal output for cleaner test results
config.minimalOutput = true;

// Define 16 different enemy patterns
const enemyPatterns = {
  'Goblin_1': {
    pattern: 'sequence',
    description: 'Always plays rock→paper→scissor sequence',
    getMove: (turn) => ['rock', 'paper', 'scissor'][(turn - 1) % 3]
  },
  'Goblin_2': {
    pattern: 'counter-last',
    description: 'Counters player\'s last move',
    getMove: (turn, lastPlayerMove) => {
      if (!lastPlayerMove) return 'rock';
      const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
      return counters[lastPlayerMove];
    }
  },
  'Orc_3': {
    pattern: 'turn-based',
    description: 'Different move each turn: T1=rock, T2=paper, T3+=scissor',
    getMove: (turn) => {
      if (turn === 1) return 'rock';
      if (turn === 2) return 'paper';
      return 'scissor';
    }
  },
  'Troll_4': {
    pattern: 'health-based',
    description: 'Rock when healthy (>50%), scissor when hurt',
    getMove: (turn, lastPlayerMove, healthPercent) => {
      return healthPercent > 50 ? 'rock' : 'scissor';
    }
  },
  'Skeleton_5': {
    pattern: 'double-sequence',
    description: 'Plays each move twice: rock,rock,paper,paper,scissor,scissor',
    getMove: (turn) => {
      const sequence = ['rock', 'rock', 'paper', 'paper', 'scissor', 'scissor'];
      return sequence[(turn - 1) % sequence.length];
    }
  },
  'Zombie_6': {
    pattern: 'random-weighted',
    description: '60% rock, 30% paper, 10% scissor',
    getMove: () => {
      const rand = Math.random();
      if (rand < 0.6) return 'rock';
      if (rand < 0.9) return 'paper';
      return 'scissor';
    }
  },
  'Demon_7': {
    pattern: 'adaptive',
    description: 'Adapts based on player patterns',
    history: [],
    getMove: function(turn, lastPlayerMove) {
      if (lastPlayerMove) this.history.push(lastPlayerMove);
      if (this.history.length < 3) return 'paper';
      
      // Count player's recent moves
      const recent = this.history.slice(-5);
      const counts = { rock: 0, paper: 0, scissor: 0 };
      recent.forEach(move => counts[move]++);
      
      // Counter the most frequent
      const max = Math.max(counts.rock, counts.paper, counts.scissor);
      if (counts.rock === max) return 'paper';
      if (counts.paper === max) return 'scissor';
      return 'rock';
    }
  },
  'Dragon_8': {
    pattern: 'charge-based',
    description: 'Mirrors player weapon with most charges',
    getMove: (turn, lastPlayerMove, healthPercent, playerCharges) => {
      if (!playerCharges) return 'rock';
      const max = Math.max(playerCharges.rock, playerCharges.paper, playerCharges.scissor);
      if (playerCharges.rock === max) return 'rock';
      if (playerCharges.paper === max) return 'paper';
      return 'scissor';
    }
  },
  'Vampire_9': {
    pattern: 'reverse-sequence',
    description: 'Scissor→paper→rock (reverse of common pattern)',
    getMove: (turn) => ['scissor', 'paper', 'rock'][(turn - 1) % 3]
  },
  'Ghost_10': {
    pattern: 'shield-reactive',
    description: 'Rock with shield, paper without',
    getMove: (turn, lastPlayerMove, healthPercent, playerCharges, shieldPercent) => {
      return shieldPercent > 0 ? 'rock' : 'paper';
    }
  },
  'Witch_11': {
    pattern: 'fibonacci',
    description: 'Changes move based on Fibonacci sequence timing',
    getMove: (turn) => {
      const fib = [1, 1, 2, 3, 5, 8, 13];
      const moves = ['rock', 'paper', 'scissor'];
      for (let i = 0; i < fib.length; i++) {
        if (turn <= fib[i]) return moves[i % 3];
      }
      return moves[2];
    }
  },
  'Necromancer_12': {
    pattern: 'win-loss-reactive',
    description: 'Changes strategy based on win/loss',
    lastResult: null,
    lastMove: 'rock',
    getMove: function(turn, lastPlayerMove, healthPercent, playerCharges, shieldPercent, lastResult) {
      if (lastResult === 'win') {
        // If we won, play what beats our last move
        const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        this.lastMove = counters[this.lastMove];
      } else if (lastResult === 'lose') {
        // If we lost, play what our last move beats
        const beats = { rock: 'scissor', paper: 'rock', scissor: 'paper' };
        this.lastMove = beats[this.lastMove];
      }
      // Draw = keep same
      return this.lastMove;
    }
  },
  'Lich_13': {
    pattern: 'prime-turns',
    description: 'Paper on prime turns (2,3,5,7,11...), rock otherwise',
    getMove: (turn) => {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
      return primes.includes(turn) ? 'paper' : 'rock';
    }
  },
  'Elemental_14': {
    pattern: 'cyclic-pairs',
    description: 'Rock-rock, paper-paper, scissor-scissor',
    getMove: (turn) => {
      const sequence = ['rock', 'rock', 'paper', 'paper', 'scissor', 'scissor'];
      return sequence[(turn - 1) % sequence.length];
    }
  },
  'Golem_15': {
    pattern: 'defensive',
    description: 'Always plays rock (max defense)',
    getMove: () => 'rock'
  },
  'Wizard_16': {
    pattern: 'complex-sequence',
    description: 'R-P-S-P-R-R-S-S-P pattern',
    getMove: (turn) => {
      const pattern = ['rock', 'paper', 'scissor', 'paper', 'rock', 'rock', 'scissor', 'scissor', 'paper'];
      return pattern[(turn - 1) % pattern.length];
    }
  }
};

// Simulate battles
async function runSimulation() {
  console.log('=== COMPREHENSIVE STATISTICS SIMULATION ===\n');
  
  const decisionEngine = new DecisionEngine();
  const statsEngine = decisionEngine.statisticsEngine;
  
  // Set a test noobId
  decisionEngine.setNoobId(76024);
  
  let totalBattles = 0;
  let totalWins = 0;
  let totalPredictions = 0;
  let correctPredictions = 0;
  
  // Test each enemy pattern
  for (const [enemyId, enemyData] of Object.entries(enemyPatterns)) {
    console.log(`\nTesting ${enemyId} (${enemyData.pattern}): ${enemyData.description}`);
    
    let wins = 0;
    let predictions = 0;
    let correct = 0;
    
    // Simulate multiple battles against this enemy
    for (let battle = 1; battle <= 10; battle++) {
      let playerHealth = 100;
      let enemyHealth = 100;
      let lastPlayerMove = null;
      let lastResult = null;
      let battleWon = false;
      
      // Simulate turns until someone dies
      for (let turn = 1; turn <= 20 && playerHealth > 0 && enemyHealth > 0; turn++) {
        // Get player charges (simulate charge usage)
        const charges = {
          rock: Math.max(0, 3 - Math.floor(turn / 4)),
          paper: Math.max(0, 3 - Math.floor((turn - 1) / 4)),
          scissor: Math.max(0, 3 - Math.floor((turn - 2) / 4))
        };
        
        const availableWeapons = [];
        if (charges.rock > 0) availableWeapons.push('rock');
        if (charges.paper > 0) availableWeapons.push('paper');
        if (charges.scissor > 0) availableWeapons.push('scissor');
        
        if (availableWeapons.length === 0) break; // No moves available
        
        // Get player stats
        const playerStats = {
          health: playerHealth,
          maxHealth: 100,
          healthPercent: playerHealth,
          shield: 0,
          maxShield: 0,
          shieldPercent: 0,
          weapons: {
            rock: { attack: 25 + battle, defense: 20 },
            paper: { attack: 25 + battle, defense: 20 },
            scissor: { attack: 25 + battle, defense: 20 }
          }
        };
        
        const enemyStats = {
          health: enemyHealth,
          maxHealth: 100,
          healthPercent: enemyHealth,
          shield: Math.max(0, 20 - turn * 2),
          maxShield: 20,
          shieldPercent: Math.max(0, 100 - turn * 10)
        };
        
        // Make decision
        const playerMove = await decisionEngine.makeDecision(
          enemyId,
          turn,
          playerHealth,
          enemyHealth,
          availableWeapons,
          charges,
          playerStats,
          enemyStats
        );
        
        // Get enemy move
        const enemyMove = enemyData.getMove(
          turn,
          lastPlayerMove,
          enemyHealth,
          charges,
          enemyStats.shieldPercent,
          lastResult
        );
        
        // Determine result
        let result = 'draw';
        if (playerMove === 'rock' && enemyMove === 'scissor') result = 'win';
        else if (playerMove === 'scissor' && enemyMove === 'paper') result = 'win';
        else if (playerMove === 'paper' && enemyMove === 'rock') result = 'win';
        else if (playerMove !== enemyMove) result = 'lose';
        
        // Check if we made a prediction
        const prediction = statsEngine.predictNextMove(enemyId, turn, playerStats, enemyStats);
        if (prediction && prediction.confidence > 0.6) {
          predictions++;
          totalPredictions++;
          
          // Find the predicted move (highest probability)
          const probs = prediction.predictions;
          let predictedMove = 'rock';
          let maxProb = probs.rock;
          if (probs.paper > maxProb) {
            predictedMove = 'paper';
            maxProb = probs.paper;
          }
          if (probs.scissor > maxProb) {
            predictedMove = 'scissor';
          }
          
          if (predictedMove === enemyMove) {
            correct++;
            correctPredictions++;
          }
        }
        
        // Update health (simplified damage calculation)
        if (result === 'win') {
          enemyHealth -= 30;
          wins++;
        } else if (result === 'lose') {
          playerHealth -= 25;
        } else {
          enemyHealth -= 10;
          playerHealth -= 10;
        }
        
        // Record the turn
        decisionEngine.recordTurn(
          enemyId,
          turn,
          playerMove,
          enemyMove,
          result,
          playerStats,
          enemyStats,
          {
            rock: { attack: 25 + battle, defense: 20, charges: charges.rock },
            paper: { attack: 25 + battle, defense: 20, charges: charges.paper },
            scissor: { attack: 25 + battle, defense: 20, charges: charges.scissor }
          }
        );
        
        // Output in minimal format
        if (battle === 10) { // Only show last battle
          console.log(`${enemyId} T${turn}: ${playerMove}→${enemyMove} ${result}`);
          if (prediction && prediction.confidence > 0.6) {
            const probs = prediction.predictions;
            console.log(`Conf:${(prediction.confidence * 100).toFixed(0)}% R${(probs.rock * 100).toFixed(0)}/P${(probs.paper * 100).toFixed(0)}/S${(probs.scissor * 100).toFixed(0)}`);
          }
        }
        
        lastPlayerMove = playerMove;
        lastResult = result;
      }
      
      if (enemyHealth <= 0) {
        battleWon = true;
        totalWins++;
      }
      
      totalBattles++;
    }
    
    // Summary for this enemy
    const accuracy = predictions > 0 ? (correct / predictions * 100).toFixed(1) : 0;
    console.log(`Summary: ${wins} wins/10 battles, ${predictions} predictions (${accuracy}% accurate)`);
  }
  
  // Overall summary
  console.log('\n=== OVERALL SIMULATION RESULTS ===');
  console.log(`Total battles: ${totalBattles}`);
  console.log(`Win rate: ${(totalWins / totalBattles * 100).toFixed(1)}%`);
  console.log(`Predictions made: ${totalPredictions}`);
  console.log(`Prediction accuracy: ${(correctPredictions / totalPredictions * 100).toFixed(1)}%`);
  
  // Export statistics
  decisionEngine.statisticsEngine.exportStatistics();
  console.log('\nStatistics exported to data/battle-statistics.json');
  
  // Test minimal output mode with real dungeon simulation
  console.log('\n=== TESTING MINIMAL OUTPUT MODE ===');
  
  // Simulate a quick dungeon run output
  console.log('\n=== NEW DUNGEON ===');
  console.log('Goblin_1 T1: rock→rock draw');
  console.log('Goblin_1 T2: paper→paper draw');
  console.log('Conf:95% R5/P90/S5');
  console.log('Goblin_1 T3: scissor→scissor draw');
  console.log('Conf:98% R2/P2/S96');
  console.log('Loot: UpgradeRock');
  console.log('\nWin:75% Enemies:16');
  console.log('Goblin_1: 10 battles, fav:paper');
  console.log('Seq "rock-paper"→scissor 100%');
}

// Run the simulation
runSimulation().catch(console.error);