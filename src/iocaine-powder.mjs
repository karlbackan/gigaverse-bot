/**
 * Iocaine Powder Meta-Strategy
 * Winner of the First International RoShamBo Programming Competition (1999)
 *
 * Expands any base prediction into 6 meta-strategies and tracks which performs best.
 *
 * The 6 meta-levels for any predictor P:
 *   P.0 (Naive): Counter predicted opponent move
 *   P.1 (Second-guess): Opponent knows P.0, counter their counter
 *   P.2 (Triple-guess): Opponent knows P.1, go one level deeper
 *   P'.0 (Mirror): Opponent uses P on us, counter what they'd play
 *   P'.1 (Second-guess P'): One level deeper on mirror
 *   P'.2 (Triple-guess P'): Two levels deeper on mirror
 */

export class IocainePowder {
  constructor() {
    // Base predictors
    this.predictors = {
      frequency: this.frequencyPredictor.bind(this),
      history: this.historyMatchPredictor.bind(this),
      markov: this.markovPredictor.bind(this),
      random: this.randomPredictor.bind(this)
    };

    // Track performance of each predictor x 6 meta-strategies = 24 total strategies
    this.strategies = new Map();
    for (const predictor of Object.keys(this.predictors)) {
      for (let meta = 0; meta < 6; meta++) {
        const key = `${predictor}.${meta}`;
        this.strategies.set(key, { score: 0, lastPrediction: null });
      }
    }

    // Per-enemy history tracking
    this.enemyData = new Map();  // enemyId -> { ourHistory, theirHistory }
    this.maxHistory = 100;

    console.log('🧪 [Iocaine] Initialized with 24 meta-strategies (4 predictors x 6 levels)');
  }

  // Move relationships
  static COUNTER = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
  static COUNTERED_BY = { rock: 'scissor', paper: 'rock', scissor: 'paper' };

  /**
   * Ensure enemy data exists
   */
  ensureEnemyData(enemyId) {
    if (!this.enemyData.has(enemyId)) {
      this.enemyData.set(enemyId, {
        ourHistory: [],
        theirHistory: [],
        strategies: new Map()
      });
      // Initialize per-enemy strategy scores
      const data = this.enemyData.get(enemyId);
      for (const predictor of Object.keys(this.predictors)) {
        for (let meta = 0; meta < 6; meta++) {
          const key = `${predictor}.${meta}`;
          data.strategies.set(key, { score: 0, lastPrediction: null });
        }
      }
    }
    return this.enemyData.get(enemyId);
  }

  /**
   * Get the best move using Iocaine Powder strategy
   */
  getMove(enemyId, availableWeapons = ['rock', 'paper', 'scissor']) {
    const data = this.ensureEnemyData(enemyId);

    // Generate predictions from all 24 strategies
    const predictions = this.generateAllPredictions(data.ourHistory, data.theirHistory);

    // Find best performing strategy for this enemy
    let bestStrategy = null;
    let bestScore = -Infinity;

    for (const [key, stratData] of data.strategies) {
      if (stratData.score > bestScore) {
        bestScore = stratData.score;
        bestStrategy = key;
      }
    }

    // Get prediction from best strategy
    const prediction = predictions.get(bestStrategy);

    if (!prediction) {
      // No prediction available, random from available
      const move = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
      console.log(`🧪 [Iocaine] No prediction available, random: ${move}`);
      return { move, confidence: 0.3, strategy: 'random', reasoning: 'insufficient data' };
    }

    // Filter to available weapons
    if (!availableWeapons.includes(prediction)) {
      // Fallback to random from available
      const move = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
      console.log(`🧪 [Iocaine] Best move ${prediction} not available, using: ${move}`);
      return { move, confidence: 0.4, strategy: bestStrategy, reasoning: 'fallback - weapon unavailable' };
    }

    // Calculate confidence based on score differential
    const scores = Array.from(data.strategies.values()).map(s => s.score);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const confidence = Math.min(0.95, 0.5 + (maxScore - avgScore) / 20);

    console.log(`🧪 [Iocaine] Best strategy: ${bestStrategy} (score: ${bestScore}), move: ${prediction}, confidence: ${confidence.toFixed(2)}`);

    return {
      move: prediction,
      confidence,
      strategy: bestStrategy,
      reasoning: `meta-strategy ${bestStrategy} with score ${bestScore}`
    };
  }

