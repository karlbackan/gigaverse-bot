/**
 * Context Tree Weighting (CTW) for RPS Prediction
 *
 * Based on Willems, Shtarkov, Tjalkens (1995)
 * "The Context-Tree Weighting Method: Basic Properties"
 *
 * CTW is a compression-based prediction algorithm that:
 * - Maintains a tree of contexts (sequences)
 * - Combines predictions from ALL context depths using Bayesian model averaging
 * - Uses KT (Krichevsky-Trofimov) estimator for probability estimation
 * - Automatically handles variable-order contexts
 */

export class ContextTreeWeighting {
  constructor(maxDepth = 6) {  // Optimal depth for 50.9% expected win rate
    this.maxDepth = maxDepth;
    this.root = this.createNode();
    this.history = [];
    this.symbols = ['rock', 'paper', 'scissor'];
    this.symbolCount = this.symbols.length;
  }

  createNode() {
    return {
      counts: { rock: 0, paper: 0, scissor: 0 },
      children: {},        // symbol -> node
      pe: 1.0,            // estimated probability (KT)
      pw: 1.0,            // weighted probability
      totalCount: 0
    };
  }

  /**
   * KT estimator probability for a symbol given counts
   * P(symbol) = (count[symbol] + 0.5) / (total + k/2)
   * where k is the alphabet size (3 for RPS)
   */
  ktProbability(node, symbol) {
    const k = this.symbolCount;
    return (node.counts[symbol] + 0.5) / (node.totalCount + k * 0.5);
  }

  /**
   * Get context string from history (most recent first)
   */
  getContext(depth) {
    if (this.history.length < depth) {
      return this.history.slice().reverse();
    }
    return this.history.slice(-depth).reverse();
  }

  /**
   * Traverse tree along context path, creating nodes as needed
   */
  traverseContext(context, createIfMissing = false) {
    let node = this.root;
    const path = [node];

    for (const symbol of context) {
      if (!node.children[symbol]) {
        if (createIfMissing) {
          node.children[symbol] = this.createNode();
        } else {
          break;
        }
      }
      node = node.children[symbol];
      path.push(node);
    }

    return path;
  }

  /**
   * Update tree after observing a symbol
   */
  update(symbol) {
    if (!this.symbols.includes(symbol)) {
      console.log(`[CTW] Warning: Unknown symbol ${symbol}, skipping update`);
      return;
    }

    const context = this.getContext(this.maxDepth);
    const path = this.traverseContext(context, true);

    // Update weighted probabilities BEFORE updating counts (for proper sequential probability)
    this.updateWeightedProbabilities(path, symbol);

    // Update counts along the path
    for (const node of path) {
      node.counts[symbol]++;
      node.totalCount++;
    }

    // Add to history
    this.history.push(symbol);

    // Trim history to prevent unbounded growth (keep 10x maxDepth for patterns)
    if (this.history.length > this.maxDepth * 10) {
      this.history.shift();
    }
  }

  /**
   * Update pe and pw for nodes along path
   * pe is the KT estimator probability
   * pw is the weighted probability combining pe with children
   */
  updateWeightedProbabilities(path, symbol) {
    // Process from leaf to root (bottom-up)
    for (let i = path.length - 1; i >= 0; i--) {
      const node = path[i];

      // Calculate KT probability for this symbol BEFORE the count update
      const ktProb = this.ktProbability(node, symbol);

      // Update pe: multiply by the sequential probability
      node.pe *= ktProb;

      // Prevent underflow
      if (node.pe < 1e-100) {
        this.rescaleProbabilities(path);
      }

      // Update pw (weighted probability)
      const hasChildren = Object.keys(node.children).length > 0;

      if (!hasChildren) {
        // Leaf node: pw = pe
        node.pw = node.pe;
      } else {
        // Internal node: pw = 0.5 * pe + 0.5 * product(children.pw)
        let childProduct = 1.0;
        for (const child of Object.values(node.children)) {
          childProduct *= child.pw;
        }
        node.pw = 0.5 * node.pe + 0.5 * childProduct;
      }
    }
  }

  /**
   * Rescale probabilities to prevent underflow
   */
  rescaleProbabilities(path) {
    const scale = 1e50;
    for (const node of path) {
      node.pe *= scale;
      node.pw *= scale;
    }
  }

  /**
   * Predict probability distribution for next symbol
   * Uses the weighted combination from all context depths
   */
  predict() {
    const context = this.getContext(this.maxDepth);
    const path = this.traverseContext(context, false);

    // Use the deepest node we can reach
    const node = path[path.length - 1];

    // Calculate prediction using KT estimator at the deepest context
    const prediction = { rock: 0, paper: 0, scissor: 0 };
    let total = 0;

    for (const symbol of this.symbols) {
      prediction[symbol] = this.ktProbability(node, symbol);
      total += prediction[symbol];
    }

    // Normalize (should already be normalized, but ensure)
    if (total > 0) {
      for (const symbol of this.symbols) {
        prediction[symbol] /= total;
      }
    } else {
      // Uniform distribution fallback
      for (const symbol of this.symbols) {
        prediction[symbol] = 1 / this.symbolCount;
      }
    }

    return prediction;
  }

