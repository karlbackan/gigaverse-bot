// Threat-Based Survival Calculator
// Calculates actual damage threats to make intelligent survival decisions

export class ThreatCalculator {
  /**
   * Calculate potential damage from enemy's weapon
   * @param {number} enemyAttack - Enemy weapon's ATK stat
   * @param {number} playerDefense - Player weapon's DEF stat  
   * @param {number} playerShield - Current player shield
   * @returns {number} Net damage after defense and shield
   */
  static calculateDamage(enemyAttack, playerDefense, playerShield = 0) {
    // Basic damage formula (may need adjustment based on actual game mechanics)
    const rawDamage = Math.max(0, enemyAttack - playerDefense);
    
    // Shield absorbs damage first
    const damageAfterShield = Math.max(0, rawDamage - playerShield);
    
    return damageAfterShield;
  }

  /**
   * Assess threat level for each possible enemy move
   * @param {Object} playerStats - Player health, shield, weapon stats
   * @param {Object} enemyStats - Enemy weapon stats and charges
   * @returns {Object} Threat assessment for each enemy move
   */
  static assessThreats(playerStats, enemyStats) {
    const threats = {};
    const possibleMoves = [];
    
    // Check which moves enemy can make based on charges
    if (!enemyStats.charges || enemyStats.charges.rock >= 0) {
      possibleMoves.push('rock');
    }
    if (!enemyStats.charges || enemyStats.charges.paper >= 0) {
      possibleMoves.push('paper');
    }
    if (!enemyStats.charges || enemyStats.charges.scissor >= 0) {
      possibleMoves.push('scissor');
    }
    
    // Calculate threat for each possible enemy move
    for (const enemyMove of possibleMoves) {
      const enemyAttack = enemyStats.weapons[enemyMove].attack;
      
      // Calculate damage for each outcome
      const outcomes = {};
      
      // If we play rock
      outcomes.rock = {
        vs: enemyMove,
        result: this.getBattleResult('rock', enemyMove),
        damage: 0
      };
      
      if (outcomes.rock.result === 'loss') {
        outcomes.rock.damage = this.calculateDamage(
          enemyAttack,
          playerStats.weapons.rock.defense,
          playerStats.shield
        );
      }
      
      // If we play paper
      outcomes.paper = {
        vs: enemyMove,
        result: this.getBattleResult('paper', enemyMove),
        damage: 0
      };
      
      if (outcomes.paper.result === 'loss') {
        outcomes.paper.damage = this.calculateDamage(
          enemyAttack,
          playerStats.weapons.paper.defense,
          playerStats.shield
        );
      }
      
      // If we play scissor
      outcomes.scissor = {
        vs: enemyMove,
        result: this.getBattleResult('scissor', enemyMove),
        damage: 0
      };
      
      if (outcomes.scissor.result === 'loss') {
        outcomes.scissor.damage = this.calculateDamage(
          enemyAttack,
          playerStats.weapons.scissor.defense,
          playerStats.shield
        );
      }
      
      threats[enemyMove] = {
        attack: enemyAttack,
        outcomes: outcomes,
        maxDamage: Math.max(outcomes.rock.damage, outcomes.paper.damage, outcomes.scissor.damage),
        isLethal: Math.max(outcomes.rock.damage, outcomes.paper.damage, outcomes.scissor.damage) >= playerStats.health
      };
    }
    
    return {
      possibleMoves,
      threats,
      maxThreat: Math.max(...Object.values(threats).map(t => t.maxDamage)),
      hasLethalThreat: Object.values(threats).some(t => t.isLethal)
    };
  }

