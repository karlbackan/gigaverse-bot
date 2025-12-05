/**
 * Round 14b Experiments - Fine-tune charge-conditional prediction
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, enemy_stats
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
    AND enemy_stats IS NOT NULL
    AND enemy_stats LIKE '%charges%'
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 14b - Fine-tuning Charge Enhancement`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // ==================== Test different charge diff thresholds ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 62: Charge Diff Thresholds');
  console.log('='.repeat(60));
  console.log('Only use charges when max-min >= threshold\n');

  const thresholds = [0, 1, 2, 3];
  const weights = [0.05, 0.10, 0.15, 0.20];

  for (const threshold of thresholds) {
    console.log(`\n  Threshold ${threshold}:`);
    for (const weight of weights) {
      const stats = { wins: 0, losses: 0, total: 0, chargeUsed: 0 };
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

          let pEnemy = {
            rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
            paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
            scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
          };

          try {
            const enemyStats = JSON.parse(b.enemy_stats);
            if (enemyStats.charges) {
              const charges = enemyStats.charges;
              const max = Math.max(charges.rock, charges.paper, charges.scissor);
              const min = Math.min(charges.rock, charges.paper, charges.scissor);

              if (max - min >= threshold) {
                const totalCharges = charges.rock + charges.paper + charges.scissor;
                const chargeProbs = {
                  rock: charges.rock / totalCharges,
                  paper: charges.paper / totalCharges,
                  scissor: charges.scissor / totalCharges
                };

                pEnemy = {
                  rock: (1 - weight) * pEnemy.rock + weight * chargeProbs.rock,
                  paper: (1 - weight) * pEnemy.paper + weight * chargeProbs.paper,
                  scissor: (1 - weight) * pEnemy.scissor + weight * chargeProbs.scissor
                };
                stats.chargeUsed++;
              }
            }
          } catch (e) {}

          const ev = {
            rock: pEnemy.scissor - pEnemy.paper,
            paper: pEnemy.rock - pEnemy.scissor,
            scissor: pEnemy.paper - pEnemy.rock
          };
          const ourMove = Object.entries(ev).reduce((a, c) => c[1] > a[1] ? c : a)[0];

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

      const net = ((stats.wins - stats.losses) / stats.total * 100).toFixed(2);
      console.log(`    w=${(weight*100).toFixed(0).padStart(2)}%: ${net}% (${stats.chargeUsed} influenced)`);
    }
  }

  // ==================== Best combination: threshold 2, weight 15% ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 63: Verify Best Config');
  console.log('='.repeat(60));

  {
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

    const threshold = 2;
    const weight = 0.15;

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

        let pEnemy = {
          rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
          paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
          scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
        };

        try {
          const enemyStats = JSON.parse(b.enemy_stats);
          if (enemyStats.charges) {
            const charges = enemyStats.charges;
            const max = Math.max(charges.rock, charges.paper, charges.scissor);
            const min = Math.min(charges.rock, charges.paper, charges.scissor);

            if (max - min >= threshold) {
              const totalCharges = charges.rock + charges.paper + charges.scissor;
              const chargeProbs = {
                rock: charges.rock / totalCharges,
                paper: charges.paper / totalCharges,
                scissor: charges.scissor / totalCharges
              };

              pEnemy = {
                rock: (1 - weight) * pEnemy.rock + weight * chargeProbs.rock,
                paper: (1 - weight) * pEnemy.paper + weight * chargeProbs.paper,
                scissor: (1 - weight) * pEnemy.scissor + weight * chargeProbs.scissor
              };
            }
          }
        } catch (e) {}

        const ev = {
          rock: pEnemy.scissor - pEnemy.paper,
          paper: pEnemy.rock - pEnemy.scissor,
          scissor: pEnemy.paper - pEnemy.rock
        };
        const ourMove = Object.entries(ev).reduce((a, c) => c[1] > a[1] ? c : a)[0];

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

    console.log(`  Best config (threshold=2, weight=15%): Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  db.close();
});
