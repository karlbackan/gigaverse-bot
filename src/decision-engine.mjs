import { initializeFireballApi } from './api.mjs';
import { config } from './config.mjs';
import { DatabaseStatisticsEngine } from './database-statistics-engine.mjs';

// Game actions enum replacement
const GameAction = {
  rock: 'rock',
  paper: 'paper',
  scissor: 'scissor'
};

// Action counters (rock beats scissor, scissor beats paper, paper beats rock)
const actionWins = {
  rock: 'scissor',
  paper: 'rock',
  scissor: 'paper'
};

const actionLosses = {
  rock: 'paper',
  paper: 'scissor', 
  scissor: 'rock'
};

// Decision engine class
export class DecisionEngine {
  constructor() {
    this.enemyPatterns = new Map();
    this.turnHistory = [];
    this.dungeonHistory = [];
    this.statisticsEngine = new DatabaseStatisticsEngine();
    this.currentEnemyId = null;
    this.currentNoobId = null;
    this.currentDungeonType = 1; // Default to Dungetron 5000
    
    // Robustness parameters
    this.params = {
      explorationRate: 0.05,       // 5% random exploration (reduced for better performance)
      minBattlesForConfidence: 15, // Need 15 battles for full confidence (slightly reduced)
      lossStreakThreshold: 0.35,   // Trigger fallback if win rate < 35%
      recentWindowSize: 20,        // Look at last 20 battles for win rate
      winStreakThreshold: 0.75,    // Reduce exploration if win rate > 75%
      mixedStrategyWeight: 0.5     // For game theory optimal play
    };
    
    // Track recent performance by enemy
    this.enemyRecentPerformance = new Map();
    
    // Track last prediction made for recording battle results
    this.lastPrediction = null;
    this.lastPredictionEnemy = null;
    this.lastPredictionTurn = null;
  }

  // Set current noobId for tracking time-based patterns
  setNoobId(noobId) {
    this.currentNoobId = noobId;
  }

  // Set current dungeon type for separate tracking
  setDungeonType(dungeonType) {
    this.currentDungeonType = dungeonType;
    this.statisticsEngine.setDungeonType(dungeonType);
  }

