/**
 * Weighted Ensemble Voting
 *
 * Combines predictions from multiple strategies weighted by recent performance.
 * Instead of picking ONE strategy via the bandit, this combines predictions
 * from ALL strategies weighted by their recent success rates.
 */

export class WeightedEnsemble {
  constructor(windowSize = 20) {
    this.windowSize = windowSize;
    this.strategies = new Map();  // strategy -> { predictions: [], results: [], weight: 1.0 }
    this.alpha = 0.1;  // Learning rate for weight updates
    this.minWeight = 0.05;  // Minimum weight to prevent complete exclusion
  }

  /**
   * Register a strategy
   */
  registerStrategy(name) {
    if (!this.strategies.has(name)) {
      this.strategies.set(name, {
        predictions: [],
        results: [],
        weight: 1.0
      });
      console.log(`[Ensemble] Registered strategy: ${name}`);
    }
  }

  /**
   * Record a prediction from a strategy
   * @param {string} strategyName - Name of the strategy
   * @param {string} prediction - The move prediction (rock/paper/scissor)
   */
  recordPrediction(strategyName, prediction) {
    if (!prediction) return;

    this.registerStrategy(strategyName);
    const strategy = this.strategies.get(strategyName);
    strategy.predictions.push(prediction);

    // Trim to window size * 2 to keep some history
    if (strategy.predictions.length > this.windowSize * 2) {
      strategy.predictions.shift();
    }
  }

  /**
   * Update weights after seeing actual opponent move
   * @param {string} actualMove - The actual move the opponent made
   */
  updateWeights(actualMove) {
    if (!actualMove) return;

    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    const counterTo = { rock: 'scissor', paper: 'rock', scissor: 'paper' };
    const winningMove = counter[actualMove];
    const losingMove = counterTo[actualMove];

    for (const [name, strategy] of this.strategies) {
      if (strategy.predictions.length === 0) continue;

      const lastPrediction = strategy.predictions[strategy.predictions.length - 1];

      // Determine if prediction would have won/lost/tied
      let result;
      if (lastPrediction === winningMove) {
        result = 1;  // Would have won
      } else if (lastPrediction === losingMove) {
        result = -1;  // Would have lost
      } else {
        result = 0;  // Would have tied
      }

      strategy.results.push(result);

      // Trim results to window size
      if (strategy.results.length > this.windowSize) {
        strategy.results.shift();
      }

      // Update weight based on recent performance
      const recentResults = strategy.results.slice(-this.windowSize);
      if (recentResults.length >= 5) {
        const avgResult = recentResults.reduce((a, b) => a + b, 0) / recentResults.length;
        // Weight adjustment: good performance -> higher weight
        // avgResult ranges from -1 to 1, so targetWeight ranges from minWeight to 1.5
        const targetWeight = Math.max(this.minWeight, 0.5 + avgResult);
        strategy.weight = strategy.weight * (1 - this.alpha) + targetWeight * this.alpha;
      }
    }

    console.log(`[Ensemble] Weights updated: ${this.getWeightsSummary()}`);
  }

  /**
   * Get a summary of current weights for logging
   */
  getWeightsSummary() {
    const weights = [];
    for (const [name, strategy] of this.strategies) {
      weights.push(`${name}:${strategy.weight.toFixed(2)}`);
    }
    return weights.join(' ');
  }

  /**
   * Get combined prediction using weighted voting
   * @param {Map<string, {rock: number, paper: number, scissor: number}>} predictions - Strategy predictions
   * @returns {{rock: number, paper: number, scissor: number}} Combined probability distribution
   */
  getCombinedPrediction(predictions) {
    const combined = { rock: 0, paper: 0, scissor: 0 };
    let totalWeight = 0;

    for (const [name, pred] of predictions) {
      this.registerStrategy(name);
      const strategy = this.strategies.get(name);
      const weight = strategy.weight;

      combined.rock += weight * (pred.rock || 0);
      combined.paper += weight * (pred.paper || 0);
      combined.scissor += weight * (pred.scissor || 0);
      totalWeight += weight;
    }

    // Normalize
    if (totalWeight > 0) {
      combined.rock /= totalWeight;
      combined.paper /= totalWeight;
      combined.scissor /= totalWeight;
    } else {
      combined.rock = combined.paper = combined.scissor = 1/3;
    }

    return combined;
  }