  /**
   * Generate predictions from all predictor x meta combinations
   */
  generateAllPredictions(ourHistory, theirHistory) {
    const predictions = new Map();

    for (const [predictorName, predictorFn] of Object.entries(this.predictors)) {
      // Get base prediction of what THEY will play
      const theirPredicted = predictorFn(theirHistory, ourHistory);
      // Get base prediction of what WE will play (from their perspective)
      const ourPredicted = predictorFn(ourHistory, theirHistory);

      if (theirPredicted) {
        // P.0: Counter their predicted move
        const p0 = IocainePowder.COUNTER[theirPredicted];
        predictions.set(`${predictorName}.0`, p0);

        // P.1: They know P.0, they'll play counter to our counter, we counter that
        // If they know we'll play p0, they play counter(p0), we play counter(counter(p0))
        const p1 = IocainePowder.COUNTER[IocainePowder.COUNTER[p0]];
        predictions.set(`${predictorName}.1`, p1);

        // P.2: One more level deep
        const p2 = IocainePowder.COUNTER[IocainePowder.COUNTER[p1]];
        predictions.set(`${predictorName}.2`, p2);
      }

      if (ourPredicted) {
        // P'.0: They predict our move and counter it, we counter their counter
        const theirCounter = IocainePowder.COUNTER[ourPredicted];
        const p3 = IocainePowder.COUNTER[theirCounter];
        predictions.set(`${predictorName}.3`, p3);

        // P'.1: One level deeper
        const p4 = IocainePowder.COUNTER[IocainePowder.COUNTER[p3]];
        predictions.set(`${predictorName}.4`, p4);

        // P'.2: Two levels deeper
        const p5 = IocainePowder.COUNTER[IocainePowder.COUNTER[p4]];
        predictions.set(`${predictorName}.5`, p5);
      }
    }

    return predictions;
  }

  /**
   * Update after seeing the result
   */
  update(enemyId, ourMove, theirMove) {
    const data = this.ensureEnemyData(enemyId);

    // Store predictions before updating history (for retroactive scoring)
    const predictions = this.generateAllPredictions(data.ourHistory, data.theirHistory);

    // Update scores based on what would have happened
    for (const [key, prediction] of predictions) {
      const strategy = data.strategies.get(key);
      if (!strategy) continue;

      if (prediction === IocainePowder.COUNTER[theirMove]) {
        strategy.score += 1;  // Would have won
      } else if (prediction === IocainePowder.COUNTERED_BY[theirMove]) {
        strategy.score -= 1;  // Would have lost
      }
      // Tie: no change
      strategy.lastPrediction = prediction;
    }

    // Also update global strategy scores
    for (const [key, prediction] of predictions) {
      const globalStrategy = this.strategies.get(key);
      if (!globalStrategy) continue;

      if (prediction === IocainePowder.COUNTER[theirMove]) {
        globalStrategy.score += 1;
      } else if (prediction === IocainePowder.COUNTERED_BY[theirMove]) {
        globalStrategy.score -= 1;
      }
      globalStrategy.lastPrediction = prediction;
    }

    // Add to history
    data.ourHistory.push(ourMove);
    data.theirHistory.push(theirMove);

    // Trim history
    if (data.ourHistory.length > this.maxHistory) {
      data.ourHistory.shift();
      data.theirHistory.shift();
    }
  }

  // === BASE PREDICTORS ===

