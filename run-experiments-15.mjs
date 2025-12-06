/**
 * Round 15 Experiments - Health & Shield based patterns
 * Test if enemy health/shield state influences their move choice
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, enemy_stats, player_health, enemy_health
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
    AND enemy_stats IS NOT NULL
    AND enemy_stats LIKE '%health%'
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 15 EXPERIMENTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles with health data\n`);

  // ==================== EXPERIMENT 64: Health distribution by move ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 64: Move Distribution by Health Level');
  console.log('='.repeat(60));

  const healthBuckets = {
    critical: { rock: 0, paper: 0, scissor: 0, total: 0 },  // < 25%
    low: { rock: 0, paper: 0, scissor: 0, total: 0 },       // 25-50%
    medium: { rock: 0, paper: 0, scissor: 0, total: 0 },    // 50-75%
    high: { rock: 0, paper: 0, scissor: 0, total: 0 }       // > 75%
  };

  for (const b of battles) {
    try {
      const stats = JSON.parse(b.enemy_stats);
      if (!stats.healthPercent && stats.healthPercent !== 0) continue;

      const hp = stats.healthPercent;
      let bucket;
      if (hp < 25) bucket = 'critical';
      else if (hp < 50) bucket = 'low';
      else if (hp < 75) bucket = 'medium';
      else bucket = 'high';

      healthBuckets[bucket][b.enemy_move]++;
      healthBuckets[bucket].total++;
    } catch (e) {}
  }

  console.log('\n  Health Level | Rock    Paper   Scissor | Samples');
  console.log('  ' + '-'.repeat(52));
  for (const [level, counts] of Object.entries(healthBuckets)) {
    if (counts.total > 0) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${level.padEnd(12)} | ${r.padStart(5)}%  ${p.padStart(5)}%  ${s.padStart(5)}%  | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 65: Shield distribution by move ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 65: Move Distribution by Shield Level');
  console.log('='.repeat(60));

  const shieldBuckets = {
    none: { rock: 0, paper: 0, scissor: 0, total: 0 },     // 0%
    low: { rock: 0, paper: 0, scissor: 0, total: 0 },      // 1-33%
    medium: { rock: 0, paper: 0, scissor: 0, total: 0 },   // 34-66%
    high: { rock: 0, paper: 0, scissor: 0, total: 0 }      // > 66%
  };

  for (const b of battles) {
    try {
      const stats = JSON.parse(b.enemy_stats);
      if (stats.shieldPercent === undefined) continue;

      const sp = stats.shieldPercent;
      let bucket;
      if (sp === 0) bucket = 'none';
      else if (sp <= 33) bucket = 'low';
      else if (sp <= 66) bucket = 'medium';
      else bucket = 'high';

      shieldBuckets[bucket][b.enemy_move]++;
      shieldBuckets[bucket].total++;
    } catch (e) {}
  }

  console.log('\n  Shield Level | Rock    Paper   Scissor | Samples');
  console.log('  ' + '-'.repeat(52));
  for (const [level, counts] of Object.entries(shieldBuckets)) {
    if (counts.total > 0) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${level.padEnd(12)} | ${r.padStart(5)}%  ${p.padStart(5)}%  ${s.padStart(5)}%  | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 66: Health-based prediction ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 66: Health-Based Prediction');
  console.log('='.repeat(60));
  console.log('Predict based on most common move at health level\n');

  // Build health-based predictor from data
  const healthPredictor = {};
  for (const [level, counts] of Object.entries(healthBuckets)) {
    if (counts.total > 0) {
      const best = Object.entries(counts)
        .filter(([k]) => k !== 'total')
        .reduce((a, b) => b[1] > a[1] ? b : a);
      healthPredictor[level] = best[0];
    }
  }

  {
    const stats = { wins: 0, losses: 0, total: 0 };

    for (const b of battles) {
      try {
        const enemyStats = JSON.parse(b.enemy_stats);
        if (!enemyStats.healthPercent && enemyStats.healthPercent !== 0) continue;

        const hp = enemyStats.healthPercent;
        let bucket;
        if (hp < 25) bucket = 'critical';
        else if (hp < 50) bucket = 'low';
        else if (hp < 75) bucket = 'medium';
        else bucket = 'high';

        const predicted = healthPredictor[bucket] || 'rock';
        const ourMove = counter[predicted];

        stats.total++;
        if (ourMove === counter[b.enemy_move]) stats.wins++;
        else if (b.enemy_move === counter[ourMove]) stats.losses++;
      } catch (e) {}
    }

    console.log(`  Health-only: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 67: Baseline NGRAM_CTW + EV + Charge ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 67: Current Best (NGRAM_CTW + EV + Charge)');
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

        // Add charge enhancement
        try {
          const enemyStats = JSON.parse(b.enemy_stats);
          if (enemyStats.charges) {
            const charges = enemyStats.charges;
            const max = Math.max(charges.rock || 0, charges.paper || 0, charges.scissor || 0);
            const min = Math.min(charges.rock || 0, charges.paper || 0, charges.scissor || 0);

            if (max - min >= 3) {
              const totalCharges = (charges.rock || 0) + (charges.paper || 0) + (charges.scissor || 0);
              if (totalCharges > 0) {
                const chargeProbs = {
                  rock: (charges.rock || 0) / totalCharges,
                  paper: (charges.paper || 0) / totalCharges,
                  scissor: (charges.scissor || 0) / totalCharges
                };
                pEnemy = {
                  rock: 0.8 * pEnemy.rock + 0.2 * chargeProbs.rock,
                  paper: 0.8 * pEnemy.paper + 0.2 * chargeProbs.paper,
                  scissor: 0.8 * pEnemy.scissor + 0.2 * chargeProbs.scissor
                };
              }
            }
          }
        } catch (e) {}

        // EV optimization
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

    console.log(`  Current best: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 68: Health-enhanced prediction ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 68: Health-Enhanced Prediction');
  console.log('='.repeat(60));
  console.log('Blend health bias into prediction\n');

  const healthWeights = [0.0, 0.05, 0.10, 0.15];

  for (const healthWeight of healthWeights) {
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

    // Build health probability model
    const healthProbs = {};
    for (const [level, counts] of Object.entries(healthBuckets)) {
      if (counts.total > 0) {
        healthProbs[level] = {
          rock: counts.rock / counts.total,
          paper: counts.paper / counts.total,
          scissor: counts.scissor / counts.total
        };
      }
    }

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

        // Add charge enhancement
        try {
          const enemyStats = JSON.parse(b.enemy_stats);
          if (enemyStats.charges) {
            const charges = enemyStats.charges;
            const max = Math.max(charges.rock || 0, charges.paper || 0, charges.scissor || 0);
            const min = Math.min(charges.rock || 0, charges.paper || 0, charges.scissor || 0);

            if (max - min >= 3) {
              const totalCharges = (charges.rock || 0) + (charges.paper || 0) + (charges.scissor || 0);
              if (totalCharges > 0) {
                const chargeProbs = {
                  rock: (charges.rock || 0) / totalCharges,
                  paper: (charges.paper || 0) / totalCharges,
                  scissor: (charges.scissor || 0) / totalCharges
                };
                pEnemy = {
                  rock: 0.8 * pEnemy.rock + 0.2 * chargeProbs.rock,
                  paper: 0.8 * pEnemy.paper + 0.2 * chargeProbs.paper,
                  scissor: 0.8 * pEnemy.scissor + 0.2 * chargeProbs.scissor
                };
              }
            }
          }

          // Add health enhancement
          if (healthWeight > 0 && enemyStats.healthPercent !== undefined) {
            const hp = enemyStats.healthPercent;
            let bucket;
            if (hp < 25) bucket = 'critical';
            else if (hp < 50) bucket = 'low';
            else if (hp < 75) bucket = 'medium';
            else bucket = 'high';

            if (healthProbs[bucket]) {
              const hp = healthProbs[bucket];
              pEnemy = {
                rock: (1 - healthWeight) * pEnemy.rock + healthWeight * hp.rock,
                paper: (1 - healthWeight) * pEnemy.paper + healthWeight * hp.paper,
                scissor: (1 - healthWeight) * pEnemy.scissor + healthWeight * hp.scissor
              };
            }
          }
        } catch (e) {}

        // EV optimization
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

    console.log(`  Health weight ${(healthWeight * 100).toFixed(0).padStart(3)}%: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ROUND 15 SUMMARY');
  console.log('='.repeat(60));
  console.log('  See results above for health/shield analysis.\n');

  db.close();
});
