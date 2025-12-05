/**
 * Global N-gram Predictor
 *
 * Tracks n-gram patterns across ALL opponents (universal patterns).
 * Experiments show global 2-gram achieves 2.50% net advantage vs CTW's 1.93%.
 *
 * Key findings from experiments:
 * - 2-gram is optimal depth (balance of pattern strength and coverage)
 * - Global outperforms per-opponent (patterns are universal)
 * - Needs minimum 5 observations before predicting
 * - 20/80 CTW/2-gram ensemble gives best results (2.70% net)
 */

const MOVES = ['rock', 'paper', 'scissor'];

export class GlobalNgramPredictor {
  constructor(depth = 2, minObservations = 5) {
    this.depth = depth;
    this.minObservations = minObservations;

    // Global n-gram counts (shared across all opponents)
    this.nGrams = new Map();

    // Per-opponent history tracking (just for context window)
    this.opponentHistory = new Map();

    // Initialize all possible n-grams for depth
    this.initializeNGrams();

    // Stats for debugging
    this.stats = {
      predictions: 0,
      updates: 0
    };
  }

  initializeNGrams() {
    // Generate all possible n-gram keys
    const generateKeys = (depth, prefix = []) => {
      if (depth === 0) {
        const key = prefix.join(',');
        this.nGrams.set(key, { rock: 0, paper: 0, scissor: 0 });
        return;
      }
      for (const move of MOVES) {
        generateKeys(depth - 1, [...prefix, move]);
      }
    };
    generateKeys(this.depth);
  }

  /**
   * Get prediction probabilities for the next move
   * @param {string} enemyId - The opponent ID
   * @returns {Object|null} Probabilities { rock, paper, scissor } or null if insufficient history
   */
  predict(enemyId) {
    const history = this.opponentHistory.get(enemyId);
    if (!history || history.length < this.depth) {
      return null;
    }

    // Get the n-gram key from recent history
    const key = history.slice(-this.depth).join(',');
    const counts = this.nGrams.get(key);

    if (!counts) return null;

    const total = counts.rock + counts.paper + counts.scissor;
    if (total < this.minObservations) {
      return null;  // Not enough data for this pattern
    }

    this.stats.predictions++;

    return {
      rock: counts.rock / total,
      paper: counts.paper / total,
      scissor: counts.scissor / total
    };
  }

  /**
   * Get the most likely next move
   * @param {string} enemyId - The opponent ID
   * @returns {string|null} The predicted move or null if insufficient data
   */
  predictMove(enemyId) {
    const probs = this.predict(enemyId);
    if (!probs) return null;

    let best = null;
    let bestProb = -1;
    for (const [move, prob] of Object.entries(probs)) {
      if (prob > bestProb) {
        bestProb = prob;
        best = move;
      }
    }
    return best;
  }

  /**
   * Update the model with a new enemy move
   * @param {string} enemyId - The opponent ID
   * @param {string} enemyMove - The move the enemy played
   */
  update(enemyId, enemyMove) {
    if (!MOVES.includes(enemyMove)) return;

    // Ensure history exists for this opponent
    if (!this.opponentHistory.has(enemyId)) {
      this.opponentHistory.set(enemyId, []);
    }

    const history = this.opponentHistory.get(enemyId);

    // Update n-gram counts (if we have enough context)
    if (history.length >= this.depth) {
      const key = history.slice(-this.depth).join(',');
      const counts = this.nGrams.get(key);
      if (counts) {
        counts[enemyMove]++;
        this.stats.updates++;
      }
    }

    // Add move to history
    history.push(enemyMove);

    // Keep history bounded (only need last depth moves)
    if (history.length > this.depth + 10) {
      history.splice(0, history.length - this.depth - 5);
    }
  }

  /**
   * Reset history for an opponent (e.g., new battle session)
   * Note: Does NOT reset global n-gram counts (those persist)
   */
  resetOpponent(enemyId) {
    this.opponentHistory.delete(enemyId);
  }

  /**
   * Get statistics about the model
   */
  getStats() {
    let totalObservations = 0;
    let patternsWithData = 0;

    for (const [key, counts] of this.nGrams) {
      const total = counts.rock + counts.paper + counts.scissor;
      totalObservations += total;
      if (total >= this.minObservations) patternsWithData++;
    }

    return {
      depth: this.depth,
      minObservations: this.minObservations,
      totalPatterns: this.nGrams.size,
      patternsWithData,
      totalObservations,
      predictions: this.stats.predictions,
      updates: this.stats.updates,
      opponents: this.opponentHistory.size
    };
  }

  /**
   * Serialize for persistence
   */
  serialize() {
    const nGramsObj = {};
    for (const [key, counts] of this.nGrams) {
      nGramsObj[key] = counts;
    }

    return {
      depth: this.depth,
      minObservations: this.minObservations,
      nGrams: nGramsObj,
      stats: this.stats
    };
  }

  /**
   * Deserialize from saved state
   */
  static deserialize(data) {
    const predictor = new GlobalNgramPredictor(data.depth, data.minObservations);

    // Restore n-gram counts
    for (const [key, counts] of Object.entries(data.nGrams)) {
      predictor.nGrams.set(key, { ...counts });
    }

    // Restore stats
    if (data.stats) {
      predictor.stats = { ...data.stats };
    }

    return predictor;
  }
}
