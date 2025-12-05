/**
 * Comprehensive Algorithm Experiments
 * Tests multiple hypotheses on historical data
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';
import fs from 'fs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class ExperimentRunner {
  constructor() {
    this.db = null;
    this.battles = [];
    this.results = {};
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async loadBattles() {
    this.battles = await this.query(`
      SELECT enemy_id, player_move, enemy_move, result, turn, timestamp
      FROM battles
      WHERE player_move IN ('rock', 'paper', 'scissor')
        AND enemy_move IN ('rock', 'paper', 'scissor')
      ORDER BY enemy_id, timestamp
    `);
    console.log(`Loaded ${this.battles.length} battles\n`);
  }

  getCounter(move) {
    return { rock: 'paper', paper: 'scissor', scissor: 'rock' }[move];
  }

  beats(a, b) {
    return (a === 'rock' && b === 'scissor') ||
           (a === 'paper' && b === 'rock') ||
           (a === 'scissor' && b === 'paper');
  }

  argmax(probs) {
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

  // ==================== EXPERIMENT 1: CTW Depth ====================
  async experimentCTWDepth() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 1: CTW Depth Analysis');
    console.log('=' .repeat(60));

    const depths = [2, 3, 4, 5, 6, 7, 8, 10];
    const results = [];

    for (const depth of depths) {
      const stats = { predictions: 0, correct: 0 };
      const models = new Map();

      let lastEnemyId = null;
      for (const battle of this.battles) {
        const enemyId = String(battle.enemy_id);
        const { enemy_move } = battle;

        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          models.set(enemyId, new ContextTreeWeighting(depth));
        }

        const model = models.get(enemyId);
        if (model.history.length >= 1) {
          const probs = model.predict();
          if (probs) {
            const predicted = this.argmax(probs);
            stats.predictions++;
            if (predicted === enemy_move) stats.correct++;
          }
        }
        model.update(enemy_move);
      }

      const accuracy = (stats.correct / stats.predictions * 100);
      results.push({ depth, accuracy, predictions: stats.predictions });
      console.log(`  Depth ${depth}: ${accuracy.toFixed(2)}% accuracy`);
    }

    this.results.ctwDepth = results;
    const best = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`\n  Best: Depth ${best.depth} at ${best.accuracy.toFixed(2)}%\n`);
    return results;
  }

  // ==================== EXPERIMENT 2: Per-Opponent Analysis ====================
  async experimentPerOpponent() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 2: Per-Opponent Predictability');
    console.log('=' .repeat(60));

    const opponentStats = new Map();
    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(6));
        opponentStats.set(enemyId, { predictions: 0, correct: 0, total: 0 });
      }

      const model = models.get(enemyId);
      const stats = opponentStats.get(enemyId);
      stats.total++;

      if (model.history.length >= 1) {
        const probs = model.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          stats.predictions++;
          if (predicted === enemy_move) stats.correct++;
        }
      }
      model.update(enemy_move);
    }

    // Sort by accuracy
    const results = [];
    for (const [enemyId, stats] of opponentStats) {
      if (stats.predictions > 0) {
        const accuracy = stats.correct / stats.predictions * 100;
        results.push({ enemyId, accuracy, battles: stats.total });
      }
    }
    results.sort((a, b) => b.accuracy - a.accuracy);

    console.log('\n  Top 10 Most Predictable:');
    console.log('  ' + '-'.repeat(50));
    for (const r of results.slice(0, 10)) {
      console.log(`    Enemy ${r.enemyId.padEnd(12)}: ${r.accuracy.toFixed(1)}% (${r.battles} battles)`);
    }

    console.log('\n  Top 10 Least Predictable (most random):');
    console.log('  ' + '-'.repeat(50));
    for (const r of results.slice(-10).reverse()) {
      console.log(`    Enemy ${r.enemyId.padEnd(12)}: ${r.accuracy.toFixed(1)}% (${r.battles} battles)`);
    }

    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    console.log(`\n  Average per-opponent accuracy: ${avgAccuracy.toFixed(2)}%`);
    console.log(`  Opponents above 40%: ${results.filter(r => r.accuracy > 40).length}`);
    console.log(`  Opponents below 33%: ${results.filter(r => r.accuracy < 33).length}\n`);

    this.results.perOpponent = results;
    return results;
  }

  // ==================== EXPERIMENT 3: Transition Matrix ====================
  async experimentTransitionMatrix() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 3: Transition Matrix (First-Order Markov)');
    console.log('=' .repeat(60));

    // Global transition counts
    const transitions = {
      rock: { rock: 0, paper: 0, scissor: 0 },
      paper: { rock: 0, paper: 0, scissor: 0 },
      scissor: { rock: 0, paper: 0, scissor: 0 }
    };

    const stats = { predictions: 0, correct: 0 };
    let lastEnemyId = null;
    let lastEnemyMove = null;

    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        lastEnemyMove = null;
      }

      if (lastEnemyMove) {
        // Predict based on transition probabilities
        const trans = transitions[lastEnemyMove];
        const total = trans.rock + trans.paper + trans.scissor;
        if (total > 10) {
          const probs = {
            rock: (trans.rock + 1) / (total + 3),
            paper: (trans.paper + 1) / (total + 3),
            scissor: (trans.scissor + 1) / (total + 3)
          };
          const predicted = this.argmax(probs);
          stats.predictions++;
          if (predicted === enemy_move) stats.correct++;
        }

        // Update transitions
        transitions[lastEnemyMove][enemy_move]++;
      }

      lastEnemyMove = enemy_move;
    }

    // Print transition matrix
    console.log('\n  Transition Matrix (from -> to):');
    console.log('  ' + '-'.repeat(50));
    for (const from of MOVES) {
      const trans = transitions[from];
      const total = trans.rock + trans.paper + trans.scissor;
      if (total > 0) {
        const row = MOVES.map(to => `${(trans[to] / total * 100).toFixed(1)}%`).join('  ');
        console.log(`    ${from.padEnd(8)} -> ${row}`);
      }
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  Prediction accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%\n`);

    this.results.transitionMatrix = { transitions, accuracy };
    return { transitions, accuracy };
  }

  // ==================== EXPERIMENT 4: Anti-Rotation Detection ====================
  async experimentAntiRotation() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 4: Anti-Rotation Detection');
    console.log('=' .repeat(60));

    // Detect R->P->S or R->S->P cycling
    const clockwise = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    const counterClockwise = { rock: 'scissor', scissor: 'paper', paper: 'rock' };

    const stats = { predictions: 0, correct: 0 };
    const rotationStats = { clockwise: 0, counter: 0, other: 0 };

    let lastEnemyId = null;
    let lastEnemyMove = null;
    let secondLastMove = null;

    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        lastEnemyMove = null;
        secondLastMove = null;
      }

      if (lastEnemyMove && secondLastMove) {
        // Check if last two moves form a rotation pattern
        const isClockwise = clockwise[secondLastMove] === lastEnemyMove;
        const isCounter = counterClockwise[secondLastMove] === lastEnemyMove;

        let predicted;
        if (isClockwise) {
          // Predict next in clockwise sequence
          predicted = clockwise[lastEnemyMove];
          rotationStats.clockwise++;
        } else if (isCounter) {
          // Predict next in counter-clockwise sequence
          predicted = counterClockwise[lastEnemyMove];
          rotationStats.counter++;
        } else {
          // No clear pattern, use frequency
          predicted = lastEnemyMove; // Stay bias
          rotationStats.other++;
        }

        stats.predictions++;
        if (predicted === enemy_move) stats.correct++;
      }

      secondLastMove = lastEnemyMove;
      lastEnemyMove = enemy_move;
    }

    const accuracy = stats.correct / stats.predictions * 100;
    const total = rotationStats.clockwise + rotationStats.counter + rotationStats.other;

    console.log('\n  Pattern Distribution:');
    console.log(`    Clockwise (R->P->S):     ${(rotationStats.clockwise / total * 100).toFixed(1)}%`);
    console.log(`    Counter (R->S->P):       ${(rotationStats.counter / total * 100).toFixed(1)}%`);
    console.log(`    Other:                   ${(rotationStats.other / total * 100).toFixed(1)}%`);
    console.log(`\n  Prediction accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%\n`);

    this.results.antiRotation = { rotationStats, accuracy };
    return { rotationStats, accuracy };
  }

  // ==================== EXPERIMENT 5: Recency Weighting ====================
  async experimentRecencyWeighting() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 5: Recency-Weighted Frequency');
    console.log('=' .repeat(60));

    const decayRates = [0.8, 0.9, 0.95, 0.98, 0.99, 1.0];
    const results = [];

    for (const decay of decayRates) {
      const stats = { predictions: 0, correct: 0 };
      const opponentWeights = new Map();

      let lastEnemyId = null;
      for (const battle of this.battles) {
        const enemyId = String(battle.enemy_id);
        const { enemy_move } = battle;

        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          opponentWeights.set(enemyId, { rock: 1, paper: 1, scissor: 1 });
        }

        const weights = opponentWeights.get(enemyId);
        const total = weights.rock + weights.paper + weights.scissor;

        if (total > 3.5) {  // Some history
          const probs = {
            rock: weights.rock / total,
            paper: weights.paper / total,
            scissor: weights.scissor / total
          };
          const predicted = this.argmax(probs);
          stats.predictions++;
          if (predicted === enemy_move) stats.correct++;
        }

        // Apply decay and update
        weights.rock *= decay;
        weights.paper *= decay;
        weights.scissor *= decay;
        weights[enemy_move] += 1;
      }

      const accuracy = stats.correct / stats.predictions * 100;
      results.push({ decay, accuracy });
      console.log(`  Decay ${decay}: ${accuracy.toFixed(2)}%`);
    }

    const best = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`\n  Best: Decay ${best.decay} at ${best.accuracy.toFixed(2)}%\n`);

    this.results.recencyWeighting = results;
    return results;
  }

  // ==================== EXPERIMENT 6: Conditional Patterns ====================
  async experimentConditionalPatterns() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 6: Conditional Patterns (After Win/Loss/Draw)');
    console.log('=' .repeat(60));

    // Track what opponent plays after each outcome (from THEIR perspective)
    const conditionalCounts = {
      afterWin: { rock: 0, paper: 0, scissor: 0 },
      afterLoss: { rock: 0, paper: 0, scissor: 0 },
      afterDraw: { rock: 0, paper: 0, scissor: 0 }
    };

    const stats = { predictions: 0, correct: 0 };
    let lastEnemyId = null;
    let lastResult = null;  // 'win', 'loss', 'draw' from enemy perspective

    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { player_move, enemy_move, result } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        lastResult = null;
      }

      if (lastResult) {
        const condition = `after${lastResult.charAt(0).toUpperCase() + lastResult.slice(1)}`;
        const counts = conditionalCounts[condition];
        const total = counts.rock + counts.paper + counts.scissor;

        if (total > 50) {
          const probs = {
            rock: (counts.rock + 1) / (total + 3),
            paper: (counts.paper + 1) / (total + 3),
            scissor: (counts.scissor + 1) / (total + 3)
          };
          const predicted = this.argmax(probs);
          stats.predictions++;
          if (predicted === enemy_move) stats.correct++;
        }

        counts[enemy_move]++;
      }

      // Determine enemy's result
      if (this.beats(enemy_move, player_move)) {
        lastResult = 'win';
      } else if (this.beats(player_move, enemy_move)) {
        lastResult = 'loss';
      } else {
        lastResult = 'draw';
      }
    }

    // Print conditional distributions
    console.log('\n  Enemy Move Distribution by Previous Outcome:');
    console.log('  ' + '-'.repeat(50));
    for (const [condition, counts] of Object.entries(conditionalCounts)) {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total > 0) {
        const dist = MOVES.map(m => `${m}: ${(counts[m] / total * 100).toFixed(1)}%`).join(', ');
        console.log(`    ${condition.padEnd(12)}: ${dist}`);
      }
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  Prediction accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%\n`);

    this.results.conditionalPatterns = { conditionalCounts, accuracy };
    return { conditionalCounts, accuracy };
  }

  // ==================== EXPERIMENT 7: Frequency Bias ====================
  async experimentFrequencyBias() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 7: Simple Frequency Bias');
    console.log('=' .repeat(60));

    // Track overall and per-opponent frequencies
    const globalCounts = { rock: 0, paper: 0, scissor: 0 };
    const stats = { predictions: 0, correct: 0 };
    const perOpponentFreq = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        perOpponentFreq.set(enemyId, { rock: 0, paper: 0, scissor: 0 });
      }

      const opponentCounts = perOpponentFreq.get(enemyId);
      const total = opponentCounts.rock + opponentCounts.paper + opponentCounts.scissor;

      if (total > 10) {
        const predicted = this.argmax(opponentCounts);
        stats.predictions++;
        if (predicted === enemy_move) stats.correct++;
      }

      opponentCounts[enemy_move]++;
      globalCounts[enemy_move]++;
    }

    // Print global distribution
    const globalTotal = globalCounts.rock + globalCounts.paper + globalCounts.scissor;
    console.log('\n  Global Move Distribution:');
    for (const move of MOVES) {
      console.log(`    ${move.padEnd(8)}: ${(globalCounts[move] / globalTotal * 100).toFixed(2)}%`);
    }

    // Find most biased opponents
    const biases = [];
    for (const [enemyId, counts] of perOpponentFreq) {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total > 50) {
        const maxMove = this.argmax(counts);
        const bias = counts[maxMove] / total;
        biases.push({ enemyId, maxMove, bias, total });
      }
    }
    biases.sort((a, b) => b.bias - a.bias);

    console.log('\n  Top 10 Most Biased Opponents:');
    for (const b of biases.slice(0, 10)) {
      console.log(`    Enemy ${b.enemyId.padEnd(12)}: ${(b.bias * 100).toFixed(1)}% ${b.maxMove} (${b.total} battles)`);
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  Prediction accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%\n`);

    this.results.frequencyBias = { globalCounts, accuracy, biases: biases.slice(0, 20) };
    return { globalCounts, accuracy };
  }

  // ==================== EXPERIMENT 8: History Match ====================
  async experimentHistoryMatch() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 8: History Match Predictor');
    console.log('=' .repeat(60));

    // Look for repeating sequences
    const windowSizes = [2, 3, 4, 5];
    const results = [];

    for (const windowSize of windowSizes) {
      const stats = { predictions: 0, correct: 0 };
      const opponentHistory = new Map();

      let lastEnemyId = null;
      for (const battle of this.battles) {
        const enemyId = String(battle.enemy_id);
        const { enemy_move } = battle;

        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          opponentHistory.set(enemyId, []);
        }

        const history = opponentHistory.get(enemyId);

        if (history.length >= windowSize) {
          // Look for matching pattern in history
          const pattern = history.slice(-windowSize).join('');
          let found = false;

          for (let i = 0; i < history.length - windowSize; i++) {
            const candidate = history.slice(i, i + windowSize).join('');
            if (candidate === pattern && i + windowSize < history.length) {
              // Found match! Predict what came after
              const predicted = history[i + windowSize];
              stats.predictions++;
              if (predicted === enemy_move) stats.correct++;
              found = true;
              break;
            }
          }
        }

        history.push(enemy_move);
      }

      const accuracy = stats.predictions > 0 ? stats.correct / stats.predictions * 100 : 0;
      results.push({ windowSize, accuracy, predictions: stats.predictions });
      console.log(`  Window ${windowSize}: ${accuracy.toFixed(2)}% (${stats.predictions} predictions)`);
    }

    const best = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`\n  Best: Window ${best.windowSize} at ${best.accuracy.toFixed(2)}%\n`);

    this.results.historyMatch = results;
    return results;
  }

  // ==================== Run All Experiments ====================
  async runAll() {
    console.log('\n🧪 COMPREHENSIVE ALGORITHM EXPERIMENTS');
    console.log('=' .repeat(60));

    await this.connect();
    await this.loadBattles();

    await this.experimentCTWDepth();
    await this.experimentPerOpponent();
    await this.experimentTransitionMatrix();
    await this.experimentAntiRotation();
    await this.experimentRecencyWeighting();
    await this.experimentConditionalPatterns();
    await this.experimentFrequencyBias();
    await this.experimentHistoryMatch();

    // Summary
    console.log('=' .repeat(60));
    console.log('SUMMARY');
    console.log('=' .repeat(60));

    const summary = [
      { name: 'CTW Depth', best: this.results.ctwDepth?.reduce((a, b) => a.accuracy > b.accuracy ? a : b) },
      { name: 'Transition Matrix', accuracy: this.results.transitionMatrix?.accuracy },
      { name: 'Anti-Rotation', accuracy: this.results.antiRotation?.accuracy },
      { name: 'Recency Weighting', best: this.results.recencyWeighting?.reduce((a, b) => a.accuracy > b.accuracy ? a : b) },
      { name: 'Conditional', accuracy: this.results.conditionalPatterns?.accuracy },
      { name: 'Frequency Bias', accuracy: this.results.frequencyBias?.accuracy },
      { name: 'History Match', best: this.results.historyMatch?.reduce((a, b) => a.accuracy > b.accuracy ? a : b) },
    ];

    for (const s of summary) {
      if (s.best) {
        console.log(`  ${s.name.padEnd(20)}: ${s.best.accuracy?.toFixed(2)}%`);
      } else if (s.accuracy) {
        console.log(`  ${s.name.padEnd(20)}: ${s.accuracy.toFixed(2)}%`);
      }
    }

    console.log('\n  Baseline Random: 33.33%');
    console.log('  Current Best (CTW-6): ~34.40%\n');

    // Save results
    fs.writeFileSync('./data/experiment-results.json', JSON.stringify(this.results, null, 2));
    console.log('Results saved to data/experiment-results.json\n');

    this.db.close();
    return this.results;
  }
}

const runner = new ExperimentRunner();
runner.runAll().catch(console.error);
