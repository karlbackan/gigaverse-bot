import { StatisticsEngineEnhanced } from './statistics-engine-enhanced.mjs';
import { config } from './config.mjs';

export class DecisionEngineEnhanced {
  constructor() {
    this.statisticsEngine = new StatisticsEngineEnhanced();
    this.decisions = [];
    this.noobId = null;
  }

  setNoobId(noobId) {
    this.noobId = noobId;
  }

  async makeDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons, weaponCharges, playerStats, enemyStats) {
    // Get prediction from enhanced statistics engine
    const prediction = this.statisticsEngine.predictNextMove(
      enemyId, 
      turn, 
      playerStats, 
      enemyStats,
      playerStats?.weapons,
      this.noobId
    );
    
    let decision;
    let reasoning = '';
    
    if (prediction && prediction.confidence > 0.6) {
      // We have a confident prediction
      const { weaponScores } = prediction;
      
      // Show prediction info in minimal mode
      if (config.minimalOutput && prediction.confidence > 0.7) {
        const probs = prediction.predictions;
        console.log(`Conf:${(prediction.confidence * 100).toFixed(0)}% R${(probs.rock * 100).toFixed(0)}/P${(probs.paper * 100).toFixed(0)}/S${(probs.scissor * 100).toFixed(0)}`);
        if (prediction.detectedPattern) {
          console.log(`Pattern: ${prediction.detectedPattern}`);
        }
      }
      
      // Pick the weapon with the highest score that we have charges for
      const weaponChoices = availableWeapons.map(weapon => ({
        weapon,
        score: weaponScores[weapon],
        charges: weaponCharges[weapon]
      })).sort((a, b) => b.score - a.score);
      
      decision = weaponChoices[0].weapon;
      reasoning = `Prediction-based (${(prediction.confidence * 100).toFixed(0)}% confidence)`;
      
      // Log pattern detection in verbose mode
      if (!config.minimalOutput && prediction.detectedPattern) {
        console.log(`Detected pattern: ${prediction.detectedPattern}`);
      }
    } else {
      // Fallback strategy when no confident prediction
      // Prioritize weapons with more charges
      const chargedWeapons = availableWeapons.map(w => ({
        weapon: w,
        charges: weaponCharges[w]
      })).sort((a, b) => b.charges - a.charges);
      
      // If enemy is low health, prefer high attack weapons
      if (enemyHealth < 30 && playerStats?.weapons) {
        const attackWeapons = availableWeapons.map(w => ({
          weapon: w,
          attack: playerStats.weapons[w].attack
        })).sort((a, b) => b.attack - a.attack);
        
        decision = attackWeapons[0].weapon;
        reasoning = 'Low enemy health - max attack';
      } else {
        // Default to weapon with most charges
        decision = chargedWeapons[0].weapon;
        reasoning = 'Most charges available';
      }
    }
    
    // Record the decision
    this.decisions.push({
      enemyId,
      turn,
      decision,
      reasoning,
      prediction: prediction ? {
        confidence: prediction.confidence,
        predictions: prediction.predictions,
        pattern: prediction.detectedPattern
      } : null,
      timestamp: Date.now()
    });
    
    return decision;
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
  }

  getStatsSummary() {
    const totalTurns = this.decisions.length;
    const recentDecisions = this.decisions.slice(-50); // Last 50 turns
    
    // Calculate recent win rate
    let recentWins = 0;
    let recentLosses = 0;
    let recentDraws = 0;
    
    // We need to look at the statistics engine data for results
    const battles = this.statisticsEngine.sessionData.battles;
    const recentBattles = battles.slice(-50);
    
    recentBattles.forEach(battle => {
      if (battle.result === 'win') recentWins++;
      else if (battle.result === 'lose') recentLosses++;
      else recentDraws++;
    });
    
    const totalRecent = recentWins + recentLosses + recentDraws;
    const recentWinRate = totalRecent > 0 ? recentWins / totalRecent : 0;
    
    // Get current enemy analysis
    let currentEnemyReport = null;
    if (this.decisions.length > 0) {
      const lastDecision = this.decisions[this.decisions.length - 1];
      currentEnemyReport = this.statisticsEngine.getAnalysisReport(lastDecision.enemyId);
    }
    
    return {
      turnsRecorded: totalTurns,
      recentWinRate,
      enemiesAnalyzed: this.statisticsEngine.enemyStats.size,
      statisticsReport: currentEnemyReport,
      enhancedPatterns: this.getEnhancedPatternSummary()
    };
  }

  getEnhancedPatternSummary() {
    const summary = {
      totalEnemies: this.statisticsEngine.enemyStats.size,
      patternsDetected: 0,
      longestPattern: 0,
      cyclesDetected: 0
    };
    
    for (const [enemyId, enemy] of this.statisticsEngine.enemyStats.entries()) {
      if (enemy.detectedPatterns) {
        if (enemy.detectedPatterns.cycleLength) {
          summary.cyclesDetected++;
        }
        
        if (enemy.detectedPatterns.sequencePatterns && enemy.detectedPatterns.sequencePatterns.length > 0) {
          summary.patternsDetected++;
          const longest = Math.max(...enemy.detectedPatterns.sequencePatterns.map(p => p.length));
          if (longest > summary.longestPattern) {
            summary.longestPattern = longest;
          }
        }
      }
    }
    
    return summary;
  }

  exportStatistics() {
    this.statisticsEngine.exportStatistics();
  }
}