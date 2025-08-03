import { StatisticsEngineEnhanced } from '../src/statistics-engine-enhanced.mjs';
import { DecisionEngineEnhanced } from '../src/decision-engine-enhanced.mjs';
import { config } from '../src/config.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set minimal output for cleaner test results
config.minimalOutput = true;

// Define 16 different enemy patterns with varying complexity
const enemyPatterns = {
  'Goblin_1': {
    pattern: 'sequence-3',
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
    pattern: 'sequence-6',
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
    pattern: 'sequence-4',
    description: 'R-P-S-S pattern',
    getMove: (turn) => {
      const pattern = ['rock', 'paper', 'scissor', 'scissor'];
      return pattern[(turn - 1) % pattern.length];
    }
  },
  'Vampire_9': {
    pattern: 'reverse-sequence',
    description: 'Scissor→paper→rock (reverse of common pattern)',
    getMove: (turn) => ['scissor', 'paper', 'rock'][(turn - 1) % 3]
  },
  'Ghost_10': {
    pattern: 'sequence-5',
    description: 'R-R-P-S-S pattern',
    getMove: (turn) => {
      const pattern = ['rock', 'rock', 'paper', 'scissor', 'scissor'];
      return pattern[(turn - 1) % pattern.length];
    }
  },
  'Witch_11': {
    pattern: 'fibonacci',
    description: 'Changes move based on Fibonacci sequence timing',
    getMove: (turn) => {
      const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34];
      const moves = ['rock', 'paper', 'scissor'];
      for (let i = 0; i < fib.length; i++) {
        if (turn <= fib[i]) return moves[i % 3];
      }
      return moves[2];
    }
  },
  'Necromancer_12': {
    pattern: 'sequence-7',
    description: 'R-P-S-R-S-P-P pattern',
    getMove: (turn) => {
      const pattern = ['rock', 'paper', 'scissor', 'rock', 'scissor', 'paper', 'paper'];
      return pattern[(turn - 1) % pattern.length];
    }
  },
  'Lich_13': {
    pattern: 'prime-turns',
    description: 'Paper on prime turns (2,3,5,7,11...), rock otherwise',
    getMove: (turn) => {
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
      return primes.includes(turn) ? 'paper' : 'rock';
    }
  },
  'Elemental_14': {
    pattern: 'sequence-8',
    description: 'R-R-P-P-S-S-R-S pattern',
    getMove: (turn) => {
      const pattern = ['rock', 'rock', 'paper', 'paper', 'scissor', 'scissor', 'rock', 'scissor'];
      return pattern[(turn - 1) % pattern.length];
    }
  },
  'Golem_15': {
    pattern: 'defensive',
    description: 'Always plays rock (max defense)',
    getMove: () => 'rock'
  },
  'Wizard_16': {
    pattern: 'complex-sequence-9',
    description: 'R-P-S-P-R-R-S-S-P pattern (9 moves)',
    getMove: (turn) => {
      const pattern = ['rock', 'paper', 'scissor', 'paper', 'rock', 'rock', 'scissor', 'scissor', 'paper'];
      return pattern[(turn - 1) % pattern.length];
    }
  }
};

