import { StatisticsEngineEnhanced } from '../src/statistics-engine-enhanced.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expected patterns for each enemy
const expectedPatterns = {
  'Goblin_1': {
    type: 'cycle',
    cycleLength: 3,
    sequence: ['rock', 'paper', 'scissor'],
    description: 'Always plays rock→paper→scissor sequence'
  },
  'Goblin_2': {
    type: 'adaptive',
    description: 'Counters player\'s last move'
  },
  'Orc_3': {
    type: 'turn-based',
    turns: { 1: 'rock', 2: 'paper', 3: 'scissor' },
    description: 'Different move each turn'
  },
  'Troll_4': {
    type: 'health-based',
    description: 'Rock when healthy (>50%), scissor when hurt'
  },
  'Skeleton_5': {
    type: 'cycle',
    cycleLength: 6,
    sequence: ['rock', 'rock', 'paper', 'paper', 'scissor', 'scissor'],
    description: 'Plays each move twice'
  },
  'Zombie_6': {
    type: 'random-weighted',
    weights: { rock: 0.6, paper: 0.3, scissor: 0.1 },
    description: '60% rock, 30% paper, 10% scissor'
  },
  'Demon_7': {
    type: 'adaptive',
    description: 'Adapts based on player patterns'
  },
  'Dragon_8': {
    type: 'cycle',
    cycleLength: 4,
    sequence: ['rock', 'paper', 'scissor', 'scissor'],
    description: 'R-P-S-S pattern'
  },
  'Vampire_9': {
    type: 'cycle',
    cycleLength: 3,
    sequence: ['scissor', 'paper', 'rock'],
    description: 'Reverse sequence'
  },
  'Ghost_10': {
    type: 'cycle',
    cycleLength: 5,
    sequence: ['rock', 'rock', 'paper', 'scissor', 'scissor'],
    description: 'R-R-P-S-S pattern'
  },
  'Witch_11': {
    type: 'fibonacci',
    description: 'Changes based on Fibonacci timing'
  },
  'Necromancer_12': {
    type: 'cycle',
    cycleLength: 7,
    sequence: ['rock', 'paper', 'scissor', 'rock', 'scissor', 'paper', 'paper'],
    description: 'R-P-S-R-S-P-P pattern'
  },
  'Lich_13': {
    type: 'prime-turns',
    description: 'Paper on prime turns, rock otherwise'
  },
  'Elemental_14': {
    type: 'cycle',
    cycleLength: 8,
    sequence: ['rock', 'rock', 'paper', 'paper', 'scissor', 'scissor', 'rock', 'scissor'],
    description: 'R-R-P-P-S-S-R-S pattern'
  },
  'Golem_15': {
    type: 'static',
    move: 'rock',
    description: 'Always plays rock'
  },
  'Wizard_16': {
    type: 'cycle',
    cycleLength: 9,
    sequence: ['rock', 'paper', 'scissor', 'paper', 'rock', 'rock', 'scissor', 'scissor', 'paper'],
    description: '9-move complex pattern'
  }
};