  /**
   * Get best move from combined prediction
   * @param {Map<string, {rock: number, paper: number, scissor: number}>} predictions - Strategy predictions
   * @param {string[]} availableWeapons - Available weapons to choose from
   * @returns {{move: string, confidence: number, combinedPrediction: object, weights: object, reasoning: string}}
   */
  getBestMove(predictions, availableWeapons = ['rock', 'paper', 'scissor']) {
    const combined = this.getCombinedPrediction(predictions);
    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

    // Calculate expected value for each of our moves
    // Positive score = expected to win, negative = expected to lose
    const scores = {};
    for (const move of availableWeapons) {
      scores[move] = 0;

      for (const theirMove of ['rock', 'paper', 'scissor']) {
        const prob = combined[theirMove];

        if (counter[theirMove] === move) {
          // Our move beats their move -> we win
          scores[move] += prob;
        } else if (counter[move] === theirMove) {
          // Their move beats our move -> we lose
          scores[move] -= prob;
        }
        // Tie: no change to score
      }
    }

    // Find best move
    let bestMove = availableWeapons[0];
    let bestScore = scores[bestMove];
    for (const move of availableWeapons) {
      if (scores[move] > bestScore) {
        bestScore = scores[move];
        bestMove = move;
      }
    }

    // Calculate confidence from score spread
    // Score ranges from -1 to +1, so confidence is how far from 0
    const confidence = Math.min(0.95, Math.max(0.3, Math.abs(bestScore) + 0.3));

    // Build weights object for stats
    const weights = {};
    for (const [name, strategy] of this.strategies) {
      weights[name] = strategy.weight;
    }

    // Get top contributors
    const sortedStrategies = Array.from(this.strategies.entries())
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 3)
      .map(([name, s]) => `${name}(${s.weight.toFixed(2)})`)
      .join(', ');

    return {
      move: bestMove,
      confidence: confidence,
      combinedPrediction: combined,
      weights: weights,
      scores: scores,
      reasoning: `Weighted ensemble: top strategies ${sortedStrategies}`
    };
  }

  /**
   * Get stats for debugging and reporting
   */
  getStats() {
    const stats = {};
    for (const [name, strategy] of this.strategies) {
      const recent = strategy.results.slice(-this.windowSize);
      const wins = recent.filter(r => r > 0).length;
      const losses = recent.filter(r => r < 0).length;
      const ties = recent.filter(r => r === 0).length;

      stats[name] = {
        weight: strategy.weight,
        recentWinRate: recent.length > 0 ? wins / recent.length : 0,
        recentLossRate: recent.length > 0 ? losses / recent.length : 0,
        recentTieRate: recent.length > 0 ? ties / recent.length : 0,
        totalPredictions: strategy.predictions.length,
        recentResults: recent.length
      };
    }
    return stats;
  }

  /**
   * Reset all strategies (for new opponent or testing)
   */
  reset() {
    for (const strategy of this.strategies.values()) {
      strategy.predictions = [];
      strategy.results = [];
      strategy.weight = 1.0;
    }
    console.log('[Ensemble] Reset all strategy weights to 1.0');
  }

  /**
   * Save state for persistence
   */
  toJSON() {
    const data = {};
    for (const [name, strategy] of this.strategies) {
      data[name] = {
        predictions: strategy.predictions.slice(-this.windowSize),
        results: strategy.results.slice(-this.windowSize),
        weight: strategy.weight
      };
    }
    return data;
  }

  /**
   * Load state from persistence
   */
  fromJSON(data) {
    if (!data) return;

    for (const [name, savedStrategy] of Object.entries(data)) {
      this.strategies.set(name, {
        predictions: savedStrategy.predictions || [],
        results: savedStrategy.results || [],
        weight: savedStrategy.weight || 1.0
      });
    }
    console.log(`[Ensemble] Loaded ${Object.keys(data).length} strategy states`);
  }
}

export default WeightedEnsemble;
