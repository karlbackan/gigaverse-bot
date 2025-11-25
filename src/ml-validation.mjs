/**
 * ML Model Validation Script
 *
 * Tests for overfitting using:
 * 1. Train/Test split (80/20)
 * 2. Leave-one-enemy-out cross-validation
 * 3. Temporal validation (train on old, test on new)
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { MLDecisionEngine } from './ml-decision-engine.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class MLValidator {
  constructor() {
    this.db = null;
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

  /**
   * Get all battles grouped by enemy
   */
  async getBattlesByEnemy() {
    const sql = `
      SELECT enemy_id, player_move, enemy_move, result, turn,
             player_health, enemy_health, timestamp
      FROM battles
      WHERE player_move IN ('rock', 'paper', 'scissor')
        AND enemy_move IN ('rock', 'paper', 'scissor')
      ORDER BY enemy_id, timestamp
    `;
    const battles = await this.query(sql);

    // Group by enemy
    const byEnemy = new Map();
    for (const battle of battles) {
      const enemyId = String(battle.enemy_id);
      if (!byEnemy.has(enemyId)) {
        byEnemy.set(enemyId, []);
      }
      byEnemy.get(enemyId).push(battle);
    }
    return byEnemy;
  }

  /**
   * Train a fresh ML engine on given battles
   */
  trainOnBattles(battles) {
    const engine = new MLDecisionEngine();

    for (const battle of battles) {
      const enemyId = String(battle.enemy_id);
      const { player_move, enemy_move, result, turn, player_health, enemy_health } = battle;

      // Update CTW
      engine.ensureCTWModel(enemyId);
      engine.ctwModels.get(enemyId).update(enemy_move);

      // Update Iocaine
      engine.iocaine.update(enemyId, player_move, enemy_move);

      // Update RNN
      engine.ensureRNNModel(enemyId);
      engine.rnnModels.get(enemyId).update(player_move, enemy_move);

      // Update Bayesian
      engine.bayesian.update(enemyId, player_move, enemy_move);

      // Update opponent model
      engine.ensureOpponentModel(enemyId);
      engine.updateOpponentModel(enemyId, enemy_move, result, turn);
    }

    return engine;
  }

  /**
   * Test engine predictions on battles
   * Returns accuracy metrics
   */
  testOnBattles(engine, battles) {
    const results = {
      total: 0,
      correct: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      byStrategy: {}
    };

    for (const battle of battles) {
      const enemyId = String(battle.enemy_id);
      const actualEnemyMove = battle.enemy_move;

      // Get predictions from each strategy
      const predictions = this.getPredictions(engine, enemyId);

      for (const [strategy, prediction] of Object.entries(predictions)) {
        if (!results.byStrategy[strategy]) {
          results.byStrategy[strategy] = { correct: 0, wins: 0, total: 0 };
        }

        if (prediction === actualEnemyMove) {
          results.byStrategy[strategy].correct++;
        }

        // Check if our counter would win
        const counter = this.getCounter(prediction);
        if (counter === this.getCounter(actualEnemyMove)) {
          results.byStrategy[strategy].wins++;
        } else if (this.getCounter(actualEnemyMove) === counter) {
          // We win if our counter beats their actual move
          if (this.beats(counter, actualEnemyMove)) {
            results.byStrategy[strategy].wins++;
          }
        }

        results.byStrategy[strategy].total++;
      }

      results.total++;
    }

    return results;
  }

  getPredictions(engine, enemyId) {
    const predictions = {};

    // CTW prediction
    engine.ensureCTWModel(enemyId);
    const ctwModel = engine.ctwModels.get(enemyId);
    const ctwProbs = ctwModel.predict();
    predictions.ctw = this.argmax(ctwProbs);

    // Iocaine prediction (uses getMoveProbabilities)
    const iocaineProbs = engine.iocaine.getMoveProbabilities(enemyId);
    predictions.iocaine = this.argmax(iocaineProbs);

    // RNN prediction
    engine.ensureRNNModel(enemyId);
    const rnnProbs = engine.rnnModels.get(enemyId).predict();
    predictions.rnn = this.argmax(rnnProbs);

    // Bayesian prediction
    const bayesianProbs = engine.bayesian.predict(enemyId);
    predictions.bayesian = this.argmax(bayesianProbs);

    // Random baseline
    predictions.random = MOVES[Math.floor(Math.random() * 3)];

    return predictions;
  }

  argmax(probs) {
    const entries = Object.entries(probs);
    let best = entries[0];
    for (const entry of entries) {
      if (entry[1] > best[1]) best = entry;
    }
    return best[0];
  }

  getCounter(move) {
    return { rock: 'paper', paper: 'scissor', scissor: 'rock' }[move];
  }

  beats(a, b) {
    return (a === 'rock' && b === 'scissor') ||
           (a === 'paper' && b === 'rock') ||
           (a === 'scissor' && b === 'paper');
  }

  /**
   * Validation 1: Simple 80/20 train/test split
   */
  async trainTestSplit() {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION 1: 80/20 Train/Test Split');
    console.log('='.repeat(60));

    const byEnemy = await this.getBattlesByEnemy();
    const allBattles = [];

    for (const battles of byEnemy.values()) {
      allBattles.push(...battles);
    }

    // Shuffle
    for (let i = allBattles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allBattles[i], allBattles[j]] = [allBattles[j], allBattles[i]];
    }

    const splitIdx = Math.floor(allBattles.length * 0.8);
    const trainBattles = allBattles.slice(0, splitIdx);
    const testBattles = allBattles.slice(splitIdx);

    console.log(`Training on ${trainBattles.length} battles...`);
    const engine = this.trainOnBattles(trainBattles);

    console.log(`Testing on ${testBattles.length} battles...`);
    const results = this.testOnBattles(engine, testBattles);

    console.log('\nPrediction Accuracy (predicting enemy move):');
    for (const [strategy, stats] of Object.entries(results.byStrategy)) {
      const accuracy = (stats.correct / stats.total * 100).toFixed(1);
      console.log(`  ${strategy.padEnd(12)}: ${accuracy}% (${stats.correct}/${stats.total})`);
    }

    return results;
  }

  /**
   * Validation 2: Leave-one-enemy-out (tests generalization to new enemies)
   */
  async leaveOneEnemyOut() {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION 2: Leave-One-Enemy-Out Cross-Validation');
    console.log('='.repeat(60));
    console.log('(Tests if models generalize to UNSEEN enemies)\n');

    const byEnemy = await this.getBattlesByEnemy();
    const enemies = Array.from(byEnemy.keys());

    const aggregatedResults = {};

    // Only test on enemies with enough battles
    const validEnemies = enemies.filter(e => byEnemy.get(e).length >= 10);
    console.log(`Testing on ${validEnemies.length} enemies with 10+ battles...\n`);

    let processed = 0;
    for (const testEnemy of validEnemies) {
      // Train on all OTHER enemies
      const trainBattles = [];
      for (const [enemyId, battles] of byEnemy) {
        if (enemyId !== testEnemy) {
          trainBattles.push(...battles);
        }
      }

      const engine = this.trainOnBattles(trainBattles);
      const testBattles = byEnemy.get(testEnemy);
      const results = this.testOnBattles(engine, testBattles);

      // Aggregate
      for (const [strategy, stats] of Object.entries(results.byStrategy)) {
        if (!aggregatedResults[strategy]) {
          aggregatedResults[strategy] = { correct: 0, total: 0 };
        }
        aggregatedResults[strategy].correct += stats.correct;
        aggregatedResults[strategy].total += stats.total;
      }

      processed++;
      if (processed % 10 === 0) {
        process.stdout.write(`  Progress: ${processed}/${validEnemies.length}\r`);
      }
    }

    console.log('\nPrediction Accuracy on UNSEEN enemies:');
    for (const [strategy, stats] of Object.entries(aggregatedResults)) {
      const accuracy = (stats.correct / stats.total * 100).toFixed(1);
      console.log(`  ${strategy.padEnd(12)}: ${accuracy}%`);
    }

    console.log('\n⚠️  If accuracy ~33%, models are NOT generalizing to new enemies');
    console.log('   (they may be overfitting to enemy-specific patterns)');

    return aggregatedResults;
  }

  /**
   * Validation 3: Temporal split (train on first 80% of time, test on last 20%)
   */
  async temporalValidation() {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION 3: Temporal Validation');
    console.log('='.repeat(60));
    console.log('(Train on older battles, test on newer ones)\n');

    const byEnemy = await this.getBattlesByEnemy();

    // For each enemy, split temporally
    const trainBattles = [];
    const testBattles = [];

    for (const [enemyId, battles] of byEnemy) {
      // Battles should already be sorted by timestamp
      const splitIdx = Math.floor(battles.length * 0.8);
      trainBattles.push(...battles.slice(0, splitIdx));
      testBattles.push(...battles.slice(splitIdx));
    }

    console.log(`Training on first ${trainBattles.length} battles (older)...`);
    const engine = this.trainOnBattles(trainBattles);

    console.log(`Testing on last ${testBattles.length} battles (newer)...`);
    const results = this.testOnBattles(engine, testBattles);

    console.log('\nPrediction Accuracy on FUTURE battles:');
    for (const [strategy, stats] of Object.entries(results.byStrategy)) {
      const accuracy = (stats.correct / stats.total * 100).toFixed(1);
      console.log(`  ${strategy.padEnd(12)}: ${accuracy}%`);
    }

    console.log('\n⚠️  If accuracy drops significantly from train/test split,');
    console.log('   models may be overfitting to temporal patterns');

    return results;
  }

  /**
   * Run all validations
   */
  async runAll() {
    console.log('🔬 ML MODEL VALIDATION');
    console.log('Testing for overfitting and generalization...\n');

    await this.connect();

    const results = {
      trainTest: await this.trainTestSplit(),
      leaveOneOut: await this.leaveOneEnemyOut(),
      temporal: await this.temporalValidation()
    };

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    console.log('\nRandom baseline: 33.3% (expected for unpredictable opponents)');
    console.log('\nInterpretation:');
    console.log('  - Train/Test ~33%: Models learn nothing useful');
    console.log('  - Train/Test >35% but Leave-One-Out ~33%: Overfitting to specific enemies');
    console.log('  - All tests >35%: Models are learning generalizable patterns');
    console.log('  - Temporal << Train/Test: Concept drift (enemy behavior changes over time)');

    this.db.close();
    return results;
  }
}

// Run validation
const validator = new MLValidator();
validator.runAll().catch(console.error);
