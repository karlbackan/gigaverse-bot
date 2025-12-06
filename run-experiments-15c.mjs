/**
 * Round 15c - Combine multiple weak signals
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, player_move, enemy_stats
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
    AND player_move IN ('rock','paper','scissor')
    AND enemy_stats IS NOT NULL
    AND enemy_stats LIKE '%health%'
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 15c - Combined Weak Signals`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // Build player-response model
  const responsePatterns = { rock: {}, paper: {}, scissor: {} };
  let lastEnemyId = null;
  let prevPlayerMove = null;

  for (const ourMove of MOVES) {
    responsePatterns[ourMove] = { rock: 0, paper: 0, scissor: 0, total: 0 };
  }

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevPlayerMove = null;
    }
    if (prevPlayerMove) {
      responsePatterns[prevPlayerMove][b.enemy_move]++;
      responsePatterns[prevPlayerMove].total++;
    }
    prevPlayerMove = b.player_move;
  }

  const playerResponseProbs = {};
  for (const [ourMove, counts] of Object.entries(responsePatterns)) {
    if (counts.total > 0) {
      playerResponseProbs[ourMove] = {
        rock: counts.rock / counts.total,
        paper: counts.paper / counts.total,
        scissor: counts.scissor / counts.total
      };
    }
  }

  // Build health model
  const healthBuckets = {
    critical: { rock: 0, paper: 0, scissor: 0, total: 0 },
    low: { rock: 0, paper: 0, scissor: 0, total: 0 },
    medium: { rock: 0, paper: 0, scissor: 0, total: 0 },
    high: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  for (const b of battles) {
    try {
      const stats = JSON.parse(b.enemy_stats);
      if (stats.healthPercent === undefined) continue;
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

  // Test combinations
  console.log('='.repeat(60));
  console.log('EXPERIMENT 73: Combining Health + Player Response');
  console.log('='.repeat(60));
  console.log('Testing different weight combinations\n');

  const configs = [
    { name: 'Baseline (charge only)', health: 0, player: 0 },
    { name: 'Health 10%', health: 0.10, player: 0 },
    { name: 'Player 10%', health: 0, player: 0.10 },
    { name: 'Both 5%', health: 0.05, player: 0.05 },
    { name: 'Both 10%', health: 0.10, player: 0.10 },
    { name: 'Health 5% + Player 10%', health: 0.05, player: 0.10 },
    { name: 'Health 10% + Player 5%', health: 0.10, player: 0.05 },
  ];

  for (const config of configs) {
    const stats = { wins: 0, losses: 0, total: 0 };
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }
    const ctwModels = new Map();
    lastEnemyId = null;
    let prev2 = [];
    prevPlayerMove = null;

    for (const b of battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prev2 = [];
        prevPlayerMove = null;
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

        // Add charge enhancement (always on)
        try {
          const enemyStats = JSON.parse(b.enemy_stats);

          // Charge enhancement
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

          // Health enhancement
          if (config.health > 0 && enemyStats?.healthPercent !== undefined) {
            const hp = enemyStats.healthPercent;
            let bucket;
            if (hp < 25) bucket = 'critical';
            else if (hp < 50) bucket = 'low';
            else if (hp < 75) bucket = 'medium';
            else bucket = 'high';

            if (healthProbs[bucket]) {
              const hprob = healthProbs[bucket];
              pEnemy = {
                rock: (1 - config.health) * pEnemy.rock + config.health * hprob.rock,
                paper: (1 - config.health) * pEnemy.paper + config.health * hprob.paper,
                scissor: (1 - config.health) * pEnemy.scissor + config.health * hprob.scissor
              };
            }
          }
        } catch (e) {}

        // Player response enhancement
        if (config.player > 0 && prevPlayerMove && playerResponseProbs[prevPlayerMove]) {
          const prp = playerResponseProbs[prevPlayerMove];
          pEnemy = {
            rock: (1 - config.player) * pEnemy.rock + config.player * prp.rock,
            paper: (1 - config.player) * pEnemy.paper + config.player * prp.paper,
            scissor: (1 - config.player) * pEnemy.scissor + config.player * prp.scissor
          };
        }

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
      prevPlayerMove = b.player_move;
    }

    const net = ((stats.wins - stats.losses) / stats.total * 100).toFixed(2);
    console.log(`  ${config.name.padEnd(25)}: Net ${net}%`);
  }

  db.close();
});
