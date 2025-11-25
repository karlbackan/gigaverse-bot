/**
 * Machine Learning Decision Engine for Rock-Paper-Scissors
 * Implements multiple ML approaches: Multi-Armed Bandits, Q-Learning, Neural Networks, Opponent Modeling
 */

import { config } from './config.mjs';
import { IocainePowder } from './iocaine-powder.mjs';
import { ContextTreeWeighting } from './context-tree-weighting.mjs';
import { BayesianOpponentModel } from './bayesian-opponent-model.mjs';
import { WeightedEnsemble } from './weighted-ensemble.mjs';
import { SimpleRNN } from './simple-rnn.mjs';

export class MLDecisionEngine {
  constructor() {
    // Strategy types for multi-armed bandit
    this.strategies = {
      STATISTICAL: 'statistical',
      ANTI_PATTERN: 'anti_pattern',
      RANDOM: 'random',
      Q_LEARNING: 'q_learning',
      NEURAL: 'neural',
      META_GAME: 'meta_game',
      IOCAINE: 'iocaine',  // Iocaine Powder meta-strategy (1999 RoShamBo champion)
      CTW: 'ctw',  // Context Tree Weighting - compression-based prediction
      BAYESIAN: 'bayesian',  // Bayesian opponent modeling with type inference
      ENSEMBLE: 'ensemble',  // Weighted ensemble combining CTW, Bayesian, Iocaine, Neural
      CHARGE_BASED: 'charge_based'  // Exploits +5.4% correlation between enemy charges and move choice
    };
    
    // Multi-Armed Bandit for strategy selection (Thompson Sampling)
    this.bandit = {
      arms: new Map(), // strategy -> {plays, wins, losses, value, confidence}
      decayRate: 0.995 // decay rate for old observations
    };

    // Initialize bandit arms for Thompson Sampling (Beta distribution parameters)
    Object.values(this.strategies).forEach(strategy => {
      this.bandit.arms.set(strategy, {
        plays: 0,
        wins: 0,      // successes (alpha - 1 in Beta distribution)
        losses: 0,    // failures (beta - 1 in Beta distribution)
        value: 0.5,   // running average for display
        confidence: 0
      });
    });
    
    // Q-Learning components (Double DQN)
    this.qLearning = {
      states: new Map(),           // Online Q-values: gameState -> Map(action -> qValue)
      targetStates: new Map(),     // Target Q-values (copy of online, updated less frequently)
      alpha: 0.1,                  // learning rate
      gamma: 0.9,                  // discount factor
      epsilon: 0.1,                // exploration rate
      lastState: null,
      lastAction: null,
      lastReward: null,
      updateCounter: 0,            // Track updates for target network sync
      targetUpdateFreq: 10         // Sync target network every N updates
    };
    
    // Simple Neural Network (2-layer feedforward)
    this.neuralNet = {
      inputSize: 22,        // feature vector size (15 original + 7 charge features)
      hiddenSize: 20,       // hidden layer neurons
      outputSize: 3,        // rock, paper, scissor probabilities
      
      // Weights (initialized randomly)
      weightsIH: this.initializeMatrix(22, 20),  // input to hidden
      weightsHO: this.initializeMatrix(20, 3),   // hidden to output
      biasH: new Array(20).fill(0).map(() => Math.random() * 0.1),
      biasO: new Array(3).fill(0).map(() => Math.random() * 0.1),
      
      // Learning parameters
      learningRate: 0.01,
      momentum: 0.9,
      
      // Momentum terms
      momentumIH: this.initializeMatrix(22, 20),
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

    // Iocaine Powder meta-strategy (1999 RoShamBo Programming Competition winner)
    this.iocaine = new IocainePowder();

    // Context Tree Weighting instances (per opponent)
    this.ctwModels = new Map();  // enemyId -> ContextTreeWeighting instance

    // Simple RNN instances (per opponent) for sequence prediction
    this.rnnModels = new Map();  // enemyId -> SimpleRNN instance

    // Bayesian opponent modeling
    this.bayesian = new BayesianOpponentModel();

    // Weighted ensemble for combining strategy predictions
    this.ensemble = new WeightedEnsemble(20);  // 20 round window

    console.log('🤖 ML Decision Engine initialized with Thompson Sampling + hybrid approaches + Iocaine Powder + CTW + Bayesian + Ensemble + RNN');
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
        const rnnResult = this.rnnDecision(enemyId, availableWeapons);
        decision = rnnResult.move;
        confidence = rnnResult.confidence;
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

      case this.strategies.IOCAINE:
        const iocaineResult = this.iocaineDecision(enemyId, availableWeapons);
        decision = iocaineResult.move;
        confidence = iocaineResult.confidence;
        break;

      case this.strategies.CTW:
        const ctwResult = this.ctwDecision(enemyId, availableWeapons);
        decision = ctwResult.move;
        confidence = ctwResult.confidence;
        break;

      case this.strategies.BAYESIAN:
        const bayesianResult = this.bayesianDecision(enemyId, availableWeapons);
        decision = bayesianResult.move;
        confidence = bayesianResult.confidence;
        break;

      case this.strategies.ENSEMBLE:
        const ensembleResult = this.ensembleDecision(enemyId, features, availableWeapons);
        decision = ensembleResult.move;
        confidence = ensembleResult.confidence;
        break;

      case this.strategies.CHARGE_BASED:
        const chargeResult = this.chargeBasedDecision(enemyStats, availableWeapons);
        decision = chargeResult.move;
        confidence = chargeResult.confidence;
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
  
  // Thompson Sampling strategy selection using Beta distribution
  selectStrategy(enemyId) {
    const totalPlays = Array.from(this.bandit.arms.values()).reduce((sum, arm) => sum + arm.plays, 0);

    // Ensure each strategy is tried at least once
    if (totalPlays < Object.keys(this.strategies).length) {
      for (const [strategy, arm] of this.bandit.arms.entries()) {
        if (arm.plays === 0) {
          console.log(`🎰 [Thompson] Initial exploration: ${strategy}`);
          return strategy;
        }
      }
    }

    // Thompson Sampling: sample from Beta distribution for each arm
    let bestStrategy = null;
    let bestSample = -Infinity;
    const samples = {};

    for (const [strategy, arm] of this.bandit.arms.entries()) {
      // Beta(wins + 1, losses + 1) - adding 1 for uniform prior
      const alpha = arm.wins + 1;
      const beta = arm.losses + 1;
      const sample = this.sampleBeta(alpha, beta);
      samples[strategy] = sample;

      if (sample > bestSample) {
        bestSample = sample;
        bestStrategy = strategy;
      }
    }

    console.log(`🎰 [Thompson] Samples: ${Object.entries(samples).map(([s, v]) => `${s}:${v.toFixed(3)}`).join(' ')}`);
    console.log(`🎰 [Thompson] Selected: ${bestStrategy} (sample=${bestSample.toFixed(3)})`);

    return bestStrategy || this.strategies.RANDOM;
  }

  // Sample from Beta(alpha, beta) distribution using gamma distribution method
  sampleBeta(alpha, beta) {
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  // Sample from Gamma(shape, 1) distribution using Marsaglia and Tsang's method
  sampleGamma(shape) {
    // Handle shape < 1 case
    if (shape < 1) {
      return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    // Marsaglia and Tsang's method for shape >= 1
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this.normalRandom();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      // Quick acceptance
      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v;
      }

      // Slower acceptance
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  // Generate standard normal random variable using Box-Muller transform
  normalRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
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

  // Iocaine Powder meta-strategy decision
  iocaineDecision(enemyId, availableWeapons) {
    const result = this.iocaine.getMove(enemyId, availableWeapons);
    console.log(`🧪 [Iocaine] Strategy: ${result.strategy}, Move: ${result.move}, Confidence: ${result.confidence.toFixed(2)}`);
    return result;
  }

  // Context Tree Weighting decision
  ctwDecision(enemyId, availableWeapons) {
    // Ensure CTW model exists for this opponent
    this.ensureCTWModel(enemyId);

    const ctw = this.ctwModels.get(enemyId);
    const result = ctw.getBestMove(availableWeapons);

    console.log(`🌳 [CTW] Prediction: R=${(result.prediction.rock * 100).toFixed(0)}% P=${(result.prediction.paper * 100).toFixed(0)}% S=${(result.prediction.scissor * 100).toFixed(0)}%`);
    console.log(`🌳 [CTW] Move: ${result.move}, Confidence: ${result.confidence.toFixed(2)}, ${result.reasoning}`);

    return result;
  }

  // Simple RNN decision (replaces old feedforward neural network)
  rnnDecision(enemyId, availableWeapons) {
    // Ensure RNN model exists for this opponent
    this.ensureRNNModel(enemyId);

    const rnn = this.rnnModels.get(enemyId);
    const result = rnn.getBestMove(availableWeapons);

    console.log(`🔬 [RNN] Prediction: R=${(result.prediction.rock * 100).toFixed(0)}% P=${(result.prediction.paper * 100).toFixed(0)}% S=${(result.prediction.scissor * 100).toFixed(0)}%`);
    console.log(`🔬 [RNN] Move: ${result.move}, Confidence: ${result.confidence.toFixed(2)}, ${result.reasoning}`);

    return result;
  }

  /**
   * Charge-based prediction strategy
   * Exploits the +5.4% correlation between enemy's highest charges and their move choice.
   * Data shows: When enemy has most charges in X, they play X ~38-39% (vs 33% random)
   */
  chargeBasedDecision(enemyStats, availableWeapons) {
    const charges = enemyStats?.charges || { rock: 3, paper: 3, scissor: 3 };
    const rock = charges.rock ?? 3;
    const paper = charges.paper ?? 3;
    const scissor = charges.scissor ?? 3;

    // Calculate probabilities based on charge correlation (+5.4% lift)
    const total = rock + paper + scissor;
    const baseline = 0.333;
    const chargeLift = 0.054;  // From data analysis

    // Adjust probabilities based on which weapon has most charges
    const probs = {
      rock: baseline,
      paper: baseline,
      scissor: baseline
    };

    // Enemy prefers their highest-charge weapon
    if (rock > paper && rock > scissor) {
      probs.rock = baseline + chargeLift;
      probs.paper = baseline - chargeLift / 2;
      probs.scissor = baseline - chargeLift / 2;
    } else if (paper > rock && paper > scissor) {
      probs.paper = baseline + chargeLift;
      probs.rock = baseline - chargeLift / 2;
      probs.scissor = baseline - chargeLift / 2;
    } else if (scissor > rock && scissor > paper) {
      probs.scissor = baseline + chargeLift;
      probs.rock = baseline - chargeLift / 2;
      probs.paper = baseline - chargeLift / 2;
    }

    // Counter their most likely move
    const counterMap = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    let bestMove = 'rock';
    let bestScore = -1;

    for (const ourMove of availableWeapons) {
      let score = 0;
      for (const theirMove of ['rock', 'paper', 'scissor']) {
        if (counterMap[theirMove] === ourMove) {
          score += probs[theirMove];  // We win
        } else if (counterMap[ourMove] === theirMove) {
          score -= probs[theirMove];  // We lose
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMove = ourMove;
      }
    }

    // Determine which weapon they're most likely to use
    const mostLikelyEnemyMove = Object.entries(probs).reduce((a, b) => b[1] > a[1] ? b : a)[0];

    console.log(`🔋 [Charges] Enemy R=${rock} P=${paper} S=${scissor} → Likely: ${mostLikelyEnemyMove} (${(probs[mostLikelyEnemyMove] * 100).toFixed(0)}%)`);

    return {
      move: bestMove,
      confidence: Math.max(...Object.values(probs)) - baseline,
      prediction: mostLikelyEnemyMove,
      probabilities: probs
    };
  }

  // Ensure CTW model exists for an opponent
  ensureCTWModel(enemyId) {
    if (!this.ctwModels.has(enemyId)) {
      this.ctwModels.set(enemyId, new ContextTreeWeighting(6));  // depth 6 = optimal 50.9% expected
      console.log(`🌳 [CTW] Created new model for opponent ${enemyId}`);
    }
  }

  // Ensure RNN model exists for an opponent
  ensureRNNModel(enemyId) {
    if (!this.rnnModels.has(enemyId)) {
      this.rnnModels.set(enemyId, new SimpleRNN(16));  // 16 hidden units
      console.log(`🔬 [RNN] Created new model for opponent ${enemyId}`);
    }
  }

  // Update CTW model with observed enemy move
  updateCTW(enemyId, enemyAction) {
    this.ensureCTWModel(enemyId);
    const ctw = this.ctwModels.get(enemyId);
    ctw.update(enemyAction);
  }

  // Update RNN model with observed moves
  updateRNN(enemyId, playerAction, enemyAction) {
    this.ensureRNNModel(enemyId);
    const rnn = this.rnnModels.get(enemyId);
    rnn.update(playerAction, enemyAction);
  }

  // Bayesian opponent modeling decision
  bayesianDecision(enemyId, availableWeapons) {
    // Get our last move for opponent type inference
    const model = this.opponentModels.get(enemyId);
    const ourLastMove = model && model.moves.length > 0
      ? this.lastDecisionContext?.decision
      : null;

    const result = this.bayesian.getBestMove(enemyId, ourLastMove, availableWeapons);

    console.log(`🔬 [Bayesian] Type: ${result.dominantType}, Pred: R=${(result.prediction.rock * 100).toFixed(0)}% P=${(result.prediction.paper * 100).toFixed(0)}% S=${(result.prediction.scissor * 100).toFixed(0)}%`);
    console.log(`🔬 [Bayesian] Move: ${result.move}, Confidence: ${result.confidence.toFixed(2)}, ${result.reasoning}`);

    return result;
  }

  // Weighted ensemble decision - combines predictions from multiple strategies
  ensembleDecision(enemyId, features, availableWeapons) {
    const predictions = new Map();

    // Get CTW prediction
    this.ensureCTWModel(enemyId);
    const ctw = this.ctwModels.get(enemyId);
    const ctwPred = ctw.predict();
    if (ctwPred) {
      predictions.set('ctw', ctwPred);
      this.ensemble.recordPrediction('ctw', ctw.getBestMove(availableWeapons).move);
    }

    // Get Bayesian prediction
    const model = this.opponentModels.get(enemyId);
    const ourLastMove = model && model.moves.length > 0
      ? this.lastDecisionContext?.decision
      : null;
    const bayesianResult = this.bayesian.getBestMove(enemyId, ourLastMove, availableWeapons);
    predictions.set('bayesian', bayesianResult.prediction);
    this.ensemble.recordPrediction('bayesian', bayesianResult.move);

    // Get Iocaine prediction
    const iocaineResult = this.iocaine.getMove(enemyId, availableWeapons);
    // Iocaine returns a move, convert to distribution (high prob on predicted enemy move)
    const iocainePred = { rock: 0.2, paper: 0.2, scissor: 0.2 };
    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    const counterTo = { paper: 'rock', scissor: 'paper', rock: 'scissor' };
    // If iocaine says play X, it expects opponent to play what X beats
    const expectedEnemy = counterTo[iocaineResult.move];
    if (expectedEnemy) {
      iocainePred[expectedEnemy] = 0.6;
    }
    predictions.set('iocaine', iocainePred);
    this.ensemble.recordPrediction('iocaine', iocaineResult.move);

    // Get RNN prediction (replaces old feedforward neural network)
    this.ensureRNNModel(enemyId);
    const rnn = this.rnnModels.get(enemyId);
    const rnnPred = rnn.predict();
    predictions.set('rnn', rnnPred);
    const rnnResult = rnn.getBestMove(availableWeapons);
    this.ensemble.recordPrediction('rnn', rnnResult.move);

    // Combine predictions using weighted ensemble
    const result = this.ensemble.getBestMove(predictions, availableWeapons);

    console.log(`[Ensemble] Combined: R=${(result.combinedPrediction.rock * 100).toFixed(0)}% P=${(result.combinedPrediction.paper * 100).toFixed(0)}% S=${(result.combinedPrediction.scissor * 100).toFixed(0)}%`);
    console.log(`[Ensemble] Move: ${result.move}, Confidence: ${result.confidence.toFixed(2)}, ${result.reasoning}`);

    return result;
  }

  // Record predictions from all strategies for ensemble learning
  // Called during learnFromOutcome so ensemble can learn even when not selected
  recordAllStrategyPredictions(enemyId, features) {
    const availableWeapons = ['rock', 'paper', 'scissor'];

    try {
      // Record CTW prediction
      this.ensureCTWModel(enemyId);
      const ctw = this.ctwModels.get(enemyId);
      const ctwResult = ctw.getBestMove(availableWeapons);
      if (ctwResult && ctwResult.move) {
        this.ensemble.recordPrediction('ctw', ctwResult.move);
      }

      // Record Bayesian prediction
      const model = this.opponentModels.get(enemyId);
      const ourLastMove = model && model.moves.length > 0
        ? this.lastDecisionContext?.decision
        : null;
      const bayesianResult = this.bayesian.getBestMove(enemyId, ourLastMove, availableWeapons);
      if (bayesianResult && bayesianResult.move) {
        this.ensemble.recordPrediction('bayesian', bayesianResult.move);
      }

      // Record Iocaine prediction
      const iocaineResult = this.iocaine.getMove(enemyId, availableWeapons);
      if (iocaineResult && iocaineResult.move) {
        this.ensemble.recordPrediction('iocaine', iocaineResult.move);
      }

      // Record RNN prediction (replaces old feedforward neural network)
      this.ensureRNNModel(enemyId);
      const rnn = this.rnnModels.get(enemyId);
      const rnnResult = rnn.getBestMove(availableWeapons);
      if (rnnResult && rnnResult.move) {
        this.ensemble.recordPrediction('rnn', rnnResult.move);
      }
    } catch (error) {
      console.log(`[Ensemble] Error recording predictions: ${error.message}`);
    }
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

    // Update Iocaine Powder (always update for learning, regardless of which strategy was used)
    this.iocaine.update(enemyId, playerAction, enemyAction);

    // Update Context Tree Weighting (always update for learning)
    this.updateCTW(enemyId, enemyAction);

    // Update Simple RNN (always update for learning)
    this.updateRNN(enemyId, playerAction, enemyAction);

    // Update Bayesian opponent model (always update for learning)
    this.bayesian.update(enemyId, playerAction, enemyAction);

    // Record predictions from all strategies for ensemble learning
    // (even if ensemble was not the selected strategy)
    this.recordAllStrategyPredictions(enemyId, features);

    // Update weighted ensemble (always update for learning)
    this.ensemble.updateWeights(enemyAction);

    // Store in battle history
    this.battleHistory.push({
      enemyId, playerAction, enemyAction, result, strategy, features, turn,
      timestamp: Date.now()
    });
    
    // Trim history
    if (this.battleHistory.length > this.maxHistorySize) {
      this.battleHistory.shift();
    }
    
    // Decay Q-learning exploration rate (Thompson Sampling doesn't use epsilon)
    this.qLearning.epsilon *= 0.999;
  }
  
  // Update multi-armed bandit with result (Thompson Sampling)
  updateBandit(strategy, result) {
    const arm = this.bandit.arms.get(strategy);
    if (!arm) return;

    arm.plays++;

    if (result === 'win') {
      arm.wins++;
    } else if (result === 'loss') {
      arm.losses++;
    } else if (result === 'tie') {
      // Ties count as partial success (0.3 wins)
      arm.wins += 0.3;
    }

    // Update running average for display purposes
    arm.value = arm.wins / Math.max(1, arm.plays);
    arm.confidence = Math.sqrt(arm.plays / 10);

    console.log(`🎰 [Thompson] Updated ${strategy}: wins=${arm.wins.toFixed(1)}, losses=${arm.losses}, plays=${arm.plays}, value=${arm.value.toFixed(3)}`);
  }
  
  // Update Q-Learning with Double DQN
  // Uses online network to SELECT action, target network to EVALUATE
  // This reduces overestimation bias in standard Q-learning
  updateQLearning(features, action, result) {
    const stateKey = this.featuresToStateKey(features);

    if (this.qLearning.lastState && this.qLearning.lastAction) {
      const reward = result === 'win' ? 1 : result === 'tie' ? 0 : -0.5;

      const lastStateValues = this.qLearning.states.get(this.qLearning.lastState);

      // Ensure current state exists in both online and target tables
      if (!this.qLearning.states.has(stateKey)) {
        const actionValues = new Map();
        ['rock', 'paper', 'scissor'].forEach(a => actionValues.set(a, Math.random() * 0.1));
        this.qLearning.states.set(stateKey, actionValues);
      }
      if (!this.qLearning.targetStates.has(stateKey)) {
        this.qLearning.targetStates.set(stateKey, new Map(this.qLearning.states.get(stateKey)));
      }

      if (lastStateValues) {
        // DOUBLE DQN: Use online network to SELECT action, target network to EVALUATE
        const onlineValues = this.qLearning.states.get(stateKey);
        const targetValues = this.qLearning.targetStates.get(stateKey) || onlineValues;

        // Select best action using ONLINE network
        let bestAction = 'rock';
        let bestOnlineValue = -Infinity;
        for (const [a, v] of onlineValues) {
          if (v > bestOnlineValue) {
            bestOnlineValue = v;
            bestAction = a;
          }
        }

        // Evaluate that action using TARGET network (reduces overestimation)
        const nextQ = targetValues.get(bestAction) || 0;

        // TD update on online network
        const currentQ = lastStateValues.get(this.qLearning.lastAction) || 0;
        const newQ = currentQ + this.qLearning.alpha * (reward + this.qLearning.gamma * nextQ - currentQ);
        lastStateValues.set(this.qLearning.lastAction, newQ);
      }
    }

    // Periodically sync target network to online network
    this.qLearning.updateCounter++;
    if (this.qLearning.updateCounter % this.qLearning.targetUpdateFreq === 0) {
      this.syncTargetNetwork();
    }

    this.qLearning.lastState = stateKey;
    this.qLearning.lastAction = action;
    this.qLearning.lastReward = result;
  }

  // Sync target network by copying online Q-values
  // Called periodically to stabilize learning
  syncTargetNetwork() {
    this.qLearning.targetStates = new Map();
    for (const [state, actions] of this.qLearning.states) {
      this.qLearning.targetStates.set(state, new Map(actions));
    }
    console.log(`[DQN] Target network synced (${this.qLearning.states.size} states)`);
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

    // Extract enemy charges (most predictive feature: +5.4% lift)
    const enemyCharges = enemyStats?.charges || { rock: 3, paper: 3, scissor: 3 };
    const rockCharges = enemyCharges.rock ?? 3;
    const paperCharges = enemyCharges.paper ?? 3;
    const scissorCharges = enemyCharges.scissor ?? 3;
    const maxCharges = Math.max(rockCharges, paperCharges, scissorCharges);

    return [
      // Original features (0-14)
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
      Math.cos(turn / 10),                 // cyclic feature 2

      // NEW: Enemy charge features (15-21) - +5.4% predictive lift
      rockCharges / 3,                     // normalized rock charges
      paperCharges / 3,                    // normalized paper charges
      scissorCharges / 3,                  // normalized scissor charges
      rockCharges === maxCharges && rockCharges > paperCharges && rockCharges > scissorCharges ? 1 : 0,  // rock highest
      paperCharges === maxCharges && paperCharges > rockCharges && paperCharges > scissorCharges ? 1 : 0, // paper highest
      scissorCharges === maxCharges && scissorCharges > rockCharges && scissorCharges > paperCharges ? 1 : 0, // scissor highest
      turn === 1 ? 1 : 0                   // first turn indicator (for turn-1 biases)
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
    // Compute Thompson Sampling statistics
    const armStats = {};
    for (const [strategy, arm] of this.bandit.arms.entries()) {
      armStats[strategy] = {
        plays: arm.plays,
        wins: arm.wins,
        losses: arm.losses,
        value: arm.value,
        // Show effective Beta distribution parameters
        alpha: arm.wins + 1,
        beta: arm.losses + 1
      };
    }

    // Collect CTW stats
    const ctwStats = {};
    for (const [enemyId, ctw] of this.ctwModels.entries()) {
      const stats = ctw.getStats();
      ctwStats[enemyId] = {
        nodes: stats.totalNodes,
        depth: stats.actualDepth,
        history: stats.historyLength,
        prediction: stats.weightedPrediction
      };
    }

    // Collect RNN stats
    const rnnStats = {};
    for (const [enemyId, rnn] of this.rnnModels.entries()) {
      const stats = rnn.getStats();
      rnnStats[enemyId] = {
        hiddenSize: stats.hiddenSize,
        historyLength: stats.historyLength,
        hiddenNorm: stats.hiddenNorm,
        prediction: stats.prediction
      };
    }

    return {
      strategies: armStats,
      samplingMethod: 'thompson',
      totalOpponents: this.opponentModels.size,
      totalBattles: this.battleHistory.length,
      qStates: this.qLearning.states.size,
      qTargetStates: this.qLearning.targetStates?.size || 0,
      qUpdateCounter: this.qLearning.updateCounter,
      qTargetUpdateFreq: this.qLearning.targetUpdateFreq,
      qLearningEpsilon: this.qLearning.epsilon,
      qLearningMethod: 'double_dqn',
      iocaine: this.iocaine.getStats(),
      ctw: ctwStats,
      rnn: rnnStats,
      bayesian: this.bayesian.getOverallStats(),
      ensemble: this.ensemble.getStats()
    };
  }
}

export default MLDecisionEngine;