  // Make decision based on all available data
  async makeDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons = null, weaponCharges = null, playerStats = null, enemyStats = null) {
    if (config.debug) {
      console.log(`Making decision for enemy ${enemyId}, turn ${turn}`);
    }

    this.currentEnemyId = enemyId;

    // Prepare player and enemy stats for analysis
    const processedPlayerStats = {
      health: playerHealth,
      healthPercent: playerStats?.healthPercent || (playerHealth / (playerStats?.maxHealth || 100)) * 100,
      shield: playerStats?.shield || 0,
      shieldPercent: playerStats?.shieldPercent || 0
    };

    const processedEnemyStats = {
      health: enemyHealth,
      healthPercent: enemyStats?.healthPercent || (enemyHealth / (enemyStats?.maxHealth || 100)) * 100,
      shield: enemyStats?.shield || 0,
      shieldPercent: enemyStats?.shieldPercent || 0,
      charges: enemyStats?.charges || null  // Include charge data!
    };

    // Prepare weapon stats
    const weaponStats = {
      rock: { attack: 0, defense: 0, charges: weaponCharges?.rock || 0 },
      paper: { attack: 0, defense: 0, charges: weaponCharges?.paper || 0 },
      scissor: { attack: 0, defense: 0, charges: weaponCharges?.scissor || 0 }
    };

    // Get weapon stats from player data if available
    if (playerStats?.weapons) {
      weaponStats.rock.attack = playerStats.weapons.rock?.attack || 0;
      weaponStats.rock.defense = playerStats.weapons.rock?.defense || 0;
      weaponStats.paper.attack = playerStats.weapons.paper?.attack || 0;
      weaponStats.paper.defense = playerStats.weapons.paper?.defense || 0;
      weaponStats.scissor.attack = playerStats.weapons.scissor?.attack || 0;
      weaponStats.scissor.defense = playerStats.weapons.scissor?.defense || 0;
    }

    // CRITICAL: Track enemy charges to eliminate impossible moves
    let enemyPossibleMoves = ['rock', 'paper', 'scissor'];
    if (processedEnemyStats.charges) {
      enemyPossibleMoves = [];
      // In Underhaul, negative charges mean recharging (cannot use)
      // 0 or positive means can use
      if (processedEnemyStats.charges.rock >= 0) enemyPossibleMoves.push('rock');
      if (processedEnemyStats.charges.paper >= 0) enemyPossibleMoves.push('paper');
      if (processedEnemyStats.charges.scissor >= 0) enemyPossibleMoves.push('scissor');
      
      // Log when enemy options are limited
      if (enemyPossibleMoves.length < 3) {
        if (!config.minimalOutput) {
          // Show charges with recharging state
          const formatCharge = (c) => c < 0 ? `${c}/3 (recharging)` : `${c}/3`;
          console.log(`🎯 Enemy limited to: ${enemyPossibleMoves.join(', ')} (charges: R${formatCharge(processedEnemyStats.charges.rock)}, P${formatCharge(processedEnemyStats.charges.paper)}, S${formatCharge(processedEnemyStats.charges.scissor)})`);
        }
        
        // Force high confidence when only 1-2 options
        if (enemyPossibleMoves.length === 1) {
          console.log(`💯 Enemy can ONLY play ${enemyPossibleMoves[0]}!`);
        }
      }
    }

    // Get prediction from statistics engine
    const prediction = await this.statisticsEngine.predictNextMove(
      enemyId,
      turn,
      processedPlayerStats,
      processedEnemyStats,
      weaponStats,
      this.currentNoobId,
      enemyPossibleMoves  // Pass possible moves to filter predictions
    );
    
    // Store prediction for later recording in battle results
    this.lastPrediction = prediction;
    this.lastPredictionEnemy = enemyId;
    this.lastPredictionTurn = turn;
    
    // Check recent performance for this enemy
    const recentPerformance = this.getRecentPerformance(enemyId);
    const isLosingStreak = recentPerformance.winRate < this.params.lossStreakThreshold;
    const isWinningStreak = recentPerformance.winRate > this.params.winStreakThreshold;
    
    // Apply confidence scaling based on battle count
    const battleCount = await this.statisticsEngine.getBattleCount(enemyId);
    const confidenceMultiplier = Math.min(1, battleCount / this.params.minBattlesForConfidence);
    
    // CRITICAL: Check if enemy has only one possible move - NEVER explore in this case!
    if (enemyPossibleMoves && enemyPossibleMoves.length === 1) {
      const onlyMove = enemyPossibleMoves[0];
      const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
      const guaranteed = counters[onlyMove];
      
      if (availableWeapons.includes(guaranteed)) {
        if (!config.minimalOutput) {
          console.log(`💯 Guaranteed win! Enemy can only play ${onlyMove}, countering with ${guaranteed}`);
        }
        return guaranteed;
      }
    }
    
    // Determine exploration rate based on performance
    let effectiveExplorationRate = this.params.explorationRate;
    if (isWinningStreak && battleCount > this.params.minBattlesForConfidence) {
      effectiveExplorationRate *= 0.5; // Reduce exploration when winning
    } else if (isLosingStreak) {
      effectiveExplorationRate *= 1.5; // Increase exploration when losing
    }
    
    // Reduce exploration when enemy has limited options
    if (enemyPossibleMoves && enemyPossibleMoves.length === 2) {
      effectiveExplorationRate *= 0.5; // Half exploration rate for 50/50 situations
    }
    
    // Apply epsilon-greedy exploration
    if (Math.random() < effectiveExplorationRate) {
      if (!config.minimalOutput) {
        console.log(`Exploring (${(effectiveExplorationRate * 100).toFixed(0)}% rate)`);
      } else {
        console.log('Explore');
      }
      // Smart exploration: only explore moves that counter possible enemy moves
      return this.getSmartExplorationMove(availableWeapons, enemyPossibleMoves);
    }

    // Check if predictions are meaningful (not all zeros after filtering)
    const hasValidPredictions = prediction && 
      (prediction.predictions.rock > 0 || prediction.predictions.paper > 0 || prediction.predictions.scissor > 0);
    
    // If we have a prediction with scaled confidence and valid predictions
    if (hasValidPredictions && prediction.confidence * confidenceMultiplier > 0.3) {
      const scaledConfidence = prediction.confidence * confidenceMultiplier;
      
      if (config.minimalOutput) {
        // Minimal output: Conf% R/P/S probabilities
        const r = (prediction.predictions.rock * 100).toFixed(0);
        const p = (prediction.predictions.paper * 100).toFixed(0);
        const s = (prediction.predictions.scissor * 100).toFixed(0);
        console.log(`Conf:${(scaledConfidence * 100).toFixed(0)}% R${r}/P${p}/S${s}`);
      } else {
        console.log('Using statistical prediction');
        console.log(`  Raw confidence: ${prediction.confidence.toFixed(2)}, Scaled: ${scaledConfidence.toFixed(2)}`);
        console.log(`  Battle count: ${battleCount}, Win rate: ${(recentPerformance.winRate * 100).toFixed(0)}%`);
        console.log('Enemy move predictions:', {
          rock: prediction.predictions.rock.toFixed(3),
          paper: prediction.predictions.paper.toFixed(3),
          scissor: prediction.predictions.scissor.toFixed(3)
        });
        if (prediction.possibleMoves && prediction.possibleMoves.length < 3) {
          console.log(`  (Filtered to possible moves: ${prediction.possibleMoves.join(', ')})`);
        }
        console.log('Weapon scores:', {
          rock: prediction.weaponScores.rock.toFixed(3),
          paper: prediction.weaponScores.paper.toFixed(3),
          scissor: prediction.weaponScores.scissor.toFixed(3)
        });
      }
      
      // Handle losing streak - use fallback strategy
      if (isLosingStreak) {
        if (!config.minimalOutput) {
          console.log('Losing streak detected - using counter to favorite move');
        }
        const favoriteMove = this.getFavoriteEnemyMove(enemyId);
        if (favoriteMove) {
          const counter = actionLosses[favoriteMove]; // What beats their favorite
          if ((!availableWeapons || availableWeapons.includes(counter)) && weaponCharges[counter] > 0) {
            return counter;
          }
        }
      }

      // SIMPLIFIED OPTIMAL DECISION LOGIC
      // Find the highest scoring available weapon
      let bestWeapon = null;
      let bestScore = -1;
      
      for (const [weapon, score] of Object.entries(prediction.weaponScores)) {
        if ((!availableWeapons || availableWeapons.includes(weapon)) && weaponCharges[weapon] > 0) {
          if (score > bestScore) {
            bestScore = score;
            bestWeapon = weapon;
          }
        }
      }
      
      if (bestWeapon && bestScore > 0) {
        // Apply confidence-based mixed strategy
        const confidenceThreshold = 0.7;
        
        if (scaledConfidence > confidenceThreshold) {
          // High confidence: always pick the best weapon
          if (!config.minimalOutput) {
            console.log(`High confidence (${(scaledConfidence * 100).toFixed(0)}%): choosing best weapon ${bestWeapon} (score: ${bestScore.toFixed(3)})`);
          }
          return bestWeapon;
        } else {
          // Medium confidence: 80% best weapon, 20% random from available
          if (Math.random() < 0.8) {
            if (!config.minimalOutput) {
              console.log(`Medium confidence (${(scaledConfidence * 100).toFixed(0)}%): choosing best weapon ${bestWeapon} (score: ${bestScore.toFixed(3)})`);
            }
            return bestWeapon;
          } else {
            // Random from available weapons
            const availableWeaponList = Object.keys(prediction.weaponScores).filter(weapon => 
              (!availableWeapons || availableWeapons.includes(weapon)) && weaponCharges[weapon] > 0
            );
            const randomWeapon = availableWeaponList[Math.floor(Math.random() * availableWeaponList.length)];
            if (!config.minimalOutput) {
              console.log(`Medium confidence (${(scaledConfidence * 100).toFixed(0)}%): mixed strategy chose ${randomWeapon} over best ${bestWeapon}`);
            }
            return randomWeapon;
          }
        }
      }
    } else if (prediction && config.minimalOutput) {
      console.log(`Conf:${(prediction.confidence * 100).toFixed(0)}% (low)`);
    } else if (prediction && !config.minimalOutput) {
      console.log('Low confidence prediction:', prediction.confidence.toFixed(2));
    }

    // Fallback to enhanced random strategy with weapon weighting
    if (!config.minimalOutput) {
      console.log('Using enhanced random strategy with weapon stats');
    } else if (!prediction) {
      console.log('No data');
    }
    
    // Create weights based on weapon stats and charges
    let weights = { rock: 1, paper: 1, scissor: 1 };
    
    // Apply charge-based adjustments
    if (weaponCharges) {
      const maxCharges = Math.max(weaponCharges.rock || 0, weaponCharges.paper || 0, weaponCharges.scissor || 0);
      if (maxCharges > 0) {
        // Prefer weapons with more charges
        if (weaponCharges.rock > 0) {
          weights.rock *= (1 + 0.2 * (weaponCharges.rock / maxCharges));
        }
        if (weaponCharges.paper > 0) {
          weights.paper *= (1 + 0.2 * (weaponCharges.paper / maxCharges));
        }
        if (weaponCharges.scissor > 0) {
          weights.scissor *= (1 + 0.2 * (weaponCharges.scissor / maxCharges));
        }
      }
    }

    // Apply attack stat weighting
    if (weaponStats) {
      const maxAttack = Math.max(
        weaponStats.rock.attack,
        weaponStats.paper.attack,
        weaponStats.scissor.attack
      );
      
      if (maxAttack > 0) {
        // Give up to 30% bonus for attack stats
        weights.rock *= (1 + 0.3 * (weaponStats.rock.attack / maxAttack));
        weights.paper *= (1 + 0.3 * (weaponStats.paper.attack / maxAttack));
        weights.scissor *= (1 + 0.3 * (weaponStats.scissor.attack / maxAttack));
      }
    }

    // Apply health-based strategy adjustments
    const healthRatio = playerHealth / (playerHealth + enemyHealth);
    if (healthRatio < 0.3) {
      // Low health - slightly prefer defensive play (paper)
      weights.paper *= 1.2;
    } else if (healthRatio > 0.7) {
      // High health - slightly prefer aggressive play
      weights.rock *= 1.1;
      weights.scissor *= 1.1;
    }
    
    // CRITICAL: Apply smart weighting based on what enemy CAN play
    if (enemyPossibleMoves && enemyPossibleMoves.length < 3) {
      // Reduce weight of moves that only counter what enemy CAN'T play
      const enemyImpossible = ['rock', 'paper', 'scissor'].filter(m => !enemyPossibleMoves.includes(m));
      
      for (const impossible of enemyImpossible) {
        // What counters this impossible move?
        const uselessCounter = actionLosses[impossible];
        // Reduce its weight significantly
        weights[uselessCounter] *= 0.1;
        
        if (!config.minimalOutput) {
          console.log(`  Reducing ${uselessCounter} weight (only counters ${impossible} which enemy can't play)`);
        }
      }
    }

    if (config.debug) {
      console.log('Fallback weights:', weights);
    }

    return this.getWeightedRandomAction(weights, availableWeapons);
  }

  // Get random action
  getRandomAction(availableWeapons = null) {
    const actions = availableWeapons || Object.values(GameAction);
    return actions[Math.floor(Math.random() * actions.length)];
  }

  // Get weighted random action
  getWeightedRandomAction(weights, availableWeapons = null) {
    // Filter weights to only include available weapons
    let filteredWeights = weights;
    if (availableWeapons) {
      filteredWeights = {};
      for (const weapon of availableWeapons) {
        if (weights[weapon] !== undefined) {
          filteredWeights[weapon] = weights[weapon];
        }
      }
      
      // If no weights match available weapons, use equal weights
      if (Object.keys(filteredWeights).length === 0) {
        for (const weapon of availableWeapons) {
          filteredWeights[weapon] = 1;
        }
      }
    }
    
    const total = Object.values(filteredWeights).reduce((sum, weight) => sum + weight, 0);
    
    if (total === 0) {
      return this.getRandomAction(availableWeapons);
    }
    
    let random = Math.random() * total;

    for (const [action, weight] of Object.entries(filteredWeights)) {
      random -= weight;
      if (random <= 0) {
        return action;
      }
    }

    return this.getRandomAction(availableWeapons);
  }

  // Record turn result for learning
  recordTurn(enemyId, turn, playerAction, enemyAction, result, playerStats = null, enemyStats = null, weaponStats = null) {
    this.turnHistory.push({
      enemyId,
      turn,
      playerAction,
      enemyAction,
      result,
      timestamp: Date.now()
    });

    // Keep only last 1000 turns
    if (this.turnHistory.length > 1000) {
      this.turnHistory.shift();
    }
    
    // Update recent performance tracking
    this.updateRecentPerformance(enemyId, result);

    // Determine if prediction was correct and extract confidence
    let predictionMade = null;
    let predictionCorrect = false;
    let confidenceLevel = null;
    
    if (this.lastPrediction && 
        this.lastPredictionEnemy === enemyId && 
        this.lastPredictionTurn === turn) {
      
      // Find the predicted move (highest probability)
      const predictions = this.lastPrediction.predictions;
      let bestMove = null;
      let bestProb = 0;
      
      for (const [move, prob] of Object.entries(predictions)) {
        if (prob > bestProb) {
          bestProb = prob;
          bestMove = move;
        }
      }
      
      predictionMade = bestMove;
      predictionCorrect = bestMove === enemyAction;
      confidenceLevel = this.lastPrediction.confidence;
      
      // Clear the stored prediction
      this.lastPrediction = null;
      this.lastPredictionEnemy = null;
      this.lastPredictionTurn = null;
    }

    // Record to statistics engine
    this.statisticsEngine.recordBattle({
      enemyId,
      turn,
      playerAction,
      enemyAction,
      result,
      playerStats,
      enemyStats,
      weaponStats,
      noobId: this.currentNoobId,
      dungeonType: this.currentDungeonType,
      timestamp: Date.now(),
      predictionMade,
      predictionCorrect,
      confidenceLevel
    });
  }

  // Smart exploration: only explore moves that counter possible enemy moves
  getSmartExplorationMove(availableWeapons, enemyPossibleMoves) {
    if (!enemyPossibleMoves || enemyPossibleMoves.length === 3) {
      // All moves possible, use normal random
      return this.getRandomAction(availableWeapons);
    }
    
    // Determine which of our moves are useful (counter what enemy CAN play)
    const usefulMoves = new Set();
    
    // For each possible enemy move, add the counter to useful moves
    for (const enemyMove of enemyPossibleMoves) {
      const counter = actionLosses[enemyMove]; // What beats this enemy move
      if (availableWeapons.includes(counter)) {
        usefulMoves.add(counter);
      }
    }
    
    // Convert to array
    const usefulArray = Array.from(usefulMoves);
    
    if (config.debug || !config.minimalOutput) {
      console.log(`  Smart exploration: Enemy can play ${enemyPossibleMoves.join('/')}, useful moves: ${usefulArray.join('/')}`);
      
      // Show what we're excluding
      const excluded = availableWeapons.filter(w => !usefulArray.includes(w));
      if (excluded.length > 0) {
        const enemyCantPlay = ['rock', 'paper', 'scissor'].filter(m => !enemyPossibleMoves.includes(m));
        console.log(`  Excluding ${excluded.join('/')} (only counters ${enemyCantPlay.join('/')} which enemy can't play)`);
      }
    }
    
    // Pick randomly from useful moves
    return usefulArray[Math.floor(Math.random() * usefulArray.length)] || this.getRandomAction(availableWeapons);
  }

  // Get statistics summary
  getStatsSummary() {
    const summary = {
      enemiesAnalyzed: this.enemyPatterns.size,
      turnsRecorded: this.turnHistory.length,
      recentWinRate: 0,
      statisticsReport: null
    };

    if (this.turnHistory.length > 0) {
      const recentTurns = this.turnHistory.slice(-100);
      const wins = recentTurns.filter(turn => turn.result === 'win').length;
      summary.recentWinRate = wins / recentTurns.length;
    }

    // Get report from statistics engine
    if (this.currentEnemyId) {
      summary.statisticsReport = this.statisticsEngine.getAnalysisReport(this.currentEnemyId);
    }

    return summary;
  }

  // Get full analysis report
  getFullAnalysisReport() {
    return this.statisticsEngine.getAnalysisReport();
  }

  // Export statistics data
  exportStatistics() {
    this.statisticsEngine.saveData();
    console.log('Statistics data exported');
  }
  
  // Get recent performance for an enemy
  getRecentPerformance(enemyId) {
    const recent = this.enemyRecentPerformance.get(enemyId) || { wins: 0, total: 0 };
    return {
      winRate: recent.total > 0 ? recent.wins / recent.total : 0.5,
      battleCount: recent.total
    };
  }
  
  // Get favorite enemy move
  getFavoriteEnemyMove(enemyId) {
    const dungeonStats = this.statisticsEngine.enemyStats[this.currentDungeonType];
    if (!dungeonStats) return null;
    
    const enemy = dungeonStats.get(enemyId);
    if (!enemy) return null;
    
    const moves = enemy.moves;
    let favorite = null;
    let maxCount = 0;
    
    for (const [move, count] of Object.entries(moves)) {
      if (count > maxCount) {
        maxCount = count;
        favorite = move;
      }
    }
    
    return favorite;
  }
  
  // Select from probability distribution
  selectFromProbabilities(probabilities) {
    const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
    if (total === 0) return null;
    
    let random = Math.random() * total;
    for (const [option, probability] of Object.entries(probabilities)) {
      random -= probability;
      if (random <= 0) {
        return option;
      }
    }
    
    // Fallback (shouldn't reach here)
    return Object.keys(probabilities)[0];
  }
  
  // Update recent performance tracking
  updateRecentPerformance(enemyId, result) {
    if (!this.enemyRecentPerformance.has(enemyId)) {
      this.enemyRecentPerformance.set(enemyId, { wins: 0, total: 0, history: [] });
    }
    
    const perf = this.enemyRecentPerformance.get(enemyId);
    perf.history.push(result === 'win' ? 1 : 0);
    
    // Keep only recent window
    if (perf.history.length > this.params.recentWindowSize) {
      perf.history.shift();
    }
    
    // Recalculate stats
    perf.total = perf.history.length;
    perf.wins = perf.history.filter(r => r === 1).length;
  }
}