/**
 * Round 11 Experiments - Dynamic ensemble weighting
 * - Bayesian model averaging (weight by track record)
 * - Per-opponent optimal model selection
 * - Recency-weighted ensemble
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 11 EXPERIMENTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // ==================== EXPERIMENT 49: Bayesian Model Averaging ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 49: Bayesian Model Averaging');
  console.log('='.repeat(60));
  console.log('Weight models by their recent prediction accuracy\n');

  {
    // Track accuracy for CTW and 2-gram over rolling window
    const windowSize = 50;
    const stats = { wins: 0, losses: 0, total: 0 };

    // Global 2-gram
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    // Per-opponent CTW
    const ctwModels = new Map();

    // Track recent accuracy
    const ctwHistory = [];  // recent correct/incorrect for CTW
    const gramHistory = []; // recent correct/incorrect for 2-gram

    let lastEnemyId = null;
    let prev2 = [];

    for (const b of battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prev2 = [];
        if (!ctwModels.has(enemyId)) {
          ctwModels.set(enemyId, new ContextTreeWeighting(3));
        }
      }

      const ctw = ctwModels.get(enemyId);

      // Predict
      if (ctw.history.length >= 2 && prev2.length === 2) {
        // CTW prediction
        const ctwProbs = ctw.predict() || { rock: 1/3, paper: 1/3, scissor: 1/3 };
        const ctwPred = Object.entries(ctwProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];

        // 2-gram prediction
        const key2 = `${prev2[0]},${prev2[1]}`;
        const counts2 = gram2.get(key2);
        const total2 = counts2.rock + counts2.paper + counts2.scissor;
        let gramProbs = { rock: 1/3, paper: 1/3, scissor: 1/3 };
        if (total2 >= 5) {
          gramProbs = {
            rock: counts2.rock / total2,
            paper: counts2.paper / total2,
            scissor: counts2.scissor / total2
          };
        }
        const gramPred = Object.entries(gramProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];

        // Track accuracy
        const ctwCorrect = ctwPred === b.enemy_move ? 1 : 0;
        const gramCorrect = gramPred === b.enemy_move ? 1 : 0;

        ctwHistory.push(ctwCorrect);
        gramHistory.push(gramCorrect);

        if (ctwHistory.length > windowSize) ctwHistory.shift();
        if (gramHistory.length > windowSize) gramHistory.shift();

        // Calculate Bayesian weights based on recent accuracy
        const ctwAcc = ctwHistory.length > 10 ? ctwHistory.reduce((a, b) => a + b, 0) / ctwHistory.length : 0.5;
        const gramAcc = gramHistory.length > 10 ? gramHistory.reduce((a, b) => a + b, 0) / gramHistory.length : 0.5;

        // Normalize weights
        const totalAcc = ctwAcc + gramAcc;
        const ctwWeight = totalAcc > 0 ? ctwAcc / totalAcc : 0.5;
        const gramWeight = totalAcc > 0 ? gramAcc / totalAcc : 0.5;

        // Ensemble prediction with dynamic weights
        const ensembleProbs = {
          rock: ctwWeight * ctwProbs.rock + gramWeight * gramProbs.rock,
          paper: ctwWeight * ctwProbs.paper + gramWeight * gramProbs.paper,
          scissor: ctwWeight * ctwProbs.scissor + gramWeight * gramProbs.scissor
        };

        const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        const ourMove = counter[predicted];

        stats.total++;
        if (ourMove === counter[b.enemy_move]) stats.wins++;
        else if (b.enemy_move === counter[ourMove]) stats.losses++;
      }

      // Update models
      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        const key2 = `${prev2[0]},${prev2[1]}`;
        gram2.get(key2)[b.enemy_move]++;
      }

      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    const netAdv = (stats.wins - stats.losses) / stats.total * 100;
    console.log(`  Bayesian averaging (window=${windowSize}): Net ${netAdv.toFixed(2)}%`);
  }

  // Test different window sizes
  for (const windowSize of [20, 100, 200]) {
    const stats = { wins: 0, losses: 0, total: 0 };
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }
    const ctwModels = new Map();
    const ctwHistory = [];
    const gramHistory = [];
    let lastEnemyId = null;
    let prev2 = [];

    for (const b of battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prev2 = [];
        if (!ctwModels.has(enemyId)) {
          ctwModels.set(enemyId, new ContextTreeWeighting(3));
        }
      }

      const ctw = ctwModels.get(enemyId);

      if (ctw.history.length >= 2 && prev2.length === 2) {
        const ctwProbs = ctw.predict() || { rock: 1/3, paper: 1/3, scissor: 1/3 };
        const ctwPred = Object.entries(ctwProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];

        const key2 = `${prev2[0]},${prev2[1]}`;
        const counts2 = gram2.get(key2);
        const total2 = counts2.rock + counts2.paper + counts2.scissor;
        let gramProbs = { rock: 1/3, paper: 1/3, scissor: 1/3 };
        if (total2 >= 5) {
          gramProbs = {
            rock: counts2.rock / total2,
            paper: counts2.paper / total2,
            scissor: counts2.scissor / total2
          };
        }
        const gramPred = Object.entries(gramProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];

        ctwHistory.push(ctwPred === b.enemy_move ? 1 : 0);
        gramHistory.push(gramPred === b.enemy_move ? 1 : 0);
        if (ctwHistory.length > windowSize) ctwHistory.shift();
        if (gramHistory.length > windowSize) gramHistory.shift();

        const ctwAcc = ctwHistory.length > 10 ? ctwHistory.reduce((a, b) => a + b, 0) / ctwHistory.length : 0.5;
        const gramAcc = gramHistory.length > 10 ? gramHistory.reduce((a, b) => a + b, 0) / gramHistory.length : 0.5;
        const totalAcc = ctwAcc + gramAcc;
        const ctwWeight = totalAcc > 0 ? ctwAcc / totalAcc : 0.5;
        const gramWeight = totalAcc > 0 ? gramAcc / totalAcc : 0.5;

        const ensembleProbs = {
          rock: ctwWeight * ctwProbs.rock + gramWeight * gramProbs.rock,
          paper: ctwWeight * ctwProbs.paper + gramWeight * gramProbs.paper,
          scissor: ctwWeight * ctwProbs.scissor + gramWeight * gramProbs.scissor
        };

        const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        const ourMove = counter[predicted];

        stats.total++;
        if (ourMove === counter[b.enemy_move]) stats.wins++;
        else if (b.enemy_move === counter[ourMove]) stats.losses++;
      }

      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`  Bayesian averaging (window=${windowSize}): Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  console.log('\n  Fixed 20/80 CTW+2gram baseline: Net 2.70%');

  // ==================== EXPERIMENT 50: Per-Opponent Best Model ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 50: Per-Opponent Best Model Selection');
  console.log('='.repeat(60));

  // For each opponent, find which model works best
  const enemyBattles = new Map();
  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (!enemyBattles.has(enemyId)) enemyBattles.set(enemyId, []);
    enemyBattles.get(enemyId).push(b);
  }

  let ctwBetter = 0;
  let gramBetter = 0;
  let tie = 0;

  for (const [enemyId, opponentBattles] of enemyBattles) {
    if (opponentBattles.length < 50) continue;

    // Test CTW
    const ctw = new ContextTreeWeighting(3);
    let ctwCorrect = 0;
    for (const b of opponentBattles) {
      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = Object.entries(probs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          if (predicted === b.enemy_move) ctwCorrect++;
        }
      }
      ctw.update(b.enemy_move);
    }

    // Test 2-gram
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }
    let gramCorrect = 0;
    let prev2 = [];
    for (const b of opponentBattles) {
      if (prev2.length === 2) {
        const key = `${prev2[0]},${prev2[1]}`;
        const counts = gram2.get(key);
        const total = counts.rock + counts.paper + counts.scissor;
        if (total >= 3) {
          const predicted = Object.entries(counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          if (predicted === b.enemy_move) gramCorrect++;
        }
        counts[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    if (ctwCorrect > gramCorrect) ctwBetter++;
    else if (gramCorrect > ctwCorrect) gramBetter++;
    else tie++;
  }

  console.log(`\n  Per-opponent winner:`);
  console.log(`    CTW better: ${ctwBetter} opponents`);
  console.log(`    2-gram better: ${gramBetter} opponents`);
  console.log(`    Tie: ${tie} opponents`);

  // ==================== EXPERIMENT 51: Exponential smoothing ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 51: Exponential Smoothing Weights');
  console.log('='.repeat(60));

  const alphas = [0.01, 0.05, 0.1, 0.2];

  for (const alpha of alphas) {
    const stats = { wins: 0, losses: 0, total: 0 };
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }
    const ctwModels = new Map();

    // Exponential smoothing weights
    let ctwWeight = 0.2;  // Start with fixed 20/80
    let gramWeight = 0.8;

    let lastEnemyId = null;
    let prev2 = [];

    for (const b of battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prev2 = [];
        if (!ctwModels.has(enemyId)) {
          ctwModels.set(enemyId, new ContextTreeWeighting(3));
        }
      }

      const ctw = ctwModels.get(enemyId);

      if (ctw.history.length >= 2 && prev2.length === 2) {
        const ctwProbs = ctw.predict() || { rock: 1/3, paper: 1/3, scissor: 1/3 };
        const ctwPred = Object.entries(ctwProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];

        const key2 = `${prev2[0]},${prev2[1]}`;
        const counts2 = gram2.get(key2);
        const total2 = counts2.rock + counts2.paper + counts2.scissor;
        let gramProbs = { rock: 1/3, paper: 1/3, scissor: 1/3 };
        if (total2 >= 5) {
          gramProbs = {
            rock: counts2.rock / total2,
            paper: counts2.paper / total2,
            scissor: counts2.scissor / total2
          };
        }
        const gramPred = Object.entries(gramProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];

        // Ensemble
        const ensembleProbs = {
          rock: ctwWeight * ctwProbs.rock + gramWeight * gramProbs.rock,
          paper: ctwWeight * ctwProbs.paper + gramWeight * gramProbs.paper,
          scissor: ctwWeight * ctwProbs.scissor + gramWeight * gramProbs.scissor
        };

        const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        const ourMove = counter[predicted];

        stats.total++;
        if (ourMove === counter[b.enemy_move]) stats.wins++;
        else if (b.enemy_move === counter[ourMove]) stats.losses++;

        // Update weights with exponential smoothing
        const ctwCorrect = ctwPred === b.enemy_move ? 1 : 0;
        const gramCorrect = gramPred === b.enemy_move ? 1 : 0;

        // Adjust weights based on who was right
        if (ctwCorrect && !gramCorrect) {
          ctwWeight = ctwWeight + alpha * (1 - ctwWeight);
          gramWeight = 1 - ctwWeight;
        } else if (gramCorrect && !ctwCorrect) {
          gramWeight = gramWeight + alpha * (1 - gramWeight);
          ctwWeight = 1 - gramWeight;
        }
      }

      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`  Alpha ${alpha.toFixed(2)}: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  console.log('\n  Fixed 20/80 baseline: Net 2.70%');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ROUND 11 SUMMARY');
  console.log('='.repeat(60));
  console.log('  Dynamic weighting approaches tested.');
  console.log('  Results compared to fixed 20/80 baseline.\n');

  db.close();
});
