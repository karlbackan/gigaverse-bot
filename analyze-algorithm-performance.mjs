/**
 * Analyze which ML algorithms perform best on historical data
 * Tests each algorithm's prediction accuracy in sequential order (no shuffling)
 */

import sqlite3 from 'sqlite3';
import { MLDecisionEngine } from './src/ml-decision-engine.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class AlgorithmAnalyzer {
  constructor() {
    this.db = null;
    this.engine = new MLDecisionEngine();
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

  async analyze() {
    console.log('🔬 ALGORITHM PERFORMANCE ANALYSIS');
    console.log('=' .repeat(60));
    console.log('Testing each algorithm on historical data (sequential order)\n');

    await this.connect();

    // Get battles ordered by enemy and time
    const battles = await this.query(`
      SELECT enemy_id, player_move, enemy_move, result, turn, timestamp
      FROM battles
      WHERE player_move IN ('rock', 'paper', 'scissor')
        AND enemy_move IN ('rock', 'paper', 'scissor')
      ORDER BY enemy_id, timestamp
    `);

    console.log(`📊 Loaded ${battles.length} battles\n`);

    // Track stats per algorithm
    const stats = {
      ctw: { predictions: 0, correct: 0, wins: 0 },
      iocaine: { predictions: 0, correct: 0, wins: 0 },
      bayesian: { predictions: 0, correct: 0, wins: 0 },
      rnn: { predictions: 0, correct: 0, wins: 0 },
      charge_bias: { predictions: 0, correct: 0, wins: 0 },
      random: { predictions: 0, correct: 0, wins: 0 }
    };

    // Process battles sequentially
    let lastEnemyId = null;
    let battleCount = 0;

    for (const battle of battles) {
      const enemyId = String(battle.enemy_id);
      const { player_move, enemy_move, result, turn } = battle;

      // Skip first few battles per enemy (need history to predict)
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        // Initialize models for new enemy
        this.engine.ensureCTWModel(enemyId);
        this.engine.ensureRNNModel(enemyId);
        this.engine.ensureOpponentModel(enemyId);
      }

      battleCount++;

      // Get predictions BEFORE updating (predict, then learn)
      const predictions = {};

      // CTW prediction
      try {
        const ctwModel = this.engine.ctwModels.get(enemyId);
        if (ctwModel && ctwModel.history.length >= 1) {
          const ctwProbs = ctwModel.predict();
          if (ctwProbs) predictions.ctw = this.argmax(ctwProbs);
        }
      } catch (e) {}

      // Iocaine prediction (use enemy move probabilities, not our counter-moves)
      try {
        const iocaineProbs = this.engine.iocaine.getEnemyMoveProbabilities(enemyId);
        if (iocaineProbs) {
          predictions.iocaine = this.argmax(iocaineProbs);
        }
      } catch (e) {}

      // Bayesian prediction
      try {
        const bayesianProbs = this.engine.bayesian.predict(enemyId);
        if (bayesianProbs) {
          predictions.bayesian = this.argmax(bayesianProbs);
        }
      } catch (e) {}

      // RNN prediction
      try {
        const rnnModel = this.engine.rnnModels.get(enemyId);
        if (rnnModel && rnnModel.history.length >= 1) {
          const rnnProbs = rnnModel.predict();
          if (rnnProbs) predictions.rnn = this.argmax(rnnProbs);
        }
      } catch (e) {}

      // Random baseline
      predictions.random = MOVES[Math.floor(Math.random() * 3)];

      // Score predictions
      for (const [algo, predictedEnemyMove] of Object.entries(predictions)) {
        if (!predictedEnemyMove) continue;

        stats[algo].predictions++;

        // Correct prediction?
        if (predictedEnemyMove === enemy_move) {
          stats[algo].correct++;
        }

        // Would our counter win?
        const ourMove = this.getCounter(predictedEnemyMove);
        if (this.beats(ourMove, enemy_move)) {
          stats[algo].wins++;
        }
      }

      // Now update models with actual result
      this.engine.ctwModels.get(enemyId)?.update(enemy_move);
      this.engine.iocaine.update(enemyId, player_move, enemy_move);
      this.engine.rnnModels.get(enemyId)?.update(player_move, enemy_move);
      this.engine.bayesian.update(enemyId, player_move, enemy_move);
      this.engine.updateOpponentModel(enemyId, enemy_move, result, turn);

      // Progress
      if (battleCount % 5000 === 0) {
        process.stdout.write(`  Processed ${battleCount}/${battles.length} battles...\r`);
      }
    }

    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📊 ALGORITHM PERFORMANCE RESULTS');
    console.log('=' .repeat(60));
    console.log('\nPrediction Accuracy (predicting enemy move correctly):');
    console.log('-'.repeat(50));

    const results = [];
    for (const [algo, s] of Object.entries(stats)) {
      if (s.predictions === 0) continue;
      const accuracy = (s.correct / s.predictions * 100);
      const winRate = (s.wins / s.predictions * 100);
      results.push({ algo, accuracy, winRate, predictions: s.predictions });
    }

    // Sort by accuracy
    results.sort((a, b) => b.accuracy - a.accuracy);

    console.log('Algorithm     | Predictions | Accuracy | Win Rate | vs Random');
    console.log('-'.repeat(60));

    const randomAccuracy = results.find(r => r.algo === 'random')?.accuracy || 33.3;

    for (const r of results) {
      const diff = (r.accuracy - randomAccuracy).toFixed(1);
      const marker = r.accuracy > 34 ? '✅' : (r.accuracy < 33 ? '❌' : '');
      console.log(
        `${r.algo.padEnd(13)} | ${String(r.predictions).padStart(11)} | ${r.accuracy.toFixed(1).padStart(6)}% | ${r.winRate.toFixed(1).padStart(6)}% | ${diff > 0 ? '+' : ''}${diff}% ${marker}`
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 INTERPRETATION');
    console.log('='.repeat(60));
    console.log('- Random baseline: 33.3% accuracy');
    console.log('- Any algorithm > 34% is providing value');
    console.log('- Win rate shows how often counter-move would win');
    console.log('- Accuracy > Win rate means predictions help avoid losses too\n');

    this.db.close();
    return results;
  }
}

const analyzer = new AlgorithmAnalyzer();
analyzer.analyze().catch(console.error);