  /**
   * Calculate survival-focused weights based on threat assessment
   * @param {Object} prediction - ML prediction {rock: 0.3, paper: 0.4, scissor: 0.3}
   * @param {Object} threatAssessment - Output from assessThreats
   * @param {number} playerHealth - Current player health
   * @returns {Object} Dynamic weights for unified scoring
   */
  static calculateSurvivalWeights(prediction, threatAssessment, playerHealth) {
    const { threats, hasLethalThreat, maxThreat } = threatAssessment;
    
    // Calculate threat ratio (how dangerous is the situation)
    const threatRatio = maxThreat / playerHealth;
    
    // Base weights
    let weights = {
      win: 1.3,
      draw: 1.0,
      loss: 0
    };
    
    // CRITICAL THREAT: Enemy can one-shot us
    if (hasLethalThreat) {
      weights = {
        win: 1.5,  // Still prefer winning
        draw: 1.4, // But draws are almost as good (survival!)
        loss: -10  // Absolutely avoid death
      };
      console.log('⚠️ LETHAL THREAT DETECTED - Prioritizing survival!');
    }
    // HIGH THREAT: Enemy can do >50% of our health
    else if (threatRatio > 0.5) {
      weights = {
        win: 1.4,
        draw: 1.1,  // Draws more valuable when threatened
        loss: -2
      };
      console.log(`⚡ High threat (${(threatRatio * 100).toFixed(0)}% health) - Defensive stance`);
    }
    // MEDIUM THREAT: Enemy can do 25-50% of our health
    else if (threatRatio > 0.25) {
      weights = {
        win: 1.35,
        draw: 0.9,
        loss: -0.5
      };
    }
    // LOW THREAT: Enemy can do <25% of our health
    else {
      weights = {
        win: 1.5,   // Be aggressive when safe
        draw: 0.5,  // Draws less valuable
        loss: 0
      };
      if (threatRatio < 0.1) {
        console.log('💪 Low threat - Going aggressive!');
      }
    }
    
    // Additional adjustment based on armor regeneration potential
    // If we have low shield, draws become more valuable (armor regens on draw)
    if (threatAssessment.playerShieldPercent < 30) {
      weights.draw *= 1.2;
      console.log('🛡️ Low shield - Draws help regenerate armor');
    }
    
    return weights;
  }

  /**
   * Get detailed survival recommendation
   * @param {Object} playerStats - Full player stats
   * @param {Object} enemyStats - Full enemy stats
   * @param {Object} prediction - ML predictions
   * @returns {Object} Detailed recommendation with reasoning
   */
  static getRecommendation(playerStats, enemyStats, prediction) {
    const assessment = this.assessThreats(playerStats, enemyStats);
    const weights = this.calculateSurvivalWeights(prediction, assessment, playerStats.health);
    
    // Calculate best move considering threats
    const moves = ['rock', 'paper', 'scissor'];
    const scores = {};
    
    for (const ourMove of moves) {
      let expectedScore = 0;
      
      for (const enemyMove of assessment.possibleMoves) {
        const prob = prediction.predictions[enemyMove] || 0.33;
        const threat = assessment.threats[enemyMove];
        const outcome = threat.outcomes[ourMove];
        
        let moveScore = 0;
        if (outcome.result === 'win') {
          moveScore = weights.win;
        } else if (outcome.result === 'tie') {
          moveScore = weights.draw;
        } else {
          // Loss - consider actual damage
          if (outcome.damage >= playerStats.health) {
            moveScore = -100; // Death is worst outcome
          } else {
            moveScore = weights.loss * (1 + outcome.damage / playerStats.health);
          }
        }
        
        expectedScore += prob * moveScore;
      }
      
      scores[ourMove] = expectedScore;
    }
    
    // Find best move
    const bestMove = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    
    return {
      recommendation: bestMove,
      scores,
      weights,
      assessment,
      reasoning: this.generateReasoning(bestMove, scores, assessment, weights)
    };
  }

  /**
   * Generate human-readable reasoning
   */
  static generateReasoning(bestMove, scores, assessment, weights) {
    const reasons = [];
    
    if (assessment.hasLethalThreat) {
      reasons.push('Enemy can kill us in one hit - maximum caution!');
    } else if (assessment.maxThreat > 0) {
      reasons.push(`Enemy can deal up to ${assessment.maxThreat} damage`);
    }
    
    if (weights.draw > 1.0) {
      reasons.push('Draws valued higher due to threat level');
    } else if (weights.draw < 0.7) {
      reasons.push('Low threat - being aggressive');
    }
    
    reasons.push(`Best move: ${bestMove} (score: ${scores[bestMove].toFixed(2)})`);
    
    return reasons.join('. ');
  }

  /**
   * Helper: Get battle result
   */
  static getBattleResult(playerMove, enemyMove) {
    if (playerMove === enemyMove) return 'tie';
    
    const wins = {
      rock: 'scissor',
      paper: 'rock',
      scissor: 'paper'
    };
    
    return wins[playerMove] === enemyMove ? 'win' : 'loss';
  }
}

export default ThreatCalculator;