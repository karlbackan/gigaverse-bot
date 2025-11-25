/**
 * Bayesian Opponent Modeling
 *
 * Maintains posterior distributions over opponent types and strategies.
 * Updates beliefs using Bayes' rule after each observation.
 */

export class BayesianOpponentModel {
  constructor() {
    // Opponent type priors (will be updated to posteriors)
    this.typePriors = {
      random: 0.2,        // Plays uniformly random
      biased: 0.2,        // Has preference for one move
      counter: 0.2,       // Counters our last move
      copier: 0.2,        // Copies our last move
      pattern: 0.2        // Follows sequential patterns
    };

    // Per-opponent models
    this.opponents = new Map();

    // Move relationships
    this.COUNTER = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    this.symbols = ['rock', 'paper', 'scissor'];

    console.log('🔬 [Bayesian] Opponent modeling initialized with 5 opponent types');
  }

  /**
   * Get or create opponent model
   */
  getOpponent(enemyId) {
    if (!this.opponents.has(enemyId)) {
      this.opponents.set(enemyId, {
        typePosterior: { ...this.typePriors },
        moveHistory: [],
        ourHistory: [],
        // Dirichlet parameters for move distribution (for biased type)
        moveDirichlet: { rock: 1, paper: 1, scissor: 1 },
        // Transition probabilities (for pattern type)
        transitions: new Map()
      });
    }
    return this.opponents.get(enemyId);
  }

  /**
   * Calculate likelihood of observing move given opponent type
   */
  likelihood(type, move, opponent, ourLastMove) {
    const epsilon = 0.01; // Smoothing factor

    switch (type) {
      case 'random':
        return 1/3;

      case 'biased': {
        // Use Dirichlet-Multinomial
        const total = opponent.moveDirichlet.rock + opponent.moveDirichlet.paper + opponent.moveDirichlet.scissor;
        return opponent.moveDirichlet[move] / total;
      }

      case 'counter': {
        if (!ourLastMove) return 1/3;
        const expectedMove = this.COUNTER[ourLastMove];
        return move === expectedMove ? 0.7 : 0.15;
      }

      case 'copier': {
        if (!ourLastMove) return 1/3;
        return move === ourLastMove ? 0.7 : 0.15;
      }

      case 'pattern': {
        if (opponent.moveHistory.length < 2) return 1/3;
        const lastMove = opponent.moveHistory[opponent.moveHistory.length - 1];
        const transKey = lastMove;

        if (!opponent.transitions.has(transKey)) return 1/3;

        const trans = opponent.transitions.get(transKey);
        const total = trans.rock + trans.paper + trans.scissor;
        if (total < 3) return 1/3;

        return (trans[move] + epsilon) / (total + 3 * epsilon);
      }

      default:
        return 1/3;
    }
  }

  /**
   * Update posterior after observing opponent move
   */
  update(enemyId, ourMove, theirMove) {
    if (!enemyId || !theirMove) {
      console.log('🔬 [Bayesian] Skipping update: missing enemyId or theirMove');
      return;
    }

    const opponent = this.getOpponent(enemyId);
    const ourLastMove = opponent.ourHistory.length > 0
      ? opponent.ourHistory[opponent.ourHistory.length - 1]
      : null;

    // Bayesian update of type posterior
    let totalLikelihood = 0;
    const newPosterior = {};

    for (const [type, prior] of Object.entries(opponent.typePosterior)) {
      const lik = this.likelihood(type, theirMove, opponent, ourLastMove);
      newPosterior[type] = prior * lik;
      totalLikelihood += newPosterior[type];
    }

    // Normalize (with safety check)
    if (totalLikelihood > 0) {
      for (const type in newPosterior) {
        opponent.typePosterior[type] = newPosterior[type] / totalLikelihood;
      }
    }

    // Update Dirichlet for biased model
    opponent.moveDirichlet[theirMove] += 1;

    // Update transitions for pattern model
    if (opponent.moveHistory.length > 0) {
      const lastMove = opponent.moveHistory[opponent.moveHistory.length - 1];
      if (!opponent.transitions.has(lastMove)) {
        opponent.transitions.set(lastMove, { rock: 0, paper: 0, scissor: 0 });
      }
      opponent.transitions.get(lastMove)[theirMove]++;
    }

    // Store history
    opponent.moveHistory.push(theirMove);
    opponent.ourHistory.push(ourMove);

    // Trim history to prevent memory growth
    if (opponent.moveHistory.length > 100) {
      opponent.moveHistory.shift();
      opponent.ourHistory.shift();
    }

    // Log dominant type for debugging
    const dominantType = this.getDominantType(enemyId);
    console.log(`🔬 [Bayesian] Updated ${enemyId.slice(-8)}: dominant=${dominantType.type} (${(dominantType.prob * 100).toFixed(0)}%)`);
  }

  /**
   * Predict opponent's next move distribution
   */
  predict(enemyId, ourLastMove = null) {
    const opponent = this.getOpponent(enemyId);
    const prediction = { rock: 0, paper: 0, scissor: 0 };

    // Weighted prediction across all types
    for (const [type, prob] of Object.entries(opponent.typePosterior)) {
      const typePrediction = this.predictByType(type, opponent, ourLastMove);
      for (const move of this.symbols) {
        prediction[move] += prob * typePrediction[move];
      }
    }

    return prediction;
  }