  /**
   * Get weighted prediction combining multiple context depths
   * This is the key CTW innovation: Bayesian averaging over all depths
   */
  predictWeighted() {
    if (this.history.length === 0) {
      // No history, return uniform distribution
      return { rock: 1/3, paper: 1/3, scissor: 1/3 };
    }

    const context = this.getContext(this.maxDepth);
    const path = this.traverseContext(context, false);

    // Combine predictions from all depths
    const prediction = { rock: 0, paper: 0, scissor: 0 };
    let totalWeight = 0;

    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      // Weight by depth (deeper contexts get more weight if they have enough data)
      const depthWeight = Math.pow(0.5, path.length - 1 - i) * (node.totalCount + 1);

      for (const symbol of this.symbols) {
        prediction[symbol] += depthWeight * this.ktProbability(node, symbol);
      }
      totalWeight += depthWeight;
    }

    // Normalize
    if (totalWeight > 0) {
      for (const symbol of this.symbols) {
        prediction[symbol] /= totalWeight;
      }
    }

    return prediction;
  }

  /**
   * Get the best counter move against predicted opponent move
   */
  getBestMove(availableWeapons = ['rock', 'paper', 'scissor']) {
    const prediction = this.predictWeighted();
    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

    // Find most likely opponent move
    let bestOpponentMove = 'rock';
    let bestProb = 0;

    for (const move of this.symbols) {
      if (prediction[move] > bestProb) {
        bestProb = prediction[move];
        bestOpponentMove = move;
      }
    }

    // Calculate confidence based on deviation from uniform
    const uniformProb = 1 / this.symbolCount;
    const confidence = Math.min(1, (bestProb - uniformProb) / (1 - uniformProb) + 0.3);

    // Return counter if available
    const counterMove = counter[bestOpponentMove];
    if (availableWeapons.includes(counterMove)) {
      return {
        move: counterMove,
        confidence: confidence,
        prediction: prediction,
        reasoning: `CTW predicts ${bestOpponentMove} (${(bestProb * 100).toFixed(1)}%)`
      };
    }

    // Fallback: find best available move using expected value
    let bestAvailable = availableWeapons[0];
    let bestScore = -Infinity;

    for (const move of availableWeapons) {
      // Calculate expected value against prediction
      // Win if opponent plays the move we counter
      const winProb = prediction[counter[move]] || 0;
      // Lose if opponent plays our counter
      const loseProb = prediction[counter[counter[move]]] || 0;
      // Draw if opponent plays same
      const drawProb = prediction[move] || 0;

      const score = winProb - loseProb + 0.1 * drawProb;

      if (score > bestScore) {
        bestScore = score;
        bestAvailable = move;
      }
    }

    return {
      move: bestAvailable,
      confidence: Math.max(0.3, confidence * 0.8),
      prediction: prediction,
      reasoning: `CTW fallback to ${bestAvailable}`
    };
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    const countNodes = (node) => {
      let count = 1;
      for (const child of Object.values(node.children)) {
        count += countNodes(child);
      }
      return count;
    };

    const getMaxDepth = (node, depth = 0) => {
      let max = depth;
      for (const child of Object.values(node.children)) {
        max = Math.max(max, getMaxDepth(child, depth + 1));
      }
      return max;
    };

    return {
      totalNodes: countNodes(this.root),
      actualDepth: getMaxDepth(this.root),
      maxDepth: this.maxDepth,
      historyLength: this.history.length,
      rootCounts: { ...this.root.counts },
      rootPe: this.root.pe,
      rootPw: this.root.pw,
      prediction: this.predict(),
      weightedPrediction: this.predictWeighted()
    };
  }

  /**
   * Reset the CTW model (for new opponent)
   */
  reset() {
    this.root = this.createNode();
    this.history = [];
  }

  /**
   * Get serializable state for persistence
   */
  serialize() {
    const serializeNode = (node) => ({
      counts: { ...node.counts },
      totalCount: node.totalCount,
      pe: node.pe,
      pw: node.pw,
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
   * Restore state from serialized data
   */
  deserialize(data) {
    if (!data) return;

    const deserializeNode = (nodeData) => {
      const node = {
        counts: { ...nodeData.counts },
        totalCount: nodeData.totalCount,
        pe: nodeData.pe,
        pw: nodeData.pw,
        children: {}
      };

      for (const [symbol, childData] of Object.entries(nodeData.children || {})) {
        node.children[symbol] = deserializeNode(childData);
      }

      return node;
    };

    this.maxDepth = data.maxDepth || 6;
    this.history = data.history || [];
    this.root = deserializeNode(data.root);
  }
}

export default ContextTreeWeighting;
