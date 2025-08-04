import { StatisticsEngine } from './statistics-engine.mjs';
import { config } from './config.mjs';

/**
 * Robust Decision Engine with improvements to prevent overfitting
 * Implements epsilon-greedy exploration, recency weighting, and confidence scaling
 */
export class RobustDecisionEngine {
  constructor() {
    this.statisticsEngine = new StatisticsEngine();
    this.decisions = [];
    this.recentResults = []; // Track last 20 results
    this.noobId = null;
    
    // Tunable parameters (conservative defaults)
    this.params = {
      explorationRate: 0.1,        // 10% random exploration
      minBattlesForConfidence: 20, // Need 20 battles for full confidence
      recencyDecay: 0.1,          // Recent battles weighted more
      lossStreakThreshold: 0.35,  // Trigger fallback if win rate < 35%
      recentWindowSize: 20         // Look at last 20 battles
    };
  }

  setNoobId(noobId) {
    this.noobId = noobId;
  }

  async makeDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons, weaponCharges, playerStats, enemyStats) {
    // 1. Epsilon-greedy exploration
    if (Math.random() < this.params.explorationRate) {
      const randomChoice = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
      if (!config.minimalOutput) {
        console.log('🎲 Exploration move (10% chance)');
      }
      return randomChoice;
    }

    // 2. Check if we're in a losing streak
    const recentWinRate = this.getRecentWinRate(enemyId);
    if (recentWinRate !== null && recentWinRate < this.params.lossStreakThreshold) {
      return this.getDefensiveFallback(enemyId, availableWeapons);
    }

    // 3. Get statistical prediction with confidence scaling
    const prediction = this.statisticsEngine.predictNextMove(
      enemyId, 
      turn, 
      playerStats, 
      enemyStats,
      playerStats?.weapons,
      this.noobId
    );
    
    if (!prediction) {
      return this.getBalancedFallback(availableWeapons);
    }

    // 4. Scale confidence based on sample size
    const enemyData = this.statisticsEngine.enemyStats.get(enemyId);
    const battleCount = enemyData ? enemyData.totalBattles : 0;
    const sampleConfidence = Math.min(1, battleCount / this.params.minBattlesForConfidence);
    const adjustedConfidence = prediction.confidence * sampleConfidence;

    // 5. Early game confidence penalty
    const turnConfidence = Math.min(1, turn / 10);
    const finalConfidence = adjustedConfidence * turnConfidence;

    if (config.minimalOutput && finalConfidence > 0.5) {
      const probs = prediction.predictions;
      console.log(`Conf:${(finalConfidence * 100).toFixed(0)}% R${(probs.rock * 100).toFixed(0)}/P${(probs.paper * 100).toFixed(0)}/S${(probs.scissor * 100).toFixed(0)} [${battleCount} battles]`);
    }

    // 6. Make decision based on adjusted confidence
    if (finalConfidence < 0.5) {
      return this.getBalancedFallback(availableWeapons);
    }

    // 7. Use mixed strategy instead of pure counter
    return this.getMixedStrategy(prediction, availableWeapons, finalConfidence);
  }

  getMixedStrategy(prediction, availableWeapons, confidence) {
    const probs = prediction.predictions;
    
    // Calculate counters with mixing
    const strategies = {
      rock: probs.scissor - probs.paper,     // Good vs scissor
      paper: probs.rock - probs.scissor,     // Good vs rock
      scissor: probs.paper - probs.rock      // Good vs paper
    };

    // Mix with uniform distribution based on confidence
    const mixWeight = 1 - confidence;
    Object.keys(strategies).forEach(move => {
      strategies[move] = strategies[move] * confidence + (1/3) * mixWeight;
    });

    // Filter available and normalize
    let total = 0;
    const available = {};
    availableWeapons.forEach(weapon => {
      if (strategies[weapon] !== undefined) {
        available[weapon] = Math.max(0, strategies[weapon]);
        total += available[weapon];
      }
    });

    // Weighted random selection
    const rand = Math.random() * total;
    let sum = 0;
    for (const [move, weight] of Object.entries(available)) {
      sum += weight;
      if (rand <= sum) return move;
    }

    return availableWeapons[0];
  }

  getDefensiveFallback(enemyId, availableWeapons) {
    if (!config.minimalOutput) {
      console.log('🛡️ Defensive fallback (losing streak detected)');
    }

    // Play counter to enemy's favorite move
    const enemyData = this.statisticsEngine.enemyStats.get(enemyId);
    if (enemyData) {
      const moves = enemyData.moves;
      const favorite = Object.entries(moves).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' }[favorite];
      
      if (availableWeapons.includes(counter)) {
        return counter;
      }
    }

    return this.getBalancedFallback(availableWeapons);
  }

  getBalancedFallback(availableWeapons) {
    // Equal probability with slight charge preference
    const weights = {};
    availableWeapons.forEach(weapon => {
      weights[weapon] = 1;
    });

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    const rand = Math.random() * total;
    let sum = 0;

    for (const [weapon, weight] of Object.entries(weights)) {
      sum += weight;
      if (rand <= sum) return weapon;
    }

    return availableWeapons[0];
  }

  recordTurn(enemyId, turn, playerAction, enemyAction, result, playerStats, enemyStats, weaponStats) {
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
      noobId: this.noobId,
      timestamp: Date.now()
    });

    // Track recent results
    this.recentResults.push({ enemyId, result, turn });
    if (this.recentResults.length > 100) {
      this.recentResults.shift();
    }

    // Record decision
    this.decisions.push({
      enemyId,
      turn,
      decision: playerAction,
      result,
      timestamp: Date.now()
    });
  }

  getRecentWinRate(enemyId) {
    const recent = this.recentResults
      .filter(r => r.enemyId === enemyId)
      .slice(-this.params.recentWindowSize);

    if (recent.length < 5) return null; // Not enough data

    const wins = recent.filter(r => r.result === 'win').length;
    return wins / recent.length;
  }

  exportStatistics() {
    this.statisticsEngine.exportStatistics();
  }

  getAnalysisSummary() {
    const enemies = Array.from(this.statisticsEngine.enemyStats.keys());
    const summary = {
      totalEnemies: enemies.length,
      robustDecisions: this.decisions.filter(d => d.reasoning?.includes('exploration')).length,
      explorationRate: this.params.explorationRate,
      averageConfidence: 0
    };

    // Calculate average confidence
    let totalConf = 0;
    let confCount = 0;
    enemies.forEach(enemyId => {
      const data = this.statisticsEngine.enemyStats.get(enemyId);
      if (data && data.totalBattles > 0) {
        const conf = Math.min(1, data.totalBattles / this.params.minBattlesForConfidence);
        totalConf += conf;
        confCount++;
      }
    });

    summary.averageConfidence = confCount > 0 ? totalConf / confCount : 0;
    return summary;
  }
}