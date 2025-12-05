/**
 * Gated Recurrent Unit (GRU) for RPS Sequence Prediction
 *
 * GRU is simpler than LSTM but captures longer dependencies than Elman RNN.
 * It has two gates:
 * - Update gate (z): decides how much past to keep
 * - Reset gate (r): decides how much past to forget for candidate
 *
 * Based on Cho et al. (2014) "Learning Phrase Representations using RNN Encoder-Decoder"
 */

export class SimpleGRU {
  constructor(hiddenSize = 16) {
    this.inputSize = 6;   // one-hot: [our_move(3), their_move(3)]
    this.hiddenSize = hiddenSize;
    this.outputSize = 3;  // probability of rock/paper/scissor

    // GRU gate weights (input + hidden -> hidden)
    this.Wz = this.initMatrix(this.inputSize + this.hiddenSize, this.hiddenSize);  // Update gate
    this.Wr = this.initMatrix(this.inputSize + this.hiddenSize, this.hiddenSize);  // Reset gate
    this.Wh = this.initMatrix(this.inputSize + this.hiddenSize, this.hiddenSize);  // Candidate hidden

    // Output weights (hidden -> output)
    this.Why = this.initMatrix(this.hiddenSize, this.outputSize);
    this.by = new Array(this.outputSize).fill(0);

    // Hidden state (memory)
    this.hidden = new Array(this.hiddenSize).fill(0);

    // Learning parameters
    this.learningRate = 0.01;

    // History for training
    this.history = [];
    this.maxHistory = 50;

    // Minimum history before making confident predictions
    this.minHistoryForPrediction = 5;
  }

  initMatrix(rows, cols) {
    // Xavier/Glorot initialization
    const scale = Math.sqrt(2 / (rows + cols));
    return Array(rows).fill(null).map(() =>
      Array(cols).fill(null).map(() => (Math.random() * 2 - 1) * scale)
    );
  }

  // Activation functions
  sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  tanh(x) {
    return Math.tanh(x);
  }

  softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
  }

  // Matrix-vector multiplication
  matVec(mat, vec) {
    const result = new Array(mat[0].length).fill(0);
    for (let j = 0; j < mat[0].length; j++) {
      for (let i = 0; i < mat.length; i++) {
        result[j] += mat[i][j] * vec[i];
      }
    }
    return result;
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

  /**
   * Forward pass through GRU
   */
  forward(input) {
    // Concatenate input and hidden state: [x_t, h_{t-1}]
    const concat = [...input, ...this.hidden];

    // Update gate: z_t = sigmoid(W_z * [x_t, h_{t-1}])
    // Decides how much of the past to keep
    const zRaw = this.matVec(this.Wz, concat);
    const z = zRaw.map(x => this.sigmoid(x));

    // Reset gate: r_t = sigmoid(W_r * [x_t, h_{t-1}])
    // Decides how much past to forget for candidate computation
    const rRaw = this.matVec(this.Wr, concat);
    const r = rRaw.map(x => this.sigmoid(x));

    // Candidate hidden: h_candidate = tanh(W_h * [x_t, r_t ⊙ h_{t-1}])
    const resetHidden = this.hidden.map((h, i) => h * r[i]);
    const concatReset = [...input, ...resetHidden];
    const hCandidateRaw = this.matVec(this.Wh, concatReset);
    const hCandidate = hCandidateRaw.map(x => this.tanh(x));

    // New hidden: h_t = (1 - z_t) ⊙ h_{t-1} + z_t ⊙ h_candidate
    this.hidden = this.hidden.map((h, i) =>
      (1 - z[i]) * h + z[i] * hCandidate[i]
    );

    // Output: y = softmax(W_hy * h_t + b_y)
    const output = this.matVec(this.Why, this.hidden);
    for (let i = 0; i < this.outputSize; i++) {
      output[i] += this.by[i];
    }

    return this.softmax(output);
  }

  /**
   * Train on a single example (simplified backprop - updates output layer only)
   * Full BPTT through GRU is complex; this is a simplification
   */
  train(input, targetMove) {
    // Forward pass
    const output = this.forward(input);

    // Target one-hot
    const target = this.encodeMove(targetMove);

    // Output error (cross-entropy gradient for softmax)
    const outputError = output.map((o, i) => o - target[i]);

    // Backprop to Why and by (output layer only)
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        this.Why[i][j] -= this.learningRate * this.hidden[i] * outputError[j];
      }
    }
    for (let j = 0; j < this.outputSize; j++) {
      this.by[j] -= this.learningRate * outputError[j];
    }

    // Simplified backprop to GRU gates (update all gate weights slightly)
    // This is not full BPTT but provides some gradient signal
    const hiddenError = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        hiddenError[i] += this.Why[i][j] * outputError[j];
      }
    }

    // Small update to gate weights based on hidden error
    const concat = [...input, ...this.hidden];
    const gradScale = this.learningRate * 0.1;  // Smaller for gates
    for (let i = 0; i < concat.length; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        const grad = concat[i] * hiddenError[j] * gradScale;
        this.Wh[i][j] -= grad;
        this.Wz[i][j] -= grad * 0.5;
        this.Wr[i][j] -= grad * 0.5;
      }
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

    // Blend with uniform distribution based on history length
    // More history = more confidence in GRU predictions
    const historyWeight = Math.min(1, (this.history.length - 1) / this.minHistoryForPrediction);
    const uniformWeight = 1 - historyWeight;

    return {
      rock: output[0] * historyWeight + (1/3) * uniformWeight,
      paper: output[1] * historyWeight + (1/3) * uniformWeight,
      scissor: output[2] * historyWeight + (1/3) * uniformWeight
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
        reasoning: `GRU predicts ${bestOpp} (${(bestProb * 100).toFixed(1)}%)`
      };
    }

    // Fallback to best available based on expected value
    let bestMove = availableWeapons[0];
    let bestExpected = -Infinity;

    for (const move of availableWeapons) {
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
      reasoning: `GRU fallback to ${bestMove}`
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
      type: 'GRU',
      hiddenSize: this.hiddenSize,
      historyLength: this.history.length,
      hiddenNorm: Math.sqrt(this.hidden.reduce((a, b) => a + b * b, 0)),
      prediction: this.predict()
    };
  }

  /**
   * Serialize for persistence
   */
  serialize() {
    return {
      type: 'GRU',
      hiddenSize: this.hiddenSize,
      Wz: this.Wz,
      Wr: this.Wr,
      Wh: this.Wh,
      Why: this.Why,
      by: this.by,
      hidden: this.hidden,
      history: this.history.slice(-this.maxHistory)
    };
  }

  /**
   * Deserialize from persistence
   */
  deserialize(data) {
    if (!data || data.type !== 'GRU') return;

    this.hiddenSize = data.hiddenSize || 16;
    this.Wz = data.Wz || this.Wz;
    this.Wr = data.Wr || this.Wr;
    this.Wh = data.Wh || this.Wh;
    this.Why = data.Why || this.Why;
    this.by = data.by || this.by;
    this.hidden = data.hidden || new Array(this.hiddenSize).fill(0);
    this.history = data.history || [];
  }
}

export default SimpleGRU;
