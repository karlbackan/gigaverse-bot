/**
 * Machine Learning Decision Engine for Rock-Paper-Scissors
 * Implements multiple ML approaches: Multi-Armed Bandits, Q-Learning, Neural Networks, Opponent Modeling
 */

import { config } from './config.mjs';

export class MLDecisionEngine {
  constructor() {
    // Strategy types for multi-armed bandit
    this.strategies = {
      STATISTICAL: 'statistical',
      ANTI_PATTERN: 'anti_pattern', 
      RANDOM: 'random',
      Q_LEARNING: 'q_learning',
      NEURAL: 'neural',
      META_GAME: 'meta_game'
    };
    
    // Multi-Armed Bandit for strategy selection
    this.bandit = {
      arms: new Map(), // strategy -> {plays, rewards, value, confidence}
      epsilon: 0.1,    // exploration rate
      decayRate: 0.995 // epsilon decay
    };
    
    // Initialize bandit arms
    Object.values(this.strategies).forEach(strategy => {
      this.bandit.arms.set(strategy, {
        plays: 0,
        rewards: 0,
        value: 0.5, // neutral starting value
        confidence: 0
      });
    });
    
    // Q-Learning components
    this.qLearning = {
      states: new Map(),     // gameState -> Map(action -> qValue)
      alpha: 0.1,           // learning rate
      gamma: 0.9,           // discount factor
      epsilon: 0.1,         // exploration rate
      lastState: null,
      lastAction: null,
      lastReward: null
    };
    
    // Simple Neural Network (2-layer feedforward)
    this.neuralNet = {
      inputSize: 15,        // feature vector size
      hiddenSize: 20,       // hidden layer neurons
      outputSize: 3,        // rock, paper, scissor probabilities
      
      // Weights (initialized randomly)
      weightsIH: this.initializeMatrix(15, 20),  // input to hidden
      weightsHO: this.initializeMatrix(20, 3),   // hidden to output
      biasH: new Array(20).fill(0).map(() => Math.random() * 0.1),
      biasO: new Array(3).fill(0).map(() => Math.random() * 0.1),
      
      // Learning parameters
      learningRate: 0.01,
      momentum: 0.9,
      
      // Momentum terms
      momentumIH: this.initializeMatrix(15, 20),
      momentumHO: this.initializeMatrix(20, 3),
      momentumBH: new Array(20).fill(0),
      momentumBO: new Array(3).fill(0)
    };
    
    // Opponent modeling
    this.opponentModels = new Map(); // enemyId -> model
    
    // Meta-learning: track which strategies work vs which opponent types
    this.metaLearning = {
      opponentTypes: new Map(),     // enemyId -> type classification
      strategyEffectiveness: new Map(), // opponentType -> strategy -> effectiveness
      typeClassifier: {
        features: ['aggression', 'adaptability', 'predictability', 'counterRate'],
        weights: new Array(4).fill(0.25) // equal weight initially
      }
    };
    
    // Battle history for learning
    this.battleHistory = [];
    this.maxHistorySize = 1000;
    
    console.log('🤖 ML Decision Engine initialized with hybrid approaches');
  }
  
