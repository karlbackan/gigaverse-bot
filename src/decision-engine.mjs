import { initializeFireballApi } from './api.mjs';
import { config } from './config.mjs';
import { StatisticsEngine } from './statistics-engine.mjs';

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
    this.statisticsEngine = new StatisticsEngine();
    this.currentEnemyId = null;
    this.currentNoobId = null;
    
    // Robustness parameters
    this.params = {
      explorationRate: 0.1,        // 10% random exploration
      minBattlesForConfidence: 20, // Need 20 battles for full confidence
      lossStreakThreshold: 0.35,   // Trigger fallback if win rate < 35%
      recentWindowSize: 20,        // Look at last 20 battles for win rate
      winStreakThreshold: 0.75,    // Reduce exploration if win rate > 75%
      mixedStrategyWeight: 0.5     // For game theory optimal play
    };
    
    // Track recent performance by enemy
    this.enemyRecentPerformance = new Map();
  }

  // Set current noobId for tracking time-based patterns
  setNoobId(noobId) {
    this.currentNoobId = noobId;
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
      shieldPercent: enemyStats?.shieldPercent || 0
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
      if (processedEnemyStats.charges.rock > 0) enemyPossibleMoves.push('rock');
      if (processedEnemyStats.charges.paper > 0) enemyPossibleMoves.push('paper');
      if (processedEnemyStats.charges.scissor > 0) enemyPossibleMoves.push('scissor');
      
      // Log when enemy options are limited
      if (enemyPossibleMoves.length < 3) {
        if (!config.minimalOutput) {
          console.log(`🎯 Enemy limited to: ${enemyPossibleMoves.join(', ')} (charges: R${processedEnemyStats.charges.rock}/P${processedEnemyStats.charges.paper}/S${processedEnemyStats.charges.scissor})`);
        }
        
        // Force high confidence when only 1-2 options
        if (enemyPossibleMoves.length === 1) {
          console.log(`💯 Enemy can ONLY play ${enemyPossibleMoves[0]}!`);
        }
      }
    }

    // Get prediction from statistics engine
    const prediction = this.statisticsEngine.predictNextMove(
      enemyId,
      turn,
      processedPlayerStats,
      processedEnemyStats,
      weaponStats,
      this.currentNoobId,
      enemyPossibleMoves  // Pass possible moves to filter predictions
    );
    
    // Check recent performance for this enemy
    const recentPerformance = this.getRecentPerformance(enemyId);
    const isLosingStreak = recentPerformance.winRate < this.params.lossStreakThreshold;
    const isWinningStreak = recentPerformance.winRate > this.params.winStreakThreshold;
    
    // Apply confidence scaling based on battle count
    const battleCount = this.statisticsEngine.getBattleCount(enemyId);
    const confidenceMultiplier = Math.min(1, battleCount / this.params.minBattlesForConfidence);
    
    // Determine exploration rate based on performance
    let effectiveExplorationRate = this.params.explorationRate;
    if (isWinningStreak && battleCount > this.params.minBattlesForConfidence) {
      effectiveExplorationRate *= 0.5; // Reduce exploration when winning
    } else if (isLosingStreak) {
      effectiveExplorationRate *= 1.5; // Increase exploration when losing
    }
    
    // Apply epsilon-greedy exploration FIRST
    if (Math.random() < effectiveExplorationRate) {
      if (!config.minimalOutput) {
        console.log(`Exploring (${(effectiveExplorationRate * 100).toFixed(0)}% rate)`);
      } else {
        console.log('Explore');
      }
      return this.getRandomAction(availableWeapons);
    }

    // If we have a prediction with scaled confidence
    if (prediction && prediction.confidence * confidenceMultiplier > 0.3) {
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

      // Implement mixed strategy based on weapon scores
      const availableScores = {};
      let totalPositiveScore = 0;
      
      for (const [weapon, score] of Object.entries(prediction.weaponScores)) {
        if ((!availableWeapons || availableWeapons.includes(weapon)) && weaponCharges[weapon] > 0) {
          // Convert scores to probabilities (shift to positive)
          const shiftedScore = score + 1; // Ensure positive
          availableScores[weapon] = Math.max(0, shiftedScore);
          totalPositiveScore += availableScores[weapon];
        }
      }
      
      if (Object.keys(availableScores).length > 0 && totalPositiveScore > 0) {
        // Find the best weapon
        let bestWeapon = null;
        let bestScore = -Infinity;
        for (const [weapon, score] of Object.entries(prediction.weaponScores)) {
          if (availableScores[weapon] !== undefined && score > bestScore) {
            bestScore = score;
            bestWeapon = weapon;
          }
        }
        
        // Apply mixed strategy - don't always pick the best
        const mixedProbabilities = {};
        for (const [weapon, score] of Object.entries(availableScores)) {
          if (weapon === bestWeapon) {
            // Best weapon gets extra weight based on confidence
            mixedProbabilities[weapon] = score + (totalPositiveScore * this.params.mixedStrategyWeight);
          } else {
            mixedProbabilities[weapon] = score;
          }
        }
        
        // Select based on mixed probabilities
        const selectedWeapon = this.selectFromProbabilities(mixedProbabilities);
        
        if (!config.minimalOutput && selectedWeapon !== bestWeapon) {
          console.log(`Mixed strategy: selected ${selectedWeapon} instead of best ${bestWeapon}`);
        }
        
        return selectedWeapon;
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
      timestamp: Date.now()
    });
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
    const enemy = this.statisticsEngine.enemyStats.get(enemyId);
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