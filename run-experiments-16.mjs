/**
 * Round 16 - Untested features
 * - Enemy weapon attack/defense
 * - Health difference (who's winning)
 * - Our stats influence on enemy behavior
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, enemy_stats, player_stats, player_health, enemy_health
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
    AND enemy_stats IS NOT NULL
    AND enemy_stats LIKE '%weapons%'
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 16 - Untested Features`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles with weapon stats\n`);

  // ==================== EXPERIMENT 74: Enemy weapon attack bias ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 74: Do enemies favor high-attack weapons?');
  console.log('='.repeat(60));

  const attackBias = {
    highest: { rock: 0, paper: 0, scissor: 0, total: 0 },
    notHighest: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  for (const b of battles) {
    try {
      const stats = JSON.parse(b.enemy_stats);
      if (!stats.weapons) continue;

      const weapons = stats.weapons;
      const attacks = {
        rock: weapons.rock?.attack || 0,
        paper: weapons.paper?.attack || 0,
        scissor: weapons.scissor?.attack || 0
      };

      const maxAtk = Math.max(attacks.rock, attacks.paper, attacks.scissor);
      const highestWeapon = Object.entries(attacks).find(([k, v]) => v === maxAtk)?.[0];

      if (b.enemy_move === highestWeapon) {
        attackBias.highest[b.enemy_move]++;
        attackBias.highest.total++;
      } else {
        attackBias.notHighest[b.enemy_move]++;
        attackBias.notHighest.total++;
      }
    } catch (e) {}
  }

  console.log(`\n  When playing highest-attack weapon: ${attackBias.highest.total} times`);
  console.log(`  When NOT playing highest-attack: ${attackBias.notHighest.total} times`);
  const highestPct = (attackBias.highest.total / (attackBias.highest.total + attackBias.notHighest.total) * 100).toFixed(1);
  console.log(`  Enemies use highest-attack weapon ${highestPct}% of the time\n`);

  // ==================== EXPERIMENT 75: Attack-based prediction ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 75: Attack-Based Prediction');
  console.log('='.repeat(60));

  {
    const stats = { wins: 0, losses: 0, total: 0 };

    for (const b of battles) {
      try {
        const enemyStats = JSON.parse(b.enemy_stats);
        if (!enemyStats.weapons) continue;

        const weapons = enemyStats.weapons;
        const attacks = {
          rock: weapons.rock?.attack || 0,
          paper: weapons.paper?.attack || 0,
          scissor: weapons.scissor?.attack || 0
        };

        // Predict they'll use highest attack weapon
        const maxAtk = Math.max(attacks.rock, attacks.paper, attacks.scissor);
        let predicted = Object.entries(attacks).find(([k, v]) => v === maxAtk)?.[0] || 'rock';
        const ourMove = counter[predicted];

        stats.total++;
        if (ourMove === counter[b.enemy_move]) stats.wins++;
        else if (b.enemy_move === counter[ourMove]) stats.losses++;
      } catch (e) {}
    }

    console.log(`  Attack-only: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  // ==================== EXPERIMENT 76: Health difference influence ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 76: Health Difference Influence');
  console.log('='.repeat(60));

  const healthDiff = {
    weWinning: { rock: 0, paper: 0, scissor: 0, total: 0 },
    theyWinning: { rock: 0, paper: 0, scissor: 0, total: 0 },
    even: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  for (const b of battles) {
    try {
      const enemyStats = JSON.parse(b.enemy_stats);
      const playerStats = b.player_stats ? JSON.parse(b.player_stats) : null;

      if (!enemyStats.healthPercent || !playerStats?.healthPercent) continue;

      const diff = playerStats.healthPercent - enemyStats.healthPercent;
      let bucket;
      if (diff > 20) bucket = 'weWinning';
      else if (diff < -20) bucket = 'theyWinning';
      else bucket = 'even';

      healthDiff[bucket][b.enemy_move]++;
      healthDiff[bucket].total++;
    } catch (e) {}
  }

  console.log('\n  Health State  | Rock    Paper   Scissor | Samples');
  console.log('  ' + '-'.repeat(52));
  for (const [state, counts] of Object.entries(healthDiff)) {
    if (counts.total > 0) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${state.padEnd(13)} | ${r.padStart(5)}%  ${p.padStart(5)}%  ${s.padStart(5)}%  | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 77: Attack-enhanced prediction ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 77: Attack-Enhanced Prediction');
  console.log('='.repeat(60));

  const attackWeights = [0, 0.05, 0.10, 0.15, 0.20];

  for (const attackWeight of attackWeights) {
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

        try {
          const enemyStats = JSON.parse(b.enemy_stats);

          // Charge enhancement (always)
          if (enemyStats?.charges) {
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

          // Attack enhancement
          if (attackWeight > 0 && enemyStats?.weapons) {
            const weapons = enemyStats.weapons;
            const attacks = {
              rock: weapons.rock?.attack || 0,
              paper: weapons.paper?.attack || 0,
              scissor: weapons.scissor?.attack || 0
            };
            const totalAtk = attacks.rock + attacks.paper + attacks.scissor;
            if (totalAtk > 0) {
              const attackProbs = {
                rock: attacks.rock / totalAtk,
                paper: attacks.paper / totalAtk,
                scissor: attacks.scissor / totalAtk
              };
              pEnemy = {
                rock: (1 - attackWeight) * pEnemy.rock + attackWeight * attackProbs.rock,
                paper: (1 - attackWeight) * pEnemy.paper + attackWeight * attackProbs.paper,
                scissor: (1 - attackWeight) * pEnemy.scissor + attackWeight * attackProbs.scissor
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

    console.log(`  Attack weight ${(attackWeight * 100).toFixed(0).padStart(3)}%: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  db.close();
});
