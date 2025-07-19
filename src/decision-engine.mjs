import { initializeFireballApi } from './api.mjs';
import { config } from './config.mjs';

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
  }

  // Analyze enemy patterns from historical data
  async analyzeEnemyPatterns(enemyId) {
    try {
      // Check cache first
      if (this.enemyPatterns.has(enemyId)) {
        return this.enemyPatterns.get(enemyId);
      }

      // Statistics disabled - no Hasura JWT available
      return null;

      // Get recent encounters with this enemy
      const encounters = await fireballApi.getEncountersLoot({
        filter: { enemyId },
        limit: 200
      });

      if (!encounters || encounters.length === 0) {
        return null;
      }

      // Count enemy actions
      const patterns = {
        rock: 0,
        paper: 0,
        scissor: 0,
        total: 0
      };

      // Analyze by turn number
      const turnPatterns = {};

      encounters.forEach(encounter => {
        if (encounter.enemyAction) {
          patterns[encounter.enemyAction]++;
          patterns.total++;

          // Track patterns by turn
          const turn = encounter.turn || 0;
          if (!turnPatterns[turn]) {
            turnPatterns[turn] = { rock: 0, paper: 0, scissor: 0 };
          }
          turnPatterns[turn][encounter.enemyAction]++;
        }
      });

      // Calculate probabilities
      const probabilities = {
        rock: patterns.rock / patterns.total,
        paper: patterns.paper / patterns.total,
        scissor: patterns.scissor / patterns.total
      };

      const analysis = {
        patterns,
        probabilities,
        turnPatterns,
        favoriteAction: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0]
      };

      // Cache the analysis
      this.enemyPatterns.set(enemyId, analysis);

      return analysis;
    } catch (error) {
      console.error(`Failed to analyze enemy ${enemyId}:`, error);
      return null;
    }
  }

  // Get player's recent performance
  async analyzePlayerPerformance() {
    try {
      const fireballApi = initializeFireballApi();
      if (!fireballApi) {
        return null;
      }
      const recentDungeons = await fireballApi.getTodayDungeons(new Date().toISOString());
      
      const performance = {
        wins: 0,
        losses: 0,
        draws: 0,
        damageDealt: 0,
        damageTaken: 0
      };

      recentDungeons.forEach(dungeon => {
        if (dungeon.status === 'completed') {
          performance.wins++;
          performance.damageDealt += dungeon.totalDamageDealt || 0;
        } else if (dungeon.status === 'failed') {
          performance.losses++;
          performance.damageTaken += dungeon.totalDamageTaken || 0;
        }
      });

      return performance;
    } catch (error) {
      console.error('Failed to analyze player performance:', error);
      return null;
    }
  }

  // Make decision based on all available data
  async makeDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons = null, weaponCharges = null) {
    if (config.debug) {
      console.log(`Making decision for enemy ${enemyId}, turn ${turn}`);
    }

    // Get enemy analysis
    const enemyAnalysis = await this.analyzeEnemyPatterns(enemyId);
    
    // Default strategy if no data - but still consider charges
    if (!enemyAnalysis || enemyAnalysis.patterns.total < 10) {
      // Use equal weights but apply charge bonus
      let weights = { rock: 1, paper: 1, scissor: 1 };
      
      // Apply charge-based adjustments even for random strategy
      if (weaponCharges) {
        const maxCharges = Math.max(weaponCharges.rock || 0, weaponCharges.paper || 0, weaponCharges.scissor || 0);
        if (maxCharges > 0) {
          // Add 10-20% weight bonus for weapons with more charges
          if (weaponCharges.rock > 0) {
            weights.rock *= (1 + 0.1 * (weaponCharges.rock / maxCharges));
          }
          if (weaponCharges.paper > 0) {
            weights.paper *= (1 + 0.1 * (weaponCharges.paper / maxCharges));
          }
          if (weaponCharges.scissor > 0) {
            weights.scissor *= (1 + 0.1 * (weaponCharges.scissor / maxCharges));
          }
        }
      }
      
      return this.getWeightedRandomAction(weights, availableWeapons);
    }

    // Check turn-specific patterns
    if (enemyAnalysis.turnPatterns[turn]) {
      const turnPattern = enemyAnalysis.turnPatterns[turn];
      const mostLikely = Object.entries(turnPattern)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      // Counter the most likely action for this turn
      const counter = actionWins[mostLikely];
      
      if (config.debug) {
        console.log(`Turn ${turn} pattern suggests enemy will play ${mostLikely}, countering with ${counter}`);
      }
      
      // Add some randomness to avoid being predictable
      if (Math.random() > 0.8) {
        return this.getRandomAction(availableWeapons);
      }
      
      // Check if counter weapon is available
      if (availableWeapons && !availableWeapons.includes(counter)) {
        return this.getRandomAction(availableWeapons);
      }
      
      return counter;
    }

    // Use overall probabilities
    const weights = {
      rock: enemyAnalysis.probabilities.scissor,    // Rock beats scissor
      paper: enemyAnalysis.probabilities.rock,       // Paper beats rock
      scissor: enemyAnalysis.probabilities.paper     // Scissor beats paper
    };

    // Add health-based adjustments
    const healthRatio = playerHealth / (playerHealth + enemyHealth);
    if (healthRatio < 0.3) {
      // Low health - play more defensively (paper)
      weights.paper *= 1.5;
    } else if (healthRatio > 0.7) {
      // High health - play more aggressively (rock/scissor)
      weights.rock *= 1.2;
      weights.scissor *= 1.2;
    }

    // Add charge-based adjustments - slight preference for weapons with more charges
    if (weaponCharges) {
      const maxCharges = Math.max(weaponCharges.rock || 0, weaponCharges.paper || 0, weaponCharges.scissor || 0);
      if (maxCharges > 0) {
        // Add 5-15% weight bonus based on relative charge amount
        if (weaponCharges.rock > 0) {
          weights.rock *= (1 + 0.05 * (weaponCharges.rock / maxCharges));
        }
        if (weaponCharges.paper > 0) {
          weights.paper *= (1 + 0.05 * (weaponCharges.paper / maxCharges));
        }
        if (weaponCharges.scissor > 0) {
          weights.scissor *= (1 + 0.05 * (weaponCharges.scissor / maxCharges));
        }
      }
    }

    // Log decision factors if debug enabled
    if (config.debug) {
      console.log('Decision weights:', weights);
      if (weaponCharges) {
        console.log('Weapon charges:', weaponCharges);
      }
    }

    // Choose action based on weights
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
  recordTurn(enemyId, turn, playerAction, enemyAction, result) {
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
  }

  // Get statistics summary
  getStatsSummary() {
    const summary = {
      enemiesAnalyzed: this.enemyPatterns.size,
      turnsRecorded: this.turnHistory.length,
      recentWinRate: 0
    };

    if (this.turnHistory.length > 0) {
      const recentTurns = this.turnHistory.slice(-100);
      const wins = recentTurns.filter(turn => turn.result === 'win').length;
      summary.recentWinRate = wins / recentTurns.length;
    }

    return summary;
  }
}