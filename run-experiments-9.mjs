/**
 * Round 9 Experiments - Multi-depth n-gram ensemble
 * Testing 2-gram + 4-gram combination
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
  console.log(`\n🧪 ROUND 9 EXPERIMENTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // Build 2-gram and 4-gram models incrementally
  const gram2 = new Map();
  const gram4 = new Map();

  // Initialize
  for (const m1 of MOVES) {
    for (const m2 of MOVES) {
      gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
    }
  }

  // ==================== EXPERIMENT 43: 2-gram + 4-gram ensemble ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 43: 2-gram + 4-gram multi-depth ensemble');
  console.log('='.repeat(60));

  const weights = [
    { w2: 1.0, w4: 0.0, name: 'Pure 2-gram' },
    { w2: 0.0, w4: 1.0, name: 'Pure 4-gram' },
    { w2: 0.9, w4: 0.1, name: '90/10 2-gram' },
    { w2: 0.8, w4: 0.2, name: '80/20 2-gram' },
    { w2: 0.7, w4: 0.3, name: '70/30 2-gram' },
    { w2: 0.6, w4: 0.4, name: '60/40 2-gram' },
    { w2: 0.5, w4: 0.5, name: '50/50' },
  ];

  for (const w of weights) {
    const stats = { wins: 0, losses: 0, total: 0 };
    const local2 = new Map();
    const local4 = new Map();

    // Initialize 2-gram
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        local2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    let lastEnemyId = null;
    let prevN = [];

    for (const b of battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prevN = [];
      }

      // Predict BEFORE update
      if (prevN.length >= 2) {
        // Get 2-gram prediction
        const key2 = `${prevN[prevN.length-2]},${prevN[prevN.length-1]}`;
        const counts2 = local2.get(key2);
        const total2 = counts2.rock + counts2.paper + counts2.scissor;

        // Get 4-gram prediction (if available)
        let probs4 = { rock: 1/3, paper: 1/3, scissor: 1/3 };
        if (prevN.length >= 4) {
          const key4 = prevN.slice(-4).join(',');
          if (local4.has(key4)) {
            const counts4 = local4.get(key4);
            const total4 = counts4.rock + counts4.paper + counts4.scissor;
            if (total4 >= 3) {
              probs4 = {
                rock: counts4.rock / total4,
                paper: counts4.paper / total4,
                scissor: counts4.scissor / total4
              };
            }
          }
        }

        if (total2 >= 5) {
          const probs2 = {
            rock: counts2.rock / total2,
            paper: counts2.paper / total2,
            scissor: counts2.scissor / total2
          };

          // Ensemble
          const ensembleProbs = {
            rock: w.w2 * probs2.rock + w.w4 * probs4.rock,
            paper: w.w2 * probs2.paper + w.w4 * probs4.paper,
            scissor: w.w2 * probs2.scissor + w.w4 * probs4.scissor
          };

          const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          const ourMove = counter[predicted];

          stats.total++;
          if (ourMove === counter[b.enemy_move]) stats.wins++;
          else if (b.enemy_move === counter[ourMove]) stats.losses++;
        }
      }

      // Update AFTER prediction
      if (prevN.length >= 2) {
        const key2 = `${prevN[prevN.length-2]},${prevN[prevN.length-1]}`;
        local2.get(key2)[b.enemy_move]++;
      }
      if (prevN.length >= 4) {
        const key4 = prevN.slice(-4).join(',');
        if (!local4.has(key4)) local4.set(key4, { rock: 0, paper: 0, scissor: 0 });
        local4.get(key4)[b.enemy_move]++;
      }

      prevN.push(b.enemy_move);
      if (prevN.length > 10) prevN.shift();
    }

    const netAdv = stats.total > 0 ? (stats.wins - stats.losses) / stats.total * 100 : 0;
    console.log(`  ${w.name.padEnd(15)}: Net ${netAdv.toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 44: 2-gram + CTW + 4-gram triple ensemble ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 44: Triple ensemble (CTW + 2-gram + 4-gram)');
  console.log('='.repeat(60));

  const tripleWeights = [
    { ctw: 0.2, g2: 0.8, g4: 0.0, name: 'Best known (CTW+2gram)' },
    { ctw: 0.2, g2: 0.7, g4: 0.1, name: '20/70/10' },
    { ctw: 0.2, g2: 0.6, g4: 0.2, name: '20/60/20' },
    { ctw: 0.1, g2: 0.8, g4: 0.1, name: '10/80/10' },
    { ctw: 0.0, g2: 0.9, g4: 0.1, name: '0/90/10' },
  ];

  for (const w of tripleWeights) {
    const stats = { wins: 0, losses: 0, total: 0 };
    const ctwModels = new Map();
    const local2 = new Map();
    const local4 = new Map();

    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        local2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    let lastEnemyId = null;
    let prevN = [];

    for (const b of battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prevN = [];
        if (!ctwModels.has(enemyId)) {
          ctwModels.set(enemyId, new ContextTreeWeighting(3));
        }
      }

      const ctw = ctwModels.get(enemyId);

      // Predict BEFORE update
      if (prevN.length >= 2 && ctw.history.length >= 2) {
        // CTW
        const ctwProbs = ctw.predict() || { rock: 1/3, paper: 1/3, scissor: 1/3 };

        // 2-gram
        const key2 = `${prevN[prevN.length-2]},${prevN[prevN.length-1]}`;
        const counts2 = local2.get(key2);
        const total2 = counts2.rock + counts2.paper + counts2.scissor;

        // 4-gram
        let probs4 = { rock: 1/3, paper: 1/3, scissor: 1/3 };
        if (prevN.length >= 4) {
          const key4 = prevN.slice(-4).join(',');
          if (local4.has(key4)) {
            const counts4 = local4.get(key4);
            const total4 = counts4.rock + counts4.paper + counts4.scissor;
            if (total4 >= 3) {
              probs4 = {
                rock: counts4.rock / total4,
                paper: counts4.paper / total4,
                scissor: counts4.scissor / total4
              };
            }
          }
        }

        if (total2 >= 5) {
          const probs2 = {
            rock: counts2.rock / total2,
            paper: counts2.paper / total2,
            scissor: counts2.scissor / total2
          };

          // Triple ensemble
          const ensembleProbs = {
            rock: w.ctw * ctwProbs.rock + w.g2 * probs2.rock + w.g4 * probs4.rock,
            paper: w.ctw * ctwProbs.paper + w.g2 * probs2.paper + w.g4 * probs4.paper,
            scissor: w.ctw * ctwProbs.scissor + w.g2 * probs2.scissor + w.g4 * probs4.scissor
          };

          const predicted = Object.entries(ensembleProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          const ourMove = counter[predicted];

          stats.total++;
          if (ourMove === counter[b.enemy_move]) stats.wins++;
          else if (b.enemy_move === counter[ourMove]) stats.losses++;
        }
      }

      // Update ALL models
      ctw.update(b.enemy_move);
      if (prevN.length >= 2) {
        const key2 = `${prevN[prevN.length-2]},${prevN[prevN.length-1]}`;
        local2.get(key2)[b.enemy_move]++;
      }
      if (prevN.length >= 4) {
        const key4 = prevN.slice(-4).join(',');
        if (!local4.has(key4)) local4.set(key4, { rock: 0, paper: 0, scissor: 0 });
        local4.get(key4)[b.enemy_move]++;
      }

      prevN.push(b.enemy_move);
      if (prevN.length > 10) prevN.shift();
    }

    const netAdv = stats.total > 0 ? (stats.wins - stats.losses) / stats.total * 100 : 0;
    console.log(`  ${w.name.padEnd(20)}: Net ${netAdv.toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 45: Per-opponent adaptive weighting ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 45: Use 2-gram vs 4-gram based on confidence');
  console.log('='.repeat(60));

  {
    const stats = { wins: 0, losses: 0, total: 0, used2: 0, used4: 0 };
    const local2 = new Map();
    const local4 = new Map();

    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        local2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    let lastEnemyId = null;
    let prevN = [];

    for (const b of battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prevN = [];
      }

      if (prevN.length >= 4) {
        const key2 = `${prevN[prevN.length-2]},${prevN[prevN.length-1]}`;
        const counts2 = local2.get(key2);
        const total2 = counts2.rock + counts2.paper + counts2.scissor;

        const key4 = prevN.slice(-4).join(',');
        const counts4 = local4.has(key4) ? local4.get(key4) : { rock: 0, paper: 0, scissor: 0 };
        const total4 = counts4.rock + counts4.paper + counts4.scissor;

        if (total2 >= 5) {
          let predicted;
          // Use 4-gram if confident enough, else 2-gram
          if (total4 >= 5) {
            const max4 = Math.max(counts4.rock, counts4.paper, counts4.scissor) / total4;
            const max2 = Math.max(counts2.rock, counts2.paper, counts2.scissor) / total2;

            if (max4 > max2) {
              predicted = Object.entries(counts4).reduce((a, c) => c[1] > a[1] ? c : a)[0];
              stats.used4++;
            } else {
              predicted = Object.entries(counts2).reduce((a, c) => c[1] > a[1] ? c : a)[0];
              stats.used2++;
            }
          } else {
            predicted = Object.entries(counts2).reduce((a, c) => c[1] > a[1] ? c : a)[0];
            stats.used2++;
          }

          const ourMove = counter[predicted];
          stats.total++;
          if (ourMove === counter[b.enemy_move]) stats.wins++;
          else if (b.enemy_move === counter[ourMove]) stats.losses++;
        }
      }

      // Update
      if (prevN.length >= 2) {
        const key2 = `${prevN[prevN.length-2]},${prevN[prevN.length-1]}`;
        local2.get(key2)[b.enemy_move]++;
      }
      if (prevN.length >= 4) {
        const key4 = prevN.slice(-4).join(',');
        if (!local4.has(key4)) local4.set(key4, { rock: 0, paper: 0, scissor: 0 });
        local4.get(key4)[b.enemy_move]++;
      }

      prevN.push(b.enemy_move);
      if (prevN.length > 10) prevN.shift();
    }

    const netAdv = (stats.wins - stats.losses) / stats.total * 100;
    console.log(`  Adaptive 2/4-gram: Net ${netAdv.toFixed(2)}%`);
    console.log(`    Used 2-gram: ${stats.used2}, Used 4-gram: ${stats.used4}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ROUND 9 SUMMARY');
  console.log('='.repeat(60));
  console.log('  Current best (20/80 CTW+2gram): Net 2.70%');
  console.log('  See results above for improvements\n');

  db.close();
});