  // Initialize weight matrix with small random values
  initializeMatrix(rows, cols) {
    return Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => (Math.random() - 0.5) * 0.5)
    );
  }
  
  // Main ML decision method
  async makeMLDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons, weaponCharges, playerStats, enemyStats, gameHistory) {
    // Create rich feature vector for ML models
    const features = this.extractFeatures(enemyId, turn, playerHealth, enemyHealth, playerStats, enemyStats, gameHistory);
    
    // Ensure opponent model exists
    this.ensureOpponentModel(enemyId);
    
    // Multi-Armed Bandit: select which strategy to use
    const selectedStrategy = this.selectStrategy(enemyId);
    
    let decision;
    let confidence = 0.5;
    
    switch (selectedStrategy) {
      case this.strategies.Q_LEARNING:
        decision = this.qLearningDecision(features, availableWeapons);
        confidence = this.getQLearningConfidence(features);
        break;
        
      case this.strategies.NEURAL:
        const neuralOutput = this.neuralNetworkDecision(features);
        decision = this.selectFromProbabilities(neuralOutput.probabilities, availableWeapons);
        confidence = neuralOutput.confidence;
        break;
        
      case this.strategies.ANTI_PATTERN:
        decision = this.antiPatternDecision(enemyId, availableWeapons);
        confidence = 0.7;
        break;
        
      case this.strategies.META_GAME:
        decision = this.metaGameDecision(enemyId, availableWeapons);
        confidence = 0.6;
        break;
        
      case this.strategies.RANDOM:
        decision = this.randomDecision(availableWeapons);
        confidence = 0.3;
        break;
        
      default:
        // Fallback to statistical (handled by main decision engine)
        return null;
    }
    
    // Store decision for learning
    this.storeDecisionContext(enemyId, selectedStrategy, features, decision, turn);
    
    if (!config.minimalOutput) {
      console.log(`🤖 ML Strategy: ${selectedStrategy}, Decision: ${decision}, Confidence: ${confidence.toFixed(2)}`);
    } else {
      console.log(`ML:${selectedStrategy.charAt(0).toUpperCase()} ${decision} ${(confidence*100).toFixed(0)}%`);
    }
    
    return {
      action: decision,
      confidence: confidence,
      strategy: selectedStrategy,
      mlGenerated: true
    };
  }
  
  // Multi-Armed Bandit strategy selection using UCB1
  selectStrategy(enemyId) {
    const totalPlays = Array.from(this.bandit.arms.values()).reduce((sum, arm) => sum + arm.plays, 0);
    
    if (totalPlays < Object.keys(this.strategies).length) {
      // Explore each strategy at least once
      for (const [strategy, arm] of this.bandit.arms.entries()) {
        if (arm.plays === 0) return strategy;
      }
    }
    
    // UCB1 selection
    let bestStrategy = null;
    let bestScore = -Infinity;
    
    for (const [strategy, arm] of this.bandit.arms.entries()) {
      if (arm.plays === 0) continue;
      
      // UCB1 formula: value + confidence_interval
      const exploitation = arm.value;
      const exploration = Math.sqrt((2 * Math.log(totalPlays)) / arm.plays);
      const ucbScore = exploitation + exploration;
      
      if (ucbScore > bestScore) {
        bestScore = ucbScore;
        bestStrategy = strategy;
      }
    }
    
    // Epsilon-greedy fallback
    if (Math.random() < this.bandit.epsilon) {
      const strategies = Object.values(this.strategies);
      bestStrategy = strategies[Math.floor(Math.random() * strategies.length)];
    }
    
    return bestStrategy || this.strategies.RANDOM;
  }
  
  // Q-Learning decision
  qLearningDecision(features, availableWeapons) {
    const stateKey = this.featuresToStateKey(features);
    
    if (!this.qLearning.states.has(stateKey)) {
      // Initialize new state
      const actionValues = new Map();
      ['rock', 'paper', 'scissor'].forEach(action => {
        actionValues.set(action, Math.random() * 0.1); // small random initialization
      });
      this.qLearning.states.set(stateKey, actionValues);
    }
    
    const actionValues = this.qLearning.states.get(stateKey);
    
    // Epsilon-greedy action selection
    if (Math.random() < this.qLearning.epsilon) {
      // Explore: random action from available
      const available = availableWeapons || ['rock', 'paper', 'scissor'];
      return available[Math.floor(Math.random() * available.length)];
    } else {
      // Exploit: best action from available
      let bestAction = 'rock';
      let bestValue = -Infinity;
      
      const available = availableWeapons || ['rock', 'paper', 'scissor'];
      for (const action of available) {
        const value = actionValues.get(action) || 0;
        if (value > bestValue) {
          bestValue = value;
          bestAction = action;
        }
      }
      
      return bestAction;
    }
  }
  
  // Neural network forward pass
  neuralNetworkDecision(features) {
    // Ensure features array is correct size
    const input = features.slice(0, this.neuralNet.inputSize);
    while (input.length < this.neuralNet.inputSize) {
      input.push(0);
    }
    
    // Forward pass
    const hidden = this.matrixMultiply([input], this.neuralNet.weightsIH)[0]
      .map((val, i) => this.sigmoid(val + this.neuralNet.biasH[i]));
    
    const output = this.matrixMultiply([hidden], this.neuralNet.weightsHO)[0]
      .map((val, i) => this.sigmoid(val + this.neuralNet.biasO[i]));
    
    // Normalize to probabilities
    const sum = output.reduce((a, b) => a + b, 0);
    const probabilities = {
      rock: output[0] / sum,
      paper: output[1] / sum, 
      scissor: output[2] / sum
    };
    
    // Calculate confidence based on probability distribution
    const maxProb = Math.max(...output) / sum;
    const confidence = (maxProb - 0.33) / 0.67; // normalize from random (0.33) to certain (1.0)
    
    return {
      probabilities,
      confidence: Math.max(0, confidence)
    };
  }
  
  // Anti-pattern strategy: counter opponent's patterns
  antiPatternDecision(enemyId, availableWeapons) {
    const model = this.opponentModels.get(enemyId);
    if (!model || model.moves.length < 3) {
      // Not enough data, random choice
      const available = availableWeapons || ['rock', 'paper', 'scissor'];
      return available[Math.floor(Math.random() * available.length)];
    }
    
    // Find most common recent pattern
    const recentMoves = model.moves.slice(-5);
    const moveCounts = { rock: 0, paper: 0, scissor: 0 };
    recentMoves.forEach(move => moveCounts[move]++);
    
    // Find opponent's preferred move
    let preferredMove = 'rock';
    let maxCount = 0;
    for (const [move, count] of Object.entries(moveCounts)) {
      if (count > maxCount) {
        maxCount = count;
        preferredMove = move;
      }
    }
    
    // Counter their preferred move
    const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    const counterMove = counters[preferredMove];
    
    // Return counter if available, otherwise random
    const available = availableWeapons || ['rock', 'paper', 'scissor'];
    return available.includes(counterMove) ? counterMove : available[Math.floor(Math.random() * available.length)];
  }
  
  // Meta-game strategy: use learned opponent type knowledge
  metaGameDecision(enemyId, availableWeapons) {
    const opponentType = this.classifyOpponent(enemyId);
    const effectiveness = this.metaLearning.strategyEffectiveness.get(opponentType);
    
    if (!effectiveness) {
      // Unknown opponent type, random choice
      const available = availableWeapons || ['rock', 'paper', 'scissor'];
      return available[Math.floor(Math.random() * available.length)];
    }
    
    // Use weighted random based on what works against this opponent type
    const weights = { rock: 0.33, paper: 0.33, scissor: 0.34 };
    
    // Adjust weights based on effectiveness
    if (effectiveness.rock > 0.5) weights.rock *= 1.5;
    if (effectiveness.paper > 0.5) weights.paper *= 1.5;
    if (effectiveness.scissor > 0.5) weights.scissor *= 1.5;
    
    return this.weightedRandomChoice(weights, availableWeapons);
  }
  
  // Random decision with weapon availability
  randomDecision(availableWeapons) {
    const available = availableWeapons || ['rock', 'paper', 'scissor'];
    return available[Math.floor(Math.random() * available.length)];
  }
  
  // Learn from battle outcome
  learnFromOutcome(enemyId, playerAction, enemyAction, result, strategy, features, turn) {
    // Update multi-armed bandit
    this.updateBandit(strategy, result);
    
    // Update Q-Learning
    this.updateQLearning(features, playerAction, result);
    
    // Update Neural Network
    this.updateNeuralNetwork(features, enemyAction, result);
    
    // Update opponent model
    this.updateOpponentModel(enemyId, enemyAction, result, turn);
    
    // Update meta-learning
    this.updateMetaLearning(enemyId, strategy, result);
    
    // Store in battle history
    this.battleHistory.push({
      enemyId, playerAction, enemyAction, result, strategy, features, turn,
      timestamp: Date.now()
    });
    
    // Trim history
    if (this.battleHistory.length > this.maxHistorySize) {
      this.battleHistory.shift();
    }
    
    // Decay exploration rates
    this.bandit.epsilon *= this.bandit.decayRate;
    this.qLearning.epsilon *= 0.999;
  }
  
  // Update multi-armed bandit with result
  updateBandit(strategy, result) {
    const arm = this.bandit.arms.get(strategy);
    if (!arm) return;
    
    arm.plays++;
    const reward = result === 'win' ? 1 : result === 'tie' ? 0.1 : 0;
    arm.rewards += reward;
    arm.value = arm.rewards / arm.plays;
    arm.confidence = Math.sqrt(arm.plays / 10); // increase confidence with more plays
  }
  
  // Update Q-Learning with TD learning
  updateQLearning(features, action, result) {
    const stateKey = this.featuresToStateKey(features);
    
    if (this.qLearning.lastState && this.qLearning.lastAction) {
      const reward = result === 'win' ? 1 : result === 'tie' ? 0 : -0.5;
      
      const lastStateValues = this.qLearning.states.get(this.qLearning.lastState);
      const currentStateValues = this.qLearning.states.get(stateKey) || new Map();
      
      if (lastStateValues) {
        const currentQ = lastStateValues.get(this.qLearning.lastAction) || 0;
        const maxNextQ = Math.max(...Array.from(currentStateValues.values()));
        const newQ = currentQ + this.qLearning.alpha * (reward + this.qLearning.gamma * maxNextQ - currentQ);
        
        lastStateValues.set(this.qLearning.lastAction, newQ);
      }
    }
    
    this.qLearning.lastState = stateKey;
    this.qLearning.lastAction = action;
    this.qLearning.lastReward = result;
  }
  
  // Update neural network with backpropagation
  updateNeuralNetwork(features, enemyAction, result) {
    // Create target vector (what enemy actually did)
    const target = [0, 0, 0];
    const actionIndex = { rock: 0, paper: 1, scissor: 2 }[enemyAction];
    target[actionIndex] = 1;
    
    // Forward pass
    const input = features.slice(0, this.neuralNet.inputSize);
    while (input.length < this.neuralNet.inputSize) input.push(0);
    
    const hidden = this.matrixMultiply([input], this.neuralNet.weightsIH)[0]
      .map((val, i) => this.sigmoid(val + this.neuralNet.biasH[i]));
    
    const output = this.matrixMultiply([hidden], this.neuralNet.weightsHO)[0]
      .map((val, i) => this.sigmoid(val + this.neuralNet.biasO[i]));
    
    // Backpropagation (simplified)
    const outputError = target.map((t, i) => (t - output[i]) * output[i] * (1 - output[i]));
    
    // Update output layer
    for (let i = 0; i < this.neuralNet.hiddenSize; i++) {
      for (let j = 0; j < this.neuralNet.outputSize; j++) {
        const delta = this.neuralNet.learningRate * outputError[j] * hidden[i];
        this.neuralNet.momentumHO[i][j] = this.neuralNet.momentum * this.neuralNet.momentumHO[i][j] + delta;
        this.neuralNet.weightsHO[i][j] += this.neuralNet.momentumHO[i][j];
      }
    }
  }
  
  // Update opponent model
  updateOpponentModel(enemyId, enemyAction, result, turn) {
    const model = this.opponentModels.get(enemyId);
    
    model.moves.push(enemyAction);
    model.results.push(result);
    model.totalBattles++;
    
    if (result === 'win') model.losses++; // enemy lost
    else if (result === 'loss') model.wins++; // enemy won
    else model.ties++;
    
    // Keep reasonable history size
    if (model.moves.length > 50) model.moves.shift();
    if (model.results.length > 50) model.results.shift();
    
    // Update adaptation rate
    model.adaptationRate = this.calculateAdaptationRate(model);
  }
  
  // Update meta-learning about opponent types and strategy effectiveness
  updateMetaLearning(enemyId, strategy, result) {
    const opponentType = this.classifyOpponent(enemyId);
    
    if (!this.metaLearning.strategyEffectiveness.has(opponentType)) {
      this.metaLearning.strategyEffectiveness.set(opponentType, {
        rock: 0.33, paper: 0.33, scissor: 0.33
      });
    }
    
    // This is simplified - in reality we'd track strategy effectiveness more sophisticatedly
    const effectiveness = this.metaLearning.strategyEffectiveness.get(opponentType);
    const reward = result === 'win' ? 1 : result === 'tie' ? 0.1 : 0;
    
    // Update effectiveness with exponential moving average
    const alpha = 0.1;
    if (strategy === this.strategies.ANTI_PATTERN) {
      effectiveness.rock = (1 - alpha) * effectiveness.rock + alpha * reward;
      effectiveness.paper = (1 - alpha) * effectiveness.paper + alpha * reward;
      effectiveness.scissor = (1 - alpha) * effectiveness.scissor + alpha * reward;
    }
  }
  
  // Utility methods
  
  extractFeatures(enemyId, turn, playerHealth, enemyHealth, playerStats, enemyStats, gameHistory) {
    const model = this.opponentModels.get(enemyId);
    
    return [
      turn / 100,                           // normalized turn
      playerHealth / 100,                   // normalized player health
      enemyHealth / 100,                    // normalized enemy health
      model ? model.totalBattles / 100 : 0, // battle count
      model ? model.wins / Math.max(1, model.totalBattles) : 0.5, // enemy win rate
      model ? model.adaptationRate : 0.5,  // adaptation rate
      model && model.moves.length > 0 ? (model.moves.filter(m => m === 'rock').length / model.moves.length) : 0.33,
      model && model.moves.length > 0 ? (model.moves.filter(m => m === 'paper').length / model.moves.length) : 0.33,
      model && model.moves.length > 0 ? (model.moves.filter(m => m === 'scissor').length / model.moves.length) : 0.33,
      this.calculateRecentPattern(model),   // recent pattern strength
      this.calculateVolatility(model),     // move volatility
      playerStats?.shield || 0 / 100,      // normalized shield
      turn % 10 / 10,                      // turn cycle (0-9 normalized)
      Math.sin(turn / 10),                 // cyclic feature 1
      Math.cos(turn / 10)                  // cyclic feature 2
    ];
  }
  
  ensureOpponentModel(enemyId) {
    if (!this.opponentModels.has(enemyId)) {
      this.opponentModels.set(enemyId, {
        moves: [],
        results: [],
        totalBattles: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        adaptationRate: 0.5,
        lastSeen: Date.now()
      });
    }
  }
  
  calculateAdaptationRate(model) {
    if (model.results.length < 10) return 0.5;
    
    // Calculate how often results change (high = adaptive opponent)
    let changes = 0;
    for (let i = 1; i < model.results.length; i++) {
      if (model.results[i] !== model.results[i-1]) changes++;
    }
    
    return changes / (model.results.length - 1);
  }
  
  calculateRecentPattern(model) {
    if (!model || model.moves.length < 5) return 0;
    
    const recent = model.moves.slice(-5);
    const unique = new Set(recent).size;
    return 1 - (unique / 3); // higher = more patterned
  }
  
  calculateVolatility(model) {
    if (!model || model.moves.length < 3) return 0.5;
    
    const moves = model.moves.slice(-10);
    const transitions = moves.slice(1).map((move, i) => move !== moves[i] ? 1 : 0);
    return transitions.reduce((a, b) => a + b, 0) / transitions.length;
  }
  
  featuresToStateKey(features) {
    // Discretize continuous features for Q-learning states
    return features.map(f => Math.round(f * 10) / 10).join(',');
  }
  
  classifyOpponent(enemyId) {
    const model = this.opponentModels.get(enemyId);
    if (!model || model.totalBattles < 10) return 'unknown';
    
    // Simple opponent type classification
    const aggression = model.wins / model.totalBattles;
    const adaptability = model.adaptationRate;
    const predictability = 1 - this.calculateVolatility(model);
    
    if (aggression > 0.6 && adaptability > 0.6) return 'aggressive_adaptive';
    if (aggression > 0.6 && predictability > 0.6) return 'aggressive_predictable';
    if (adaptability > 0.6) return 'adaptive';
    if (predictability > 0.6) return 'predictable';
    return 'balanced';
  }
  
  selectFromProbabilities(probabilities, availableWeapons) {
    const available = availableWeapons || ['rock', 'paper', 'scissor'];
    
    // Filter probabilities to only available weapons
    const filtered = {};
    let sum = 0;
    for (const weapon of available) {
      filtered[weapon] = probabilities[weapon] || 0;
      sum += filtered[weapon];
    }
    
    // Normalize
    if (sum > 0) {
      for (const weapon of available) {
        filtered[weapon] /= sum;
      }
    } else {
      // Equal probabilities if sum is 0
      for (const weapon of available) {
        filtered[weapon] = 1 / available.length;
      }
    }
    
    // Select based on probabilities
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [weapon, prob] of Object.entries(filtered)) {
      cumulative += prob;
      if (rand <= cumulative) {
        return weapon;
      }
    }
    
    return available[0]; // fallback
  }
  
  weightedRandomChoice(weights, availableWeapons) {
    const available = availableWeapons || ['rock', 'paper', 'scissor'];
    
    // Filter to available weights
    const filtered = {};
    let sum = 0;
    for (const weapon of available) {
      filtered[weapon] = weights[weapon] || 1;
      sum += filtered[weapon];
    }
    
    // Weighted selection
    const rand = Math.random() * sum;
    let cumulative = 0;
    
    for (const [weapon, weight] of Object.entries(filtered)) {
      cumulative += weight;
      if (rand <= cumulative) {
        return weapon;
      }
    }
    
    return available[0]; // fallback
  }
  
  getQLearningConfidence(features) {
    const stateKey = this.featuresToStateKey(features);
    const actionValues = this.qLearning.states.get(stateKey);
    
    if (!actionValues) return 0.3;
    
    const values = Array.from(actionValues.values());
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    // Confidence based on Q-value spread
    return Math.min(0.9, (max - min) / 2 + 0.3);
  }
  
  storeDecisionContext(enemyId, strategy, features, decision, turn) {
    // Store context for learning after outcome is known
    this.lastDecisionContext = {
      enemyId, strategy, features, decision, turn, timestamp: Date.now()
    };
  }
  
  // Mathematical utility functions
  sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }
  
  matrixMultiply(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < b.length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }
  
  // Get ML statistics for reporting
  getMLStats() {
    return {
      strategies: Object.fromEntries(this.bandit.arms),
      totalOpponents: this.opponentModels.size,
      totalBattles: this.battleHistory.length,
      qStates: this.qLearning.states.size,
      banditEpsilon: this.bandit.epsilon,
      qLearningEpsilon: this.qLearning.epsilon
    };
  }
}

export default MLDecisionEngine;