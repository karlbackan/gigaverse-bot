/**
 * Round 3 Experiments - Lag patterns and voting
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';
import fs from 'fs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class ExperimentRunner3 {
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
      SELECT enemy_id, player_move, enemy_move, result, turn
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

  // ==================== EXPERIMENT 15: Lag-N Patterns ====================
  async experimentLagPatterns() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 15: Lag-N Patterns (N moves ago predicts now)');
    console.log('=' .repeat(60));

    // Do patterns from N moves ago predict current move?
    const lags = [1, 2, 3, 4, 5];
    const results = [];

    for (const lag of lags) {
      const transitions = {};
      for (const from of MOVES) {
        transitions[from] = { rock: 0, paper: 0, scissor: 0 };
      }

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

        if (history.length >= lag) {
          const lagMove = history[history.length - lag];

          // Predict based on lag transition
          const trans = transitions[lagMove];
          const total = trans.rock + trans.paper + trans.scissor;
          if (total > 100) {
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
          transitions[lagMove][enemy_move]++;
        }

        history.push(enemy_move);
      }

      const accuracy = stats.correct / stats.predictions * 100;
      results.push({ lag, accuracy });
      console.log(`  Lag-${lag}: ${accuracy.toFixed(2)}%`);
    }

    const best = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`\n  Best: Lag-${best.lag} at ${best.accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(best.accuracy - 33.3).toFixed(2)}%\n`);

    this.results.lagPatterns = results;
    return results;
  }

  // ==================== EXPERIMENT 16: Majority Voting ====================
  async experimentMajorityVoting() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 16: Majority Voting Ensemble');
    console.log('=' .repeat(60));

    // Use multiple predictors and take majority vote
    const stats = {
      ctw2: { predictions: 0, correct: 0 },
      ctw3: { predictions: 0, correct: 0 },
      freq: { predictions: 0, correct: 0 },
      majority: { predictions: 0, correct: 0 }
    };

    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, {
          ctw2: new ContextTreeWeighting(2),
          ctw3: new ContextTreeWeighting(3),
          freq: { rock: 1, paper: 1, scissor: 1 }
        });
      }

      const m = models.get(enemyId);
      const votes = [];

      // CTW-2 vote
      if (m.ctw2.history.length >= 1) {
        const p = m.ctw2.predict();
        if (p) {
          const pred = this.argmax(p);
          votes.push(pred);
          stats.ctw2.predictions++;
          if (pred === enemy_move) stats.ctw2.correct++;
        }
      }

      // CTW-3 vote
      if (m.ctw3.history.length >= 1) {
        const p = m.ctw3.predict();
        if (p) {
          const pred = this.argmax(p);
          votes.push(pred);
          stats.ctw3.predictions++;
          if (pred === enemy_move) stats.ctw3.correct++;
        }
      }

      // Frequency vote
      const freqTotal = m.freq.rock + m.freq.paper + m.freq.scissor;
      if (freqTotal > 5) {
        const pred = this.argmax(m.freq);
        votes.push(pred);
        stats.freq.predictions++;
        if (pred === enemy_move) stats.freq.correct++;
      }

      // Majority vote
      if (votes.length >= 2) {
        const counts = { rock: 0, paper: 0, scissor: 0 };
        for (const v of votes) counts[v]++;
        const majority = this.argmax(counts);
        stats.majority.predictions++;
        if (majority === enemy_move) stats.majority.correct++;
      }

      // Update models
      m.ctw2.update(enemy_move);
      m.ctw3.update(enemy_move);
      m.freq[enemy_move]++;
    }

    console.log('\n  Individual Predictor Accuracy:');
    for (const [name, s] of Object.entries(stats)) {
      const acc = s.correct / s.predictions * 100;
      console.log(`    ${name.padEnd(10)}: ${acc.toFixed(2)}%`);
    }

    this.results.majorityVoting = stats;
    return stats;
  }

  // ==================== EXPERIMENT 17: Double Move Patterns ====================
  async experimentDoubleMovePatterns() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 17: Double Move Patterns (2-gram)');
    console.log('=' .repeat(60));

    // Look at pairs of consecutive moves as a pattern
    const bigramCounts = {};  // "rock,paper" -> {rock: x, paper: y, scissor: z}

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

      if (history.length >= 2) {
        const bigram = `${history[history.length - 2]},${history[history.length - 1]}`;

        if (!bigramCounts[bigram]) {
          bigramCounts[bigram] = { rock: 0, paper: 0, scissor: 0 };
        }

        const counts = bigramCounts[bigram];
        const total = counts.rock + counts.paper + counts.scissor;

        if (total > 20) {
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

      history.push(enemy_move);
    }

    // Find most predictive bigrams
    const bigramStats = [];
    for (const [bigram, counts] of Object.entries(bigramCounts)) {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total > 100) {
        const maxMove = this.argmax(counts);
        const maxProb = counts[maxMove] / total;
        bigramStats.push({ bigram, maxMove, maxProb, total });
      }
    }
    bigramStats.sort((a, b) => b.maxProb - a.maxProb);

    console.log('\n  Most Predictive 2-grams:');
    for (const b of bigramStats.slice(0, 10)) {
      console.log(`    After [${b.bigram.padEnd(15)}] -> ${b.maxMove} (${(b.maxProb * 100).toFixed(1)}%, n=${b.total})`);
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  Prediction accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%\n`);

    this.results.doubleMovePatterns = { accuracy, topBigrams: bigramStats.slice(0, 20) };
    return { accuracy };
  }

  // ==================== EXPERIMENT 18: Joint Player-Enemy Sequence ====================
  async experimentJointSequence() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 18: Joint Player-Enemy Sequence');
    console.log('=' .repeat(60));

    // Track (our_move, their_move) pairs and predict next their_move
    const jointCounts = {};  // "rock,paper" -> {rock: x, paper: y, scissor: z}

    const stats = { predictions: 0, correct: 0 };
    const lastJoint = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { player_move, enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        lastJoint.delete(enemyId);
      }

      const lastPair = lastJoint.get(enemyId);
      if (lastPair) {
        if (!jointCounts[lastPair]) {
          jointCounts[lastPair] = { rock: 0, paper: 0, scissor: 0 };
        }

        const counts = jointCounts[lastPair];
        const total = counts.rock + counts.paper + counts.scissor;

        if (total > 30) {
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

      lastJoint.set(enemyId, `${player_move},${enemy_move}`);
    }

    // Find most predictive joint patterns
    const jointStats = [];
    for (const [pair, counts] of Object.entries(jointCounts)) {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total > 100) {
        const maxMove = this.argmax(counts);
        const maxProb = counts[maxMove] / total;
        jointStats.push({ pair, maxMove, maxProb, total });
      }
    }
    jointStats.sort((a, b) => b.maxProb - a.maxProb);

    console.log('\n  Most Predictive Joint Patterns (us,them -> next_them):');
    for (const j of jointStats.slice(0, 10)) {
      console.log(`    After (${j.pair.padEnd(15)}) -> ${j.maxMove} (${(j.maxProb * 100).toFixed(1)}%, n=${j.total})`);
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  Prediction accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%\n`);

    this.results.jointSequence = { accuracy, topPatterns: jointStats.slice(0, 20) };
    return { accuracy };
  }

  // ==================== EXPERIMENT 19: Optimal Fixed Strategy ====================
  async experimentOptimalFixed() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 19: Optimal Fixed Strategy');
    console.log('=' .repeat(60));

    // What if we just always played the globally best move?
    const globalCounts = { rock: 0, paper: 0, scissor: 0 };

    for (const battle of this.battles) {
      globalCounts[battle.enemy_move]++;
    }

    const total = globalCounts.rock + globalCounts.paper + globalCounts.scissor;
    console.log('\n  Global Enemy Distribution:');
    for (const move of MOVES) {
      console.log(`    ${move.padEnd(8)}: ${(globalCounts[move] / total * 100).toFixed(2)}%`);
    }

    // Best fixed counter
    const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    const mostCommon = this.argmax(globalCounts);
    const optimalFixed = counters[mostCommon];

    // Calculate win rate with optimal fixed
    let wins = 0;
    for (const battle of this.battles) {
      if (this.beats(optimalFixed, battle.enemy_move)) wins++;
    }
    const winRate = wins / this.battles.length * 100;

    console.log(`\n  Most common enemy move: ${mostCommon} (${(globalCounts[mostCommon] / total * 100).toFixed(2)}%)`);
    console.log(`  Optimal fixed strategy: Always play ${optimalFixed}`);
    console.log(`  Expected win rate: ${winRate.toFixed(2)}%`);
    console.log(`  vs Random win rate: 33.33%\n`);

    this.results.optimalFixed = { optimalFixed, winRate, globalCounts };
    return { optimalFixed, winRate };
  }

  // ==================== Run All ====================
  async runAll() {
    console.log('\n🧪 ROUND 3 EXPERIMENTS');
    console.log('=' .repeat(60));

    await this.connect();
    await this.loadBattles();

    await this.experimentLagPatterns();
    await this.experimentMajorityVoting();
    await this.experimentDoubleMovePatterns();
    await this.experimentJointSequence();
    await this.experimentOptimalFixed();

    // Summary
    console.log('=' .repeat(60));
    console.log('ROUND 3 SUMMARY');
    console.log('=' .repeat(60));

    const lagBest = this.results.lagPatterns?.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`  Best Lag:             Lag-${lagBest?.lag} at ${lagBest?.accuracy?.toFixed(2)}%`);
    console.log(`  Majority Voting:      ${(this.results.majorityVoting?.majority?.correct / this.results.majorityVoting?.majority?.predictions * 100)?.toFixed(2)}%`);
    console.log(`  Double Move (2-gram): ${this.results.doubleMovePatterns?.accuracy?.toFixed(2)}%`);
    console.log(`  Joint Sequence:       ${this.results.jointSequence?.accuracy?.toFixed(2)}%`);
    console.log(`  Optimal Fixed:        ${this.results.optimalFixed?.winRate?.toFixed(2)}% win rate`);
    console.log('\n  Baseline CTW depth-2: 34.83%\n');

    // Append to results
    const existing = JSON.parse(fs.readFileSync('./data/experiment-results.json', 'utf8'));
    const combined = { ...existing, ...this.results };
    fs.writeFileSync('./data/experiment-results.json', JSON.stringify(combined, null, 2));
    console.log('Results appended to data/experiment-results.json\n');

    this.db.close();
    return this.results;
  }
}

const runner = new ExperimentRunner3();
runner.runAll().catch(console.error);