  /**
   * Predict move distribution assuming specific opponent type
   */
  predictByType(type, opponent, ourLastMove) {
    const prediction = { rock: 1/3, paper: 1/3, scissor: 1/3 };

    switch (type) {
      case 'random':
        return prediction;

      case 'biased': {
        const total = opponent.moveDirichlet.rock + opponent.moveDirichlet.paper + opponent.moveDirichlet.scissor;
        return {
          rock: opponent.moveDirichlet.rock / total,
          paper: opponent.moveDirichlet.paper / total,
          scissor: opponent.moveDirichlet.scissor / total
        };
      }

      case 'counter': {
        if (!ourLastMove) return prediction;
        const expected = this.COUNTER[ourLastMove];
        return {
          rock: expected === 'rock' ? 0.7 : 0.15,
          paper: expected === 'paper' ? 0.7 : 0.15,
          scissor: expected === 'scissor' ? 0.7 : 0.15
        };
      }

      case 'copier': {
        if (!ourLastMove) return prediction;
        return {
          rock: ourLastMove === 'rock' ? 0.7 : 0.15,
          paper: ourLastMove === 'paper' ? 0.7 : 0.15,
          scissor: ourLastMove === 'scissor' ? 0.7 : 0.15
        };
      }

      case 'pattern': {
        if (opponent.moveHistory.length < 1) return prediction;
        const lastMove = opponent.moveHistory[opponent.moveHistory.length - 1];

        if (!opponent.transitions.has(lastMove)) return prediction;

        const trans = opponent.transitions.get(lastMove);
        const total = trans.rock + trans.paper + trans.scissor;
        if (total < 3) return prediction;

        return {
          rock: (trans.rock + 1) / (total + 3),
          paper: (trans.paper + 1) / (total + 3),
          scissor: (trans.scissor + 1) / (total + 3)
        };
      }

      default:
        return prediction;
    }
  }

  /**
   * Get best move to counter predicted opponent
   */
  getBestMove(enemyId, ourLastMove, availableWeapons = ['rock', 'paper', 'scissor']) {
    if (!enemyId) {
      return {
        move: availableWeapons[Math.floor(Math.random() * availableWeapons.length)],
        confidence: 0.33,
        prediction: { rock: 0.33, paper: 0.33, scissor: 0.34 },
        dominantType: 'unknown',
        typePosterior: this.typePriors,
        reasoning: 'Bayesian: no enemy ID'
      };
    }

    const prediction = this.predict(enemyId, ourLastMove);

    // Calculate expected value for each of our moves
    const scores = {};
    for (const ourMove of availableWeapons) {
      scores[ourMove] = 0;
      for (const theirMove of this.symbols) {
        if (this.COUNTER[theirMove] === ourMove) {
          scores[ourMove] += prediction[theirMove];  // We win
        } else if (this.COUNTER[ourMove] === theirMove) {
          scores[ourMove] -= prediction[theirMove];  // We lose
        }
        // Ties contribute 0
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

    // Get dominant type for reasoning
    const dominant = this.getDominantType(enemyId);

    // Calculate confidence based on how much the best move stands out
    const scoreValues = Object.values(scores);
    const maxScore = Math.max(...scoreValues);
    const minScore = Math.min(...scoreValues);
    const confidence = Math.min(0.9, Math.max(0.3, (maxScore - minScore) / 2 + 0.4));

    return {
      move: bestMove,
      confidence: confidence,
      prediction: prediction,
      dominantType: dominant.type,
      typePosterior: this.getOpponent(enemyId).typePosterior,
      reasoning: `Bayesian: ${dominant.type} (${(dominant.prob * 100).toFixed(0)}%)`
    };
  }

  /**
   * Get dominant opponent type
   */
  getDominantType(enemyId) {
    const opponent = this.getOpponent(enemyId);
    let dominantType = 'random';
    let maxProb = 0;

    for (const [type, prob] of Object.entries(opponent.typePosterior)) {
      if (prob > maxProb) {
        maxProb = prob;
        dominantType = type;
      }
    }

    return { type: dominantType, prob: maxProb };
  }

  /**
   * Get stats for debugging
   */
  getStats(enemyId) {
    if (!enemyId) {
      return {
        totalOpponents: this.opponents.size,
        typePriors: this.typePriors
      };
    }

    const opponent = this.getOpponent(enemyId);
    return {
      typePosterior: opponent.typePosterior,
      moveDirichlet: opponent.moveDirichlet,
      historyLength: opponent.moveHistory.length,
      dominantType: this.getDominantType(enemyId)
    };
  }

  /**
   * Get overall Bayesian model statistics
   */
  getOverallStats() {
    const stats = {
      totalOpponents: this.opponents.size,
      opponentSummary: []
    };

    for (const [enemyId, opponent] of this.opponents.entries()) {
      const dominant = this.getDominantType(enemyId);
      stats.opponentSummary.push({
        enemyId: enemyId.slice(-8),
        dominantType: dominant.type,
        confidence: dominant.prob,
        observations: opponent.moveHistory.length
      });
    }

    return stats;
  }
}

export default BayesianOpponentModel;
