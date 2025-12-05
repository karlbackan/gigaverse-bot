/**
 * Round 5 Experiments - Recent history and pattern strength
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';
import fs from 'fs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class ExperimentRunner5 {
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

  // ==================== EXPERIMENT 24: Recent Window CTW ====================
  async experimentRecentWindow() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 24: Recent Window CTW (last N only)');
    console.log('=' .repeat(60));

    // Only use last N moves per opponent
    const windows = [10, 20, 50, 100, 200, 500, 'all'];
    const results = [];

    for (const window of windows) {
      const stats = { predictions: 0, correct: 0 };
      const models = new Map();
      const histories = new Map();

      let lastEnemyId = null;
      for (const battle of this.battles) {
        const enemyId = String(battle.enemy_id);
        const { enemy_move } = battle;

        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          models.set(enemyId, new ContextTreeWeighting(3));
          histories.set(enemyId, []);
        }

        const ctw = models.get(enemyId);
        const history = histories.get(enemyId);

        if (ctw.history.length >= 1) {
          const probs = ctw.predict();
          if (probs) {
            const predicted = this.argmax(probs);
            stats.predictions++;
            if (predicted === enemy_move) stats.correct++;
          }
        }

        // Update CTW
        ctw.update(enemy_move);
        history.push(enemy_move);

        // Window limit: rebuild CTW with only recent moves
        if (window !== 'all' && history.length > window) {
          // Reset and rebuild with last N moves
          const newCtw = new ContextTreeWeighting(3);
          const recentMoves = history.slice(-window);
          for (const m of recentMoves) {
            newCtw.update(m);
          }
          models.set(enemyId, newCtw);
        }
      }

      const accuracy = stats.correct / stats.predictions * 100;
      results.push({ window, accuracy });
      console.log(`  Window ${String(window).padEnd(5)}: ${accuracy.toFixed(2)}%`);
    }

    const best = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`\n  Best: Window ${best.window} at ${best.accuracy.toFixed(2)}%\n`);

    this.results.recentWindow = results;
    return results;
  }

  // ==================== EXPERIMENT 25: Pattern Strength Filter ====================
  async experimentPatternStrength() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 25: Pattern Strength Filter');
    console.log('=' .repeat(60));

    // Only predict when CTW max probability exceeds threshold
    const thresholds = [0.33, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60];
    const results = [];

    for (const threshold of thresholds) {
      const stats = { predictions: 0, correct: 0, skipped: 0 };
      const models = new Map();

      let lastEnemyId = null;
      for (const battle of this.battles) {
        const enemyId = String(battle.enemy_id);
        const { enemy_move } = battle;

        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          models.set(enemyId, new ContextTreeWeighting(3));
        }

        const ctw = models.get(enemyId);

        if (ctw.history.length >= 1) {
          const probs = ctw.predict();
          if (probs) {
            const maxProb = Math.max(probs.rock, probs.paper, probs.scissor);

            if (maxProb >= threshold) {
              const predicted = this.argmax(probs);
              stats.predictions++;
              if (predicted === enemy_move) stats.correct++;
            } else {
              stats.skipped++;
            }
          }
        }

        ctw.update(enemy_move);
      }

      const accuracy = stats.predictions > 0 ? stats.correct / stats.predictions * 100 : 0;
      const coverage = stats.predictions / (stats.predictions + stats.skipped) * 100;
      results.push({ threshold, accuracy, coverage, predictions: stats.predictions });
      console.log(`  Threshold ${threshold.toFixed(2)}: ${accuracy.toFixed(2)}% accuracy (${coverage.toFixed(1)}% coverage, ${stats.predictions} predictions)`);
    }

    console.log('\n  Trade-off: Higher threshold = higher accuracy but fewer predictions');
    console.log('  Optimal depends on whether we can abstain from low-confidence rounds\n');

    this.results.patternStrength = results;
    return results;
  }

  // ==================== EXPERIMENT 26: Opponent Volatility ====================
  async experimentVolatility() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 26: Opponent Volatility Analysis');
    console.log('=' .repeat(60));

    // Do some opponents change strategy mid-game?
    // Compare first half vs second half performance
    const opponentData = new Map();
    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(3));
        opponentData.set(enemyId, {
          firstHalf: { predictions: 0, correct: 0 },
          secondHalf: { predictions: 0, correct: 0 },
          total: 0
        });
      }

      const ctw = models.get(enemyId);
      const data = opponentData.get(enemyId);
      data.total++;

      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          const isCorrect = predicted === enemy_move;

          // Determine which half based on opponent's battle count
          const count = opponentData.get(enemyId).total;
          // We'll finalize half assignment after all battles
          if (!data.allPredictions) data.allPredictions = [];
          data.allPredictions.push(isCorrect);
        }
      }

      ctw.update(enemy_move);
    }

    // Analyze volatility
    const volatilityAnalysis = [];
    for (const [enemyId, data] of opponentData) {
      if (data.allPredictions && data.allPredictions.length > 30) {
        const mid = Math.floor(data.allPredictions.length / 2);
        const firstHalf = data.allPredictions.slice(0, mid);
        const secondHalf = data.allPredictions.slice(mid);

        const firstAcc = firstHalf.filter(x => x).length / firstHalf.length * 100;
        const secondAcc = secondHalf.filter(x => x).length / secondHalf.length * 100;
        const volatility = Math.abs(secondAcc - firstAcc);

        volatilityAnalysis.push({
          enemyId,
          firstAcc,
          secondAcc,
          volatility,
          trend: secondAcc > firstAcc ? 'improving' : (secondAcc < firstAcc ? 'degrading' : 'stable'),
          battles: data.total
        });
      }
    }

    volatilityAnalysis.sort((a, b) => b.volatility - a.volatility);

    console.log('\n  Most Volatile Opponents (strategy change):');
    console.log('  ' + '-'.repeat(60));
    for (const v of volatilityAnalysis.slice(0, 10)) {
      console.log(`    Enemy ${v.enemyId.padEnd(12)}: 1st half ${v.firstAcc.toFixed(1)}% -> 2nd half ${v.secondAcc.toFixed(1)}% (${v.trend})`);
    }

    const avgVolatility = volatilityAnalysis.reduce((sum, v) => sum + v.volatility, 0) / volatilityAnalysis.length;
    console.log(`\n  Average volatility: ${avgVolatility.toFixed(2)}%`);

    this.results.volatility = volatilityAnalysis;
    return volatilityAnalysis;
  }

  // ==================== EXPERIMENT 27: Win Rate vs Accuracy ====================
  async experimentWinRate() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 27: Win Rate Calculation');
    console.log('=' .repeat(60));

    // Calculate actual win rate, not just prediction accuracy
    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

    const stats = { wins: 0, losses: 0, draws: 0, total: 0 };
    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(3));
      }

      const ctw = models.get(enemyId);

      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          const ourMove = counter[predicted];  // Counter the predicted enemy move

          stats.total++;
          if (ourMove === counter[enemy_move]) {
            stats.wins++;  // We beat them
          } else if (enemy_move === counter[ourMove]) {
            stats.losses++;  // They beat us
          } else {
            stats.draws++;
          }
        }
      }

      ctw.update(enemy_move);
    }

    const winRate = stats.wins / stats.total * 100;
    const lossRate = stats.losses / stats.total * 100;
    const drawRate = stats.draws / stats.total * 100;

    console.log('\n  If we counter CTW predictions:');
    console.log(`    Win rate:  ${winRate.toFixed(2)}%`);
    console.log(`    Loss rate: ${lossRate.toFixed(2)}%`);
    console.log(`    Draw rate: ${drawRate.toFixed(2)}%`);
    console.log(`\n  Net advantage: ${(winRate - lossRate).toFixed(2)}%`);
    console.log('  (Random would be 33.3% / 33.3% / 33.3% with 0% net)\n');

    this.results.winRate = { winRate, lossRate, drawRate, netAdvantage: winRate - lossRate };
    return { winRate, lossRate, drawRate };
  }

  // ==================== Run All ====================
  async runAll() {
    console.log('\n🧪 ROUND 5 EXPERIMENTS');
    console.log('=' .repeat(60));

    await this.connect();
    await this.loadBattles();

    await this.experimentRecentWindow();
    await this.experimentPatternStrength();
    await this.experimentVolatility();
    await this.experimentWinRate();

    // Summary
    console.log('=' .repeat(60));
    console.log('ROUND 5 SUMMARY');
    console.log('=' .repeat(60));

    const windowBest = this.results.recentWindow?.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`  Best Window:     ${windowBest?.window} at ${windowBest?.accuracy?.toFixed(2)}%`);
    console.log(`  Pattern Strength: See trade-off table above`);
    console.log(`  Net Win Rate:    ${this.results.winRate?.netAdvantage?.toFixed(2)}%`);
    console.log('\n  Baseline: 34.90% accuracy, ~1.6% net advantage\n');

    // Append to results
    const existing = JSON.parse(fs.readFileSync('./data/experiment-results.json', 'utf8'));
    const combined = { ...existing, ...this.results };
    fs.writeFileSync('./data/experiment-results.json', JSON.stringify(combined, null, 2));
    console.log('Results appended to data/experiment-results.json\n');

    this.db.close();
    return this.results;
  }
}

const runner = new ExperimentRunner5();
runner.runAll().catch(console.error);