// Simulate battles with proper sessions
async function runMassiveSimulation() {
  console.log('=== MASSIVE STATISTICS SIMULATION (100x Data) ===\n');
  
  const BATTLES_PER_ENEMY = 1000; // 100x more than before
  const BATTLES_PER_SESSION = 50; // Simulate realistic sessions
  const SESSIONS = BATTLES_PER_ENEMY / BATTLES_PER_SESSION; // 20 sessions
  
  // Backup existing statistics
  const backupPath = path.join(__dirname, '..', 'data', 'battle-statistics-backup.json');
  const statsPath = path.join(__dirname, '..', 'data', 'battle-statistics.json');
  
  if (fs.existsSync(statsPath)) {
    fs.copyFileSync(statsPath, backupPath);
    console.log('Backed up existing statistics to battle-statistics-backup.json');
  }
  
  // Clear statistics for fresh start
  fs.writeFileSync(statsPath, JSON.stringify({
    lastUpdated: Date.now(),
    enemyStats: [],
    moveSequences: []
  }, null, 2));
  
  let globalTotalBattles = 0;
  let globalTotalWins = 0;
  let globalTotalPredictions = 0;
  let globalCorrectPredictions = 0;
  
  // Results tracking for validation
  const validationResults = {
    enemies: {},
    sessionConsistency: {},
    patternDetection: {},
    predictionAccuracy: {}
  };
  
  // Test each enemy pattern
  for (const [enemyId, enemyData] of Object.entries(enemyPatterns)) {
    console.log(`\nTesting ${enemyId} (${enemyData.pattern}): ${enemyData.description}`);
    console.log(`Running ${SESSIONS} sessions of ${BATTLES_PER_SESSION} battles each...`);
    
    let enemyWins = 0;
    let enemyPredictions = 0;
    let enemyCorrect = 0;
    const sessionResults = [];
    
    // Run multiple sessions
    for (let session = 1; session <= SESSIONS; session++) {
      // Create new decision engine for each session (simulates bot restarts)
      const decisionEngine = new DecisionEngineEnhanced();
      const noobId = 76024 + session; // Vary noobId slightly per session
      decisionEngine.setNoobId(noobId);
      
      let sessionWins = 0;
      let sessionPredictions = 0;
      let sessionCorrect = 0;
      
      // Reset enemy history for adaptive patterns
      if (enemyData.history) {
        enemyData.history = [];
      }
      
      // Simulate battles in this session
      for (let battle = 1; battle <= BATTLES_PER_SESSION; battle++) {
        let playerHealth = 100;
        let enemyHealth = 100;
        let lastPlayerMove = null;
        let lastResult = null;
        let battleWon = false;
        
        // Simulate turns until someone dies
        for (let turn = 1; turn <= 30 && playerHealth > 0 && enemyHealth > 0; turn++) {
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
              rock: { attack: 25 + Math.floor(battle/10), defense: 20 },
              paper: { attack: 25 + Math.floor(battle/10), defense: 20 },
              scissor: { attack: 25 + Math.floor(battle/10), defense: 20 }
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
          const prediction = decisionEngine.statisticsEngine.predictNextMove(enemyId, turn, playerStats, enemyStats);
          if (prediction && prediction.confidence > 0.6) {
            sessionPredictions++;
            enemyPredictions++;
            globalTotalPredictions++;
            
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
              sessionCorrect++;
              enemyCorrect++;
              globalCorrectPredictions++;
            }
          }
          
          // Update health (simplified damage calculation)
          if (result === 'win') {
            enemyHealth -= 30;
            sessionWins++;
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
              rock: { attack: 25 + Math.floor(battle/10), defense: 20, charges: charges.rock },
              paper: { attack: 25 + Math.floor(battle/10), defense: 20, charges: charges.paper },
              scissor: { attack: 25 + Math.floor(battle/10), defense: 20, charges: charges.scissor }
            }
          );
          
          lastPlayerMove = playerMove;
          lastResult = result;
        }
        
        if (enemyHealth <= 0) {
          battleWon = true;
          enemyWins++;
          globalTotalWins++;
        }
        
        globalTotalBattles++;
      }
      
      // Record session results
      const sessionAccuracy = sessionPredictions > 0 ? (sessionCorrect / sessionPredictions * 100) : 0;
      sessionResults.push({
        session,
        wins: sessionWins,
        predictions: sessionPredictions,
        correct: sessionCorrect,
        accuracy: sessionAccuracy
      });
      
      // Show progress every 5 sessions
      if (session % 5 === 0) {
        console.log(`  Session ${session}/${SESSIONS}: ${sessionWins} wins, ${sessionAccuracy.toFixed(1)}% accuracy`);
      }
    }
    
    // Calculate enemy statistics
    const overallAccuracy = enemyPredictions > 0 ? (enemyCorrect / enemyPredictions * 100) : 0;
    console.log(`\nEnemy Summary:`)
    console.log(`  Total battles: ${BATTLES_PER_ENEMY}`)
    console.log(`  Win rate: ${(enemyWins / BATTLES_PER_ENEMY * 100).toFixed(1)}%`)
    console.log(`  Predictions: ${enemyPredictions} (${overallAccuracy.toFixed(1)}% accurate)`)
    
    // Analyze session consistency
    const accuracies = sessionResults.map(r => r.accuracy);
    const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length;
    const stdDev = Math.sqrt(variance);
    
    console.log(`  Session consistency: ${avgAccuracy.toFixed(1)}% ± ${stdDev.toFixed(1)}%`);
    
    // Store validation results
    validationResults.enemies[enemyId] = {
      pattern: enemyData.pattern,
      totalBattles: BATTLES_PER_ENEMY,
      winRate: (enemyWins / BATTLES_PER_ENEMY * 100),
      predictionAccuracy: overallAccuracy,
      sessionConsistency: {
        average: avgAccuracy,
        stdDev: stdDev,
        sessions: sessionResults
      }
    };
  }
  
  // Overall summary
  console.log('\n=== OVERALL SIMULATION RESULTS ===');
  console.log(`Total battles: ${globalTotalBattles}`);
  console.log(`Overall win rate: ${(globalTotalWins / globalTotalBattles * 100).toFixed(1)}%`);
  console.log(`Total predictions: ${globalTotalPredictions}`);
  console.log(`Overall prediction accuracy: ${(globalCorrectPredictions / globalTotalPredictions * 100).toFixed(1)}%`);
  
  // Pattern detection analysis
  console.log('\n=== PATTERN DETECTION ANALYSIS ===');
  const decisionEngine = new DecisionEngineEnhanced();
  const statsEngine = decisionEngine.statisticsEngine;
  
  for (const [enemyId, data] of statsEngine.enemyStats.entries()) {
    const report = statsEngine.getAnalysisReport(enemyId);
    if (report && report.totalBattles >= 100) {
      console.log(`\n${enemyId}:`);
      console.log(`  Battles: ${report.totalBattles}`);
      console.log(`  Favorite move: ${report.favoriteMove}`);
      
      if (report.strongestSequences && report.strongestSequences.length > 0) {
        console.log(`  Top sequences:`);
        report.strongestSequences.forEach(seq => {
          console.log(`    "${seq.sequence}" → ${seq.nextMove} (${(seq.probability * 100).toFixed(0)}%, n=${seq.samples})`);
        });
      }
      
      if (report.cycleLength) {
        console.log(`  Detected cycle length: ${report.cycleLength}`);
      }
      
      if (report.patternDescription) {
        console.log(`  Pattern: ${report.patternDescription}`);
      }
      
      // Check if pattern matches expected
      const expected = enemyPatterns[enemyId];
      validationResults.patternDetection[enemyId] = {
        expected: expected.pattern,
        detected: report.strongestSequences,
        matches: validatePatternDetection(enemyId, expected, report)
      };
    }
  }
  
  // Save validation results
  const resultsPath = path.join(__dirname, '..', 'data', 'validation-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(validationResults, null, 2));
  console.log('\n✅ Validation results saved to data/validation-results.json');
  
  // Export final statistics
  statsEngine.exportStatistics();
  console.log('✅ Statistics exported to data/battle-statistics.json');
}

// Validate pattern detection accuracy
function validatePatternDetection(enemyId, expected, report) {
  // Check based on pattern type
  switch (expected.pattern) {
    case 'sequence-3': // rock→paper→scissor
      return report.strongestSequences.some(seq => 
        seq.sequence === 'rock-paper' && seq.nextMove === 'scissor' && seq.probability > 0.9
      );
    
    case 'defensive': // Always rock
      return report.favoriteMove === 'rock' && 
        report.moves.rock > (report.moves.paper + report.moves.scissor) * 5;
    
    case 'random-weighted':
      // Should roughly match the weights
      const total = report.moves.rock + report.moves.paper + report.moves.scissor;
      const rockPercent = report.moves.rock / total;
      const paperPercent = report.moves.paper / total;
      return Math.abs(rockPercent - 0.6) < 0.05 && Math.abs(paperPercent - 0.3) < 0.05;
    
    default:
      // For complex sequences, check if any strong pattern emerged
      return report.strongestSequences.length > 0 && report.strongestSequences[0].probability > 0.7;
  }
}

// Run the simulation
runMassiveSimulation().catch(console.error);