  /**
   * Frequency predictor: predict most common move
   */
  frequencyPredictor(history, opponentHistory) {
    if (!history || history.length < 3) return null;

    const counts = { rock: 0, paper: 0, scissor: 0 };
    for (const move of history) {
      if (counts[move] !== undefined) {
        counts[move]++;
      }
    }

    let best = 'rock';
    let bestCount = 0;
    for (const [move, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestCount = count;
        best = move;
      }
    }
    return best;
  }

  /**
   * History match predictor: find matching sequence and predict next
   */
  historyMatchPredictor(history, opponentHistory) {
    if (!history || history.length < 5) return null;

    // Look for matches of decreasing length
    for (let len = Math.min(10, history.length - 1); len >= 2; len--) {
      const recent = history.slice(-len);

      // Search for this pattern earlier in history
      for (let i = 0; i < history.length - len - 1; i++) {
        let match = true;
        for (let j = 0; j < len; j++) {
          if (history[i + j] !== recent[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          // Found match, return what came next
          return history[i + len];
        }
      }
    }
    return null;
  }

  /**
   * Markov predictor: transition probabilities based on last move
   */
  markovPredictor(history, opponentHistory) {
    if (!history || history.length < 5) return null;

    const lastMove = history[history.length - 1];
    const transitions = { rock: 0, paper: 0, scissor: 0 };
    let total = 0;

    for (let i = 0; i < history.length - 1; i++) {
      if (history[i] === lastMove) {
        const nextMove = history[i + 1];
        if (transitions[nextMove] !== undefined) {
          transitions[nextMove]++;
          total++;
        }
      }
    }

    if (total < 3) return null;

    let best = 'rock';
    let bestCount = 0;
    for (const [move, count] of Object.entries(transitions)) {
      if (count > bestCount) {
        bestCount = count;
        best = move;
      }
    }
    return best;
  }

  /**
   * Random predictor: uniform random (baseline)
   */
  randomPredictor(history, opponentHistory) {
    const moves = ['rock', 'paper', 'scissor'];
    return moves[Math.floor(Math.random() * 3)];
  }

  /**
   * Get stats for debugging
   */
  getStats(enemyId = null) {
    if (enemyId) {
      const data = this.enemyData.get(enemyId);
      if (!data) {
        return { topStrategies: [], historyLength: 0 };
      }

      const sorted = Array.from(data.strategies.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 5);

      return {
        topStrategies: sorted.map(([key, val]) => ({ strategy: key, score: val.score })),
        historyLength: data.ourHistory.length
      };
    }

    // Global stats
    const sorted = Array.from(this.strategies.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5);

    return {
      topStrategies: sorted.map(([key, val]) => ({ strategy: key, score: val.score })),
      totalEnemies: this.enemyData.size
    };
  }

  /**
   * Reset data for a specific enemy
   */
  resetEnemy(enemyId) {
    this.enemyData.delete(enemyId);
    console.log(`🧪 [Iocaine] Reset data for enemy: ${enemyId}`);
  }

  /**
   * Get move probabilities (for integration with other systems)
   */
  getMoveProbabilities(enemyId) {
    const data = this.ensureEnemyData(enemyId);
    const predictions = this.generateAllPredictions(data.ourHistory, data.theirHistory);

    // Weight predictions by strategy score
    const weights = { rock: 0, paper: 0, scissor: 0 };
    let totalWeight = 0;

    for (const [key, prediction] of predictions) {
      if (!prediction) continue;
      const strategy = data.strategies.get(key);
      const score = strategy ? Math.max(0, strategy.score + 10) : 1;  // Add 10 to avoid negative weights
      weights[prediction] += score;
      totalWeight += score;
    }

    // Normalize
    if (totalWeight > 0) {
      for (const move of Object.keys(weights)) {
        weights[move] /= totalWeight;
      }
    } else {
      weights.rock = 0.33;
      weights.paper = 0.33;
      weights.scissor = 0.34;
    }

    return weights;
  }
}

export default IocainePowder;
