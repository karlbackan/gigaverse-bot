/**
 * Round 14 Experiments - Charge-enhanced prediction
 * Test if combining charge information with NGRAM_CTW improves performance
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
  console.log(`\n🧪 ROUND 14 EXPERIMENTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles with charge data\n`);

  // ==================== EXPERIMENT 58: Charge-only prediction ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 58: Charge-Only Prediction');
  console.log('='.repeat(60));
  console.log('Predict enemy will use their highest-charge weapon\n');

  {
    const stats = { wins: 0, losses: 0, total: 0 };

    for (const b of battles) {
      try {
        const enemyStats = JSON.parse(b.enemy_stats);
        if (!enemyStats.charges) continue;

        const charges = enemyStats.charges;

        // Only predict when charges are unequal
        const max = Math.max(charges.rock, charges.paper, charges.scissor);
        const min = Math.min(charges.rock, charges.paper, charges.scissor);
        if (max === min) continue;  // No charge difference

        // Predict they'll use highest charge
        let predicted = 'rock';
        if (charges.paper > charges.rock && charges.paper > charges.scissor) predicted = 'paper';
        else if (charges.scissor > charges.rock && charges.scissor > charges.paper) predicted = 'scissor';
        else predicted = 'rock';

        const ourMove = counter[predicted];

        stats.total++;
        if (ourMove === counter[b.enemy_move]) stats.wins++;
        else if (b.enemy_move === counter[ourMove]) stats.losses++;
      } catch (e) {
        continue;
      }
    }

    console.log(`  Charge-only: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}% (${stats.total} predictions)`);
  }

  // ==================== EXPERIMENT 59: Baseline NGRAM_CTW (EV) ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 59: Baseline NGRAM_CTW with EV');
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

        const pEnemy = {
          rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
          paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
          scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
        };

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

    console.log(`  NGRAM_CTW + EV: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 60: Charge-enhanced NGRAM_CTW ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 60: Charge-Enhanced NGRAM_CTW');
  console.log('='.repeat(60));
  console.log('Blend charge bias into prediction probabilities\n');

  const chargeWeights = [0.0, 0.05, 0.10, 0.15, 0.20, 0.30];

  for (const chargeWeight of chargeWeights) {
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

        // Base ensemble
        let pEnemy = {
          rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
          paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
          scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
        };

        // Add charge bias if available
        try {
          const enemyStats = JSON.parse(b.enemy_stats);
          if (enemyStats.charges && chargeWeight > 0) {
            const charges = enemyStats.charges;
            const totalCharges = charges.rock + charges.paper + charges.scissor;

            if (totalCharges > 0) {
              const chargeProbs = {
                rock: charges.rock / totalCharges,
                paper: charges.paper / totalCharges,
                scissor: charges.scissor / totalCharges
              };

              // Blend charge prediction with sequence prediction
              pEnemy = {
                rock: (1 - chargeWeight) * pEnemy.rock + chargeWeight * chargeProbs.rock,
                paper: (1 - chargeWeight) * pEnemy.paper + chargeWeight * chargeProbs.paper,
                scissor: (1 - chargeWeight) * pEnemy.scissor + chargeWeight * chargeProbs.scissor
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

    console.log(`  Charge weight ${(chargeWeight * 100).toFixed(0).padStart(3)}%: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 61: Charge-conditional prediction ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 61: Charge-Conditional Prediction');
  console.log('='.repeat(60));
  console.log('Use charge bias only when charges are unequal\n');

  {
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

        // Base ensemble
        let pEnemy = {
          rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
          paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
          scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
        };

        // Conditionally use charge bias
        try {
          const enemyStats = JSON.parse(b.enemy_stats);
          if (enemyStats.charges) {
            const charges = enemyStats.charges;
            const max = Math.max(charges.rock, charges.paper, charges.scissor);
            const min = Math.min(charges.rock, charges.paper, charges.scissor);

            // Only use charge info if there's a clear winner (diff >= 2)
            if (max - min >= 2) {
              const totalCharges = charges.rock + charges.paper + charges.scissor;
              const chargeProbs = {
                rock: charges.rock / totalCharges,
                paper: charges.paper / totalCharges,
                scissor: charges.scissor / totalCharges
              };

              // Strong charge weight when unequal
              pEnemy = {
                rock: 0.85 * pEnemy.rock + 0.15 * chargeProbs.rock,
                paper: 0.85 * pEnemy.paper + 0.15 * chargeProbs.paper,
                scissor: 0.85 * pEnemy.scissor + 0.15 * chargeProbs.scissor
              };
              stats.chargeUsed++;
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

    console.log(`  Conditional charges: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}% (${stats.chargeUsed} charge-influenced)`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ROUND 14 SUMMARY');
  console.log('='.repeat(60));
  console.log('  Baseline NGRAM_CTW + EV shown above for comparison.\n');

  db.close();
});
