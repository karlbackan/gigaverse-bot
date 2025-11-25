/**
 * Simple Recurrent Neural Network for RPS Sequence Prediction
 *
 * Elman-style RNN implemented in pure JavaScript (no external dependencies).
 * Captures temporal patterns without requiring TensorFlow.
 */

export class SimpleRNN {
  constructor(hiddenSize = 16) {
    this.inputSize = 6;   // one-hot: [our_move(3), their_move(3)]
    this.hiddenSize = hiddenSize;
    this.outputSize = 3;  // probability of rock/paper/scissor

    // Initialize weights with Xavier/Glorot initialization
    this.Wxh = this.initMatrix(this.inputSize, this.hiddenSize);   // input -> hidden
    this.Whh = this.initMatrix(this.hiddenSize, this.hiddenSize);  // hidden -> hidden (recurrent)
    this.Why = this.initMatrix(this.hiddenSize, this.outputSize);  // hidden -> output

    // Biases
    this.bh = new Array(this.hiddenSize).fill(0);
    this.by = new Array(this.outputSize).fill(0);

    // Hidden state (memory)
    this.hidden = new Array(this.hiddenSize).fill(0);

    // Learning parameters
    this.learningRate = 0.05;

    // History for training
    this.history = [];
    this.maxHistory = 50;
  }

  initMatrix(rows, cols) {
    const scale = Math.sqrt(2 / (rows + cols));
    return Array(rows).fill(null).map(() =>
      Array(cols).fill(null).map(() => (Math.random() * 2 - 1) * scale)
    );
  }

  // Activation functions
  tanh(x) {
    return Math.tanh(x);
  }

  tanhDerivative(x) {
    const t = Math.tanh(x);
    return 1 - t * t;
  }

  softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
  }

  // One-hot encode a move
  encodeMove(move) {
    const encoding = [0, 0, 0];
    if (move === 'rock') encoding[0] = 1;
    else if (move === 'paper') encoding[1] = 1;
    else if (move === 'scissor') encoding[2] = 1;
    return encoding;
  }

  // Create input vector from our move and their move
  createInput(ourMove, theirMove) {
    return [...this.encodeMove(ourMove), ...this.encodeMove(theirMove)];
  }

  // Forward pass
  forward(input) {
    // Compute new hidden state: h_t = tanh(Wxh * x + Whh * h_{t-1} + bh)
    const newHidden = new Array(this.hiddenSize).fill(0);

    // Input contribution
    for (let j = 0; j < this.hiddenSize; j++) {
      for (let i = 0; i < this.inputSize; i++) {
        newHidden[j] += input[i] * this.Wxh[i][j];
      }
      // Recurrent contribution
      for (let i = 0; i < this.hiddenSize; i++) {
        newHidden[j] += this.hidden[i] * this.Whh[i][j];
      }
      newHidden[j] = this.tanh(newHidden[j] + this.bh[j]);
    }

    // Update hidden state
    this.hidden = newHidden;

    // Compute output: y = softmax(Why * h + by)
    const output = new Array(this.outputSize).fill(0);
    for (let j = 0; j < this.outputSize; j++) {
      for (let i = 0; i < this.hiddenSize; i++) {
        output[j] += this.hidden[i] * this.Why[i][j];
      }
      output[j] += this.by[j];
    }

    return this.softmax(output);
  }

  // Train on a single example (simplified backprop)
  train(input, targetMove) {
    // Forward pass
    const output = this.forward(input);

    // Target one-hot
    const target = this.encodeMove(targetMove);

    // Output error (cross-entropy gradient for softmax)
    const outputError = output.map((o, i) => o - target[i]);

    // Backprop to Why and by
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        this.Why[i][j] -= this.learningRate * this.hidden[i] * outputError[j];
      }
    }
    for (let j = 0; j < this.outputSize; j++) {
      this.by[j] -= this.learningRate * outputError[j];
    }

    // Backprop to hidden layer (simplified - not full BPTT)
    const hiddenError = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        hiddenError[i] += this.Why[i][j] * outputError[j];
      }
      hiddenError[i] *= this.tanhDerivative(this.hidden[i]);
    }

    // Update Wxh
    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.Wxh[i][j] -= this.learningRate * input[i] * hiddenError[j];
      }
    }

    // Update bh
    for (let j = 0; j < this.hiddenSize; j++) {
      this.bh[j] -= this.learningRate * hiddenError[j];
    }

    return output;
  }

  /**
   * Update after a round
   */
  update(ourMove, theirMove) {
    // Store in history
    this.history.push({ our: ourMove, their: theirMove });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Create input from previous round (if available)
    if (this.history.length >= 2) {
      const prev = this.history[this.history.length - 2];
      const input = this.createInput(prev.our, prev.their);

      // Train to predict current opponent move
      this.train(input, theirMove);
    }
  }

  /**
   * Predict opponent's next move
   */
  predict() {
    if (this.history.length < 1) {
      return { rock: 1/3, paper: 1/3, scissor: 1/3 };
    }

    // Use last round as input
    const last = this.history[this.history.length - 1];
    const input = this.createInput(last.our, last.their);
    const output = this.forward(input);

    return {
      rock: output[0],
      paper: output[1],
      scissor: output[2]
    };
  }

  /**
   * Get best counter move
   */
  getBestMove(availableWeapons = ['rock', 'paper', 'scissor']) {
    const prediction = this.predict();
    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

    // Find most likely opponent move
    let bestOpp = 'rock';
    let bestProb = 0;
    for (const move of ['rock', 'paper', 'scissor']) {
      if (prediction[move] > bestProb) {
        bestProb = prediction[move];
        bestOpp = move;
      }
    }

    // Counter if available
    const counterMove = counter[bestOpp];
    if (availableWeapons.includes(counterMove)) {
      return {
        move: counterMove,
        confidence: bestProb,
        prediction,
        reasoning: `RNN predicts ${bestOpp} (${(bestProb * 100).toFixed(1)}%)`
      };
    }

    // Fallback to best available based on expected value
    let bestMove = availableWeapons[0];
    let bestExpected = -Infinity;

    for (const move of availableWeapons) {
      // Expected value: +1 if we beat their move, 0 for tie, -1 for loss
      const beats = { rock: 'scissor', paper: 'rock', scissor: 'paper' };
      const losesTo = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

      const expected = prediction[beats[move]] - prediction[losesTo[move]];
      if (expected > bestExpected) {
        bestExpected = expected;
        bestMove = move;
      }
    }

    return {
      move: bestMove,
      confidence: Math.max(0.33, bestProb * 0.8),
      prediction,
      reasoning: `RNN fallback to ${bestMove}`
    };
  }

  /**
   * Reset hidden state (for new opponent)
   */
  resetState() {
    this.hidden = new Array(this.hiddenSize).fill(0);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      hiddenSize: this.hiddenSize,
      historyLength: this.history.length,
      hiddenNorm: Math.sqrt(this.hidden.reduce((a, b) => a + b * b, 0)),
      prediction: this.predict()
    };
  }
}

export default SimpleRNN;
