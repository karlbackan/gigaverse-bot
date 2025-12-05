/**
 * Win-Stay-Lose-Shift (WSLS) Predictor
 *
 * Classic human behavioral pattern:
 * - After WIN: Opponent tends to stay with same move
 * - After LOSS: Opponent tends to shift to a different move
 * - After DRAW: Mixed behavior
 *
 * This captures reactive behavior that Markov chains miss.
 */

export class WSLSPredictor {
  constructor() {
    this.opponentHistory = new Map();  // enemyId -> history array
  }

  ensureOpponent(enemyId) {
    if (!this.opponentHistory.has(enemyId)) {
      this.opponentHistory.set(enemyId, {
        lastMove: null,
        lastResult: null,  // 'win', 'loss', 'draw' (from opponent's perspective)
        // Track actual behavior
        stats: {
          winStay: 0, winShift: 0,    // After opponent wins
          lossStay: 0, lossShift: 0,  // After opponent loses
          drawStay: 0, drawShift: 0   // After draw
        }
      });
    }
    return this.opponentHistory.get(enemyId);
  }

  /**
   * Get opponent's last result (from their perspective)
   */
  getOpponentResult(playerMove, enemyMove) {
    if (this.beats(enemyMove, playerMove)) return 'win';
    if (this.beats(playerMove, enemyMove)) return 'loss';
    return 'draw';
  }

  beats(a, b) {
    return (a === 'rock' && b === 'scissor') ||
           (a === 'paper' && b === 'rock') ||
           (a === 'scissor' && b === 'paper');
  }

  /**
   * Update with observed battle
   */
  update(enemyId, playerMove, enemyMove) {
    const data = this.ensureOpponent(enemyId);

    // Track WSLS behavior if we have history
    if (data.lastMove && data.lastResult) {
      const stayed = (enemyMove === data.lastMove);

      if (data.lastResult === 'win') {
        if (stayed) data.stats.winStay++;
        else data.stats.winShift++;
      } else if (data.lastResult === 'loss') {
        if (stayed) data.stats.lossStay++;
        else data.stats.lossShift++;
      } else {
        if (stayed) data.stats.drawStay++;
        else data.stats.drawShift++;
      }
    }

    // Update for next round
    data.lastMove = enemyMove;
    data.lastResult = this.getOpponentResult(playerMove, enemyMove);
  }

  /**
   * Predict opponent's next move based on WSLS behavior
   */
  predict(enemyId, lastPlayerMove, lastEnemyMove) {
    const data = this.ensureOpponent(enemyId);

    // Need last result to predict
    const lastResult = this.getOpponentResult(lastPlayerMove, lastEnemyMove);

    // Calculate stay probability based on history
    let stayProb;
    const stats = data.stats;

    if (lastResult === 'win') {
      const total = stats.winStay + stats.winShift;
      stayProb = total > 0 ? stats.winStay / total : 0.7;  // Default: 70% stay after win
    } else if (lastResult === 'loss') {
      const total = stats.lossStay + stats.lossShift;
      stayProb = total > 0 ? stats.lossStay / total : 0.3;  // Default: 30% stay after loss
    } else {
      const total = stats.drawStay + stats.drawShift;
      stayProb = total > 0 ? stats.drawStay / total : 0.5;  // Default: 50% stay after draw
    }

    // Build probability distribution
    const probs = { rock: 0, paper: 0, scissor: 0 };
    const shiftProb = 1 - stayProb;

    // Stay = same move
    probs[lastEnemyMove] = stayProb;

    // Shift = distribute among other moves
    const otherMoves = ['rock', 'paper', 'scissor'].filter(m => m !== lastEnemyMove);
    for (const move of otherMoves) {
      probs[move] = shiftProb / 2;
    }

    return probs;
  }

  /**
   * Get stats for analysis
   */
  getStats(enemyId) {
    const data = this.opponentHistory.get(enemyId);
    if (!data) return null;

    const s = data.stats;
    const winTotal = s.winStay + s.winShift;
    const lossTotal = s.lossStay + s.lossShift;
    const drawTotal = s.drawStay + s.drawShift;

    return {
      winStayRate: winTotal > 0 ? s.winStay / winTotal : 0.7,
      lossStayRate: lossTotal > 0 ? s.lossStay / lossTotal : 0.3,
      drawStayRate: drawTotal > 0 ? s.drawStay / drawTotal : 0.5,
      samples: winTotal + lossTotal + drawTotal
    };
  }

  /**
   * Serialize for persistence
   */
  serialize() {
    const data = {};
    for (const [enemyId, history] of this.opponentHistory) {
      data[enemyId] = { ...history };
    }
    return data;
  }

  /**
   * Deserialize from persistence
   */
  deserialize(data) {
    if (!data) return;
    for (const [enemyId, history] of Object.entries(data)) {
      this.opponentHistory.set(enemyId, history);
    }
  }
}

export default WSLSPredictor;