async function validateAlgorithms() {
  console.log('=== ALGORITHM VALIDATION REPORT ===\n');
  
  // Load statistics
  const statsEngine = new StatisticsEngineEnhanced();
  console.log(`Loaded data for ${statsEngine.enemyStats.size} enemies\n`);
  
  const validationResults = {
    patternDetection: {},
    predictionAccuracy: {},
    overallStats: {
      totalEnemies: 0,
      correctPatterns: 0,
      totalBattles: 0,
      avgPredictionAccuracy: 0
    }
  };
  
  // Validate each enemy
  for (const [enemyId, expected] of Object.entries(expectedPatterns)) {
    const enemyData = statsEngine.enemyStats.get(enemyId);
    if (!enemyData) {
      console.log(`${enemyId}: No data collected`);
      continue;
    }
    
    console.log(`\n=== ${enemyId} ===`);
    console.log(`Expected: ${expected.description}`);
    console.log(`Battles: ${enemyData.totalBattles}`);
    
    validationResults.overallStats.totalEnemies++;
    validationResults.overallStats.totalBattles += enemyData.totalBattles;
    
    // Get analysis report
    const report = statsEngine.getAnalysisReport(enemyId);
    
    // 1. Validate pattern detection
    let patternCorrect = false;
    let patternDetails = '';
    
    switch (expected.type) {
      case 'cycle':
        if (report.cycleLength === expected.cycleLength) {
          patternCorrect = true;
          patternDetails = `✓ Detected cycle length: ${report.cycleLength}`;
          
          // Verify sequence matches
          const sequenceMatches = validateCycleSequence(enemyData, expected.sequence);
          if (!sequenceMatches) {
            patternCorrect = false;
            patternDetails += ' (but sequence doesn\'t match)';
          }
        } else {
          patternDetails = `✗ Expected cycle ${expected.cycleLength}, detected ${report.cycleLength || 'none'}`;
        }
        break;
        
      case 'static':
        const totalMoves = enemyData.moves.rock + enemyData.moves.paper + enemyData.moves.scissor;
        const dominantMove = report.favoriteMove;
        const dominance = enemyData.moves[dominantMove] / totalMoves;
        
        if (dominantMove === expected.move && dominance > 0.95) {
          patternCorrect = true;
          patternDetails = `✓ ${dominance.toFixed(1)}% ${dominantMove}`;
        } else {
          patternDetails = `✗ Expected ${expected.move}, got ${dominantMove} (${(dominance * 100).toFixed(1)}%)`;
        }
        break;
        
      case 'random-weighted':
        const weights = calculateMoveWeights(enemyData);
        const tolerance = 0.05; // 5% tolerance
        
        patternCorrect = true;
        for (const [move, expectedWeight] of Object.entries(expected.weights)) {
          if (Math.abs(weights[move] - expectedWeight) > tolerance) {
            patternCorrect = false;
          }
        }
        
        patternDetails = `${patternCorrect ? '✓' : '✗'} R:${(weights.rock * 100).toFixed(0)}% P:${(weights.paper * 100).toFixed(0)}% S:${(weights.scissor * 100).toFixed(0)}%`;
        break;
        
      case 'turn-based':
        patternCorrect = true;
        patternDetails = '✓ Turn-based pattern';
        
        for (const [turn, expectedMove] of Object.entries(expected.turns)) {
          const turnData = enemyData.movesByTurn[turn];
          if (turnData) {
            const turnTotal = turnData.rock + turnData.paper + turnData.scissor;
            const actualMove = report.favoriteMove; // Should check per turn
            if (turnData[expectedMove] / turnTotal < 0.9) {
              patternCorrect = false;
              patternDetails = `✗ Turn ${turn} expected ${expectedMove}`;
              break;
            }
          }
        }
        break;
        
      case 'adaptive':
        if (report.adaptivePatterns && 
            (report.adaptivePatterns.countersLast || report.adaptivePatterns.mirrorsLast)) {
          patternCorrect = true;
          patternDetails = '✓ Adaptive behavior detected';
        } else {
          patternDetails = '✗ No adaptive behavior detected';
        }
        break;
        
      case 'prime-turns':
      case 'fibonacci':
      case 'health-based':
        // These require more complex validation
        patternCorrect = report.patternDescription.includes(expected.type);
        patternDetails = patternCorrect ? '✓ Special pattern detected' : '✗ Pattern not detected';
        break;
    }
    
    console.log(`Pattern Detection: ${patternDetails}`);
    
    if (patternCorrect) {
      validationResults.overallStats.correctPatterns++;
    }
    
    // 2. Validate sequence predictions
    if (report.strongestSequences && report.strongestSequences.length > 0) {
      console.log('\nTop Sequence Predictions:');
      report.strongestSequences.slice(0, 3).forEach(seq => {
        console.log(`  "${seq.sequence}" → ${seq.nextMove} (${(seq.probability * 100).toFixed(0)}%, n=${seq.samples})`);
      });
    }
    
    // 3. Calculate prediction accuracy from move history
    const history = statsEngine.moveHistory.get(enemyId) || [];
    let predictions = 0;
    let correct = 0;
    
    // Simulate predictions
    for (let i = 10; i < Math.min(history.length, 100); i++) {
      const prediction = statsEngine.predictNextMove(
        enemyId,
        history[i].turn,
        { healthPercent: 80 },
        { healthPercent: 80 }
      );
      
      if (prediction && prediction.confidence > 0.6) {
        predictions++;
        const probs = prediction.predictions;
        let predictedMove = 'rock';
        if (probs.paper > probs[predictedMove]) predictedMove = 'paper';
        if (probs.scissor > probs[predictedMove]) predictedMove = 'scissor';
        
        if (predictedMove === history[i].move) {
          correct++;
        }
      }
    }
    
    const accuracy = predictions > 0 ? (correct / predictions * 100) : 0;
    console.log(`\nPrediction Accuracy: ${accuracy.toFixed(1)}% (${correct}/${predictions})`);
    
    // Store results
    validationResults.patternDetection[enemyId] = {
      expected: expected.type,
      correct: patternCorrect,
      details: patternDetails
    };
    
    validationResults.predictionAccuracy[enemyId] = {
      accuracy,
      predictions,
      correct
    };
    
    // Show pattern description
    if (report.patternDescription) {
      console.log(`Detected Pattern: ${report.patternDescription}`);
    }
  }
  
  // Overall summary
  console.log('\n\n=== OVERALL VALIDATION SUMMARY ===');
  console.log(`Total Enemies Analyzed: ${validationResults.overallStats.totalEnemies}`);
  console.log(`Total Battles: ${validationResults.overallStats.totalBattles}`);
  console.log(`Pattern Detection Success: ${validationResults.overallStats.correctPatterns}/${validationResults.overallStats.totalEnemies} (${(validationResults.overallStats.correctPatterns / validationResults.overallStats.totalEnemies * 100).toFixed(1)}%)`);
  
  // Calculate average prediction accuracy
  let totalAccuracy = 0;
  let enemiesWithPredictions = 0;
  
  for (const [enemyId, data] of Object.entries(validationResults.predictionAccuracy)) {
    if (data.predictions > 0) {
      totalAccuracy += data.accuracy;
      enemiesWithPredictions++;
    }
  }
  
  const avgAccuracy = enemiesWithPredictions > 0 ? totalAccuracy / enemiesWithPredictions : 0;
  console.log(`Average Prediction Accuracy: ${avgAccuracy.toFixed(1)}%`);
  
  // Enhanced pattern detection summary
  console.log('\n=== ENHANCED PATTERN DETECTION ===');
  
  // Calculate pattern statistics
  let patternsDetected = 0;
  let cyclesDetected = 0;
  let longestPattern = 0;
  
  for (const [enemyId, enemy] of statsEngine.enemyStats.entries()) {
    if (enemy.detectedPatterns) {
      if (enemy.detectedPatterns.cycleLength) {
        cyclesDetected++;
      }
      
      if (enemy.detectedPatterns.sequencePatterns && enemy.detectedPatterns.sequencePatterns.length > 0) {
        patternsDetected++;
        const longest = Math.max(...enemy.detectedPatterns.sequencePatterns.map(p => p.length));
        if (longest > longestPattern) {
          longestPattern = longest;
        }
      }
    }
  }
  
  console.log(`Patterns Detected: ${patternsDetected}`);
  console.log(`Cycles Detected: ${cyclesDetected}`);
  console.log(`Longest Pattern: ${longestPattern} moves`);
  
  // Save validation results
  const resultsPath = path.join(__dirname, '..', 'data', 'algorithm-validation.json');
  fs.writeFileSync(resultsPath, JSON.stringify(validationResults, null, 2));
  console.log('\n✅ Validation results saved to data/algorithm-validation.json');
}

function validateCycleSequence(enemyData, expectedSequence) {
  // Check if the move distribution matches the expected cycle
  for (let turn = 1; turn <= expectedSequence.length; turn++) {
    const turnData = enemyData.movesByTurn[turn];
    if (!turnData) continue;
    
    const expectedMove = expectedSequence[(turn - 1) % expectedSequence.length];
    const turnTotal = turnData.rock + turnData.paper + turnData.scissor;
    
    if (turnTotal > 0 && turnData[expectedMove] / turnTotal < 0.9) {
      return false;
    }
  }
  
  return true;
}

function calculateMoveWeights(enemyData) {
  const total = enemyData.moves.rock + enemyData.moves.paper + enemyData.moves.scissor;
  return {
    rock: enemyData.moves.rock / total,
    paper: enemyData.moves.paper / total,
    scissor: enemyData.moves.scissor / total
  };
}

// Run validation
validateAlgorithms().catch(console.error);