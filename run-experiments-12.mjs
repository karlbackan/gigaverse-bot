/**
 * Round 12 Experiments - Anti-exploitation & robustness
 * - Mix in randomness to prevent being exploited
 * - Cold-start handling for new opponents
 * - Confidence-based randomness
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
  console.log(`\n🧪 ROUND 12 EXPERIMENTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // ==================== EXPERIMENT 52: Epsilon-Random Mix ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 52: Epsilon-Random Mix');
  console.log('='.repeat(60));
  console.log('Mix in epsilon% random moves to avoid being predictable\n');

  const epsilons = [0, 0.05, 0.1, 0.15, 0.2, 0.3];

  for (const epsilon of epsilons) {
    const stats = { wins: 0, losses: 0, total: 0 };
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }
    const ctwModels = new Map();
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
        let ourMove;

        if (Math.random() < epsilon) {
          // Random move
          ourMove = MOVES[Math.floor(Math.random() * 3)];
        } else {
          // Ensemble prediction
          const ctwProbs = ctw.predict() || { rock: 1/3, paper: 1/3, scissor: 1/3 };

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

          const ensembleProbs = {
            rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
            paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
            scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
          };

          const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          ourMove = counter[predicted];
        }

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

    const netAdv = (stats.wins - stats.losses) / stats.total * 100;
    console.log(`  Epsilon ${(epsilon * 100).toFixed(0).padStart(2)}%: Net ${netAdv.toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 53: Confidence-based randomness ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 53: Confidence-Based Randomness');
  console.log('='.repeat(60));
  console.log('Play random when confidence < threshold\n');

  const thresholds = [0.33, 0.35, 0.40, 0.45, 0.50];

  for (const threshold of thresholds) {
    const stats = { wins: 0, losses: 0, total: 0, random: 0 };
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }
    const ctwModels = new Map();
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

        const ensembleProbs = {
          rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
          paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
          scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
        };

        const maxProb = Math.max(ensembleProbs.rock, ensembleProbs.paper, ensembleProbs.scissor);

        let ourMove;
        if (maxProb < threshold) {
          // Low confidence - play random
          ourMove = MOVES[Math.floor(Math.random() * 3)];
          stats.random++;
        } else {
          const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          ourMove = counter[predicted];
        }

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

    const netAdv = (stats.wins - stats.losses) / stats.total * 100;
    const randPct = (stats.random / stats.total * 100).toFixed(0);
    console.log(`  Threshold ${threshold.toFixed(2)}: Net ${netAdv.toFixed(2)}% (${randPct}% random)`);
  }

  // ==================== EXPERIMENT 54: Cold-start strategy ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 54: Cold-Start Strategy');
  console.log('='.repeat(60));
  console.log('What to do for first N moves against new opponent\n');

  const coldStarts = [
    { name: 'Random', fn: () => MOVES[Math.floor(Math.random() * 3)] },
    { name: 'Rock', fn: () => 'rock' },
    { name: 'Paper', fn: () => 'paper' },
    { name: 'Scissor', fn: () => 'scissor' },
    { name: 'Counter-rock (paper)', fn: () => 'paper' },  // Counter most common move
  ];

  for (const coldStart of coldStarts) {
    const stats = { wins: 0, losses: 0, total: 0 };
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }
    const ctwModels = new Map();
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

      let ourMove;
      if (ctw.history.length < 3 || prev2.length < 2) {
        // Cold start
        ourMove = coldStart.fn();
      } else {
        // Ensemble prediction
        const ctwProbs = ctw.predict() || { rock: 1/3, paper: 1/3, scissor: 1/3 };

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

        const ensembleProbs = {
          rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
          paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
          scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
        };

        const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        ourMove = counter[predicted];
      }

      stats.total++;
      if (ourMove === counter[b.enemy_move]) stats.wins++;
      else if (b.enemy_move === counter[ourMove]) stats.losses++;

      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    const netAdv = (stats.wins - stats.losses) / stats.total * 100;
    console.log(`  ${coldStart.name.padEnd(20)}: Net ${netAdv.toFixed(2)}%`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ROUND 12 SUMMARY');
  console.log('='.repeat(60));
  console.log('  Pure 20/80 CTW+2gram baseline: Net 2.70%');
  console.log('  See results above for anti-exploitation variants\n');

  db.close();
});
