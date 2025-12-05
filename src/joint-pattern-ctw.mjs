/**
 * Joint Pattern CTW - tracks (player, enemy) move pairs
 *
 * Key insight: Enemy behavior often depends on OUR moves
 * - If we play rock and they play paper, that's pattern (R,P)
 * - Next time we play rock, they likely play paper again
 *
 * This captures reactive opponents that standard CTW misses
 */

export class JointPatternCTW {
  // 9 possible joint outcomes (static)
  static SYMBOLS = [
    'RR', 'RP', 'RS',  // we play rock
    'PR', 'PP', 'PS',  // we play paper
    'SR', 'SP', 'SS'   // we play scissor
  ];

  constructor(maxDepth = 4) {  // Lower depth for pairs (9 symbols instead of 3)
    this.maxDepth = maxDepth;
    this.symbols = JointPatternCTW.SYMBOLS;
    this.root = this.createNode();
    this.history = [];  // Array of joint symbols like 'RP', 'PS'
    this.decay = 0.98;
  }

  createNode() {
    return {
      counts: Object.fromEntries(JointPatternCTW.SYMBOLS.map(s => [s, 0])),
      children: {},
      totalCount: 0
    };
  }

  /**
   * Get joint symbol from moves
   */
  toSymbol(playerMove, enemyMove) {
    const p = playerMove.charAt(0).toUpperCase();
    const e = enemyMove.charAt(0).toUpperCase();
    return p + e;
  }

  /**
   * Apply decay to counts for recency bias
   */
  applyDecay() {
    const decayNode = (node) => {
      for (const symbol of this.symbols) {
        node.counts[symbol] *= this.decay;
      }
      node.totalCount *= this.decay;
      for (const child of Object.values(node.children)) {
        decayNode(child);
      }
    };
    decayNode(this.root);
  }

  /**
   * Update with observed moves
   */
  update(playerMove, enemyMove) {
    const symbol = this.toSymbol(playerMove, enemyMove);
    const context = this.history.slice(-this.maxDepth).reverse();

    let node = this.root;
    node.counts[symbol]++;
    node.totalCount++;

    for (const ctx of context) {
      if (!node.children[ctx]) {
        node.children[ctx] = this.createNode();
      }
      node = node.children[ctx];
      node.counts[symbol]++;
      node.totalCount++;
    }

    this.history.push(symbol);

    // Apply decay every 10 rounds
    if (this.history.length % 10 === 0) {
      this.applyDecay();
    }

    if (this.history.length > this.maxDepth * 10) {
      this.history.shift();
    }
  }

  /**
   * Predict enemy response to our planned move
   * @param {string} ourPlannedMove - What we're planning to play
   * @returns {object} - Probability distribution over enemy moves
   */
  predictEnemyResponse(ourPlannedMove) {
    const context = this.history.slice(-this.maxDepth).reverse();

    // Find deepest matching context
    let node = this.root;
    for (const ctx of context) {
      if (node.children[ctx]) {
        node = node.children[ctx];
      } else {
        break;
      }
    }

    // Extract probabilities for enemy moves given our planned move
    const ourPrefix = ourPlannedMove.charAt(0).toUpperCase();
    const relevantSymbols = this.symbols.filter(s => s.charAt(0) === ourPrefix);

    const probs = { rock: 0, paper: 0, scissor: 0 };
    let total = 0;

    for (const symbol of relevantSymbols) {
      const count = node.counts[symbol] + 0.5;  // KT smoothing
      const enemyMove = { R: 'rock', P: 'paper', S: 'scissor' }[symbol.charAt(1)];
      probs[enemyMove] = count;
      total += count;
    }

    // Normalize
    if (total > 0) {
      for (const move of Object.keys(probs)) {
        probs[move] /= total;
      }
    } else {
      probs.rock = probs.paper = probs.scissor = 1/3;
    }

    return probs;
  }

  /**
   * Get overall enemy move prediction (marginalizing over our moves)
   */
  predict() {
    if (this.history.length === 0) {
      return { rock: 1/3, paper: 1/3, scissor: 1/3 };
    }

    const context = this.history.slice(-this.maxDepth).reverse();

    // Find deepest matching context
    let node = this.root;
    for (const ctx of context) {
      if (node.children[ctx]) {
        node = node.children[ctx];
      } else {
        break;
      }
    }

    // Sum over all our moves to get marginal enemy distribution
    const probs = { rock: 0, paper: 0, scissor: 0 };
    let total = 0;

    for (const symbol of this.symbols) {
      const count = node.counts[symbol] + 0.5/9;  // KT smoothing
      const enemyMove = { R: 'rock', P: 'paper', S: 'scissor' }[symbol.charAt(1)];
      probs[enemyMove] += count;
      total += count;
    }

    // Normalize
    for (const move of Object.keys(probs)) {
      probs[move] /= total;
    }

    return probs;
  }

  /**
   * Get best move considering enemy's likely response
   */
  getBestMove(availableWeapons = ['rock', 'paper', 'scissor']) {
    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    let bestMove = availableWeapons[0];
    let bestScore = -Infinity;
    let bestEnemyProbs = null;

    for (const ourMove of availableWeapons) {
      const enemyProbs = this.predictEnemyResponse(ourMove);

      // Calculate expected value
      let score = 0;
      for (const [enemyMove, prob] of Object.entries(enemyProbs)) {
        if (counter[enemyMove] === ourMove) {
          score += prob;  // We win
        } else if (counter[ourMove] === enemyMove) {
          score -= prob;  // We lose
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = ourMove;
        bestEnemyProbs = enemyProbs;
      }
    }

    const confidence = Math.min(0.9, Math.abs(bestScore) + 0.3);
    return {
      move: bestMove,
      confidence,
      prediction: bestEnemyProbs,
      reasoning: `Joint CTW predicts response to ${bestMove}`
    };
  }

  /**
   * Serialize for persistence
   */
  serialize() {
    const serializeNode = (node) => ({
      counts: { ...node.counts },
      totalCount: node.totalCount,
      children: Object.fromEntries(
        Object.entries(node.children).map(([k, v]) => [k, serializeNode(v)])
      )
    });

    return {
      maxDepth: this.maxDepth,
      history: [...this.history],
      root: serializeNode(this.root)
    };
  }

  /**
   * Deserialize from persistence
   */
  deserialize(data) {
    if (!data) return;

    const deserializeNode = (nodeData) => {
      const node = {
        counts: { ...nodeData.counts },
        totalCount: nodeData.totalCount,
        children: {}
      };
      for (const [symbol, childData] of Object.entries(nodeData.children || {})) {
        node.children[symbol] = deserializeNode(childData);
      }
      return node;
    };

    this.maxDepth = data.maxDepth || 4;
    this.history = data.history || [];
    this.root = deserializeNode(data.root);
  }
}

export default JointPatternCTW;
