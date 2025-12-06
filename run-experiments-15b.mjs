/**
 * Round 15b - Turn patterns and player move influence
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, player_move, turn, enemy_stats
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
    AND player_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 15b - Turn & Player Move Patterns`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // ==================== EXPERIMENT 69: Turn-based patterns ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 69: Move Distribution by Turn Number');
  console.log('='.repeat(60));

  const turnBuckets = {
    early: { rock: 0, paper: 0, scissor: 0, total: 0 },    // turns 1-3
    mid: { rock: 0, paper: 0, scissor: 0, total: 0 },      // turns 4-7
    late: { rock: 0, paper: 0, scissor: 0, total: 0 }      // turns 8+
  };

  for (const b of battles) {
    const turn = b.turn || 1;
    let bucket;
    if (turn <= 3) bucket = 'early';
    else if (turn <= 7) bucket = 'mid';
    else bucket = 'late';

    turnBuckets[bucket][b.enemy_move]++;
    turnBuckets[bucket].total++;
  }

  console.log('\n  Turn Range  | Rock    Paper   Scissor | Samples');
  console.log('  ' + '-'.repeat(52));
  for (const [range, counts] of Object.entries(turnBuckets)) {
    if (counts.total > 0) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${range.padEnd(11)} | ${r.padStart(5)}%  ${p.padStart(5)}%  ${s.padStart(5)}%  | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 70: Player move influence ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 70: Enemy Response to Our Previous Move');
  console.log('='.repeat(60));

  const responsePatterns = {
    rock: { rock: 0, paper: 0, scissor: 0, total: 0 },
    paper: { rock: 0, paper: 0, scissor: 0, total: 0 },
    scissor: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  let lastEnemyId = null;
  let prevPlayerMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevPlayerMove = null;
    }

    if (prevPlayerMove && responsePatterns[prevPlayerMove]) {
      responsePatterns[prevPlayerMove][b.enemy_move]++;
      responsePatterns[prevPlayerMove].total++;
    }

    prevPlayerMove = b.player_move;
  }

  console.log('\n  After our  | Enemy: Rock  Paper  Scissor | Samples');
  console.log('  ' + '-'.repeat(52));
  for (const [ourMove, counts] of Object.entries(responsePatterns)) {
    if (counts.total > 0) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${ourMove.padEnd(10)} | ${r.padStart(7)}%${p.padStart(7)}%${s.padStart(8)}% | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 71: Joint (our move, their prev) patterns ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 71: Joint Pattern (our move + their prev move)');
  console.log('='.repeat(60));

  const jointPatterns = new Map();
  for (const m1 of MOVES) {
    for (const m2 of MOVES) {
      jointPatterns.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0, total: 0 });
    }
  }

  lastEnemyId = null;
  prevPlayerMove = null;
  let prevEnemyMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevPlayerMove = null;
      prevEnemyMove = null;
    }

    if (prevPlayerMove && prevEnemyMove) {
      const key = `${prevPlayerMove},${prevEnemyMove}`;
      jointPatterns.get(key)[b.enemy_move]++;
      jointPatterns.get(key).total++;
    }

    prevPlayerMove = b.player_move;
    prevEnemyMove = b.enemy_move;
  }

  console.log('\n  (Our, Their) | Next Enemy: R     P     S   | Samples');
  console.log('  ' + '-'.repeat(54));
  for (const [key, counts] of jointPatterns.entries()) {
    if (counts.total >= 100) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${key.padEnd(13)} | ${r.padStart(9)}%${p.padStart(6)}%${s.padStart(6)}% | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 72: Player-influenced prediction ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 72: Player-Move Influenced Prediction');
  console.log('='.repeat(60));

  // Build player-response probability model
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

  const playerWeights = [0.0, 0.05, 0.10, 0.15, 0.20];

  for (const playerWeight of playerWeights) {
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

        // Add charge enhancement
        try {
          const enemyStats = JSON.parse(b.enemy_stats);
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
        } catch (e) {}

        // Add player-move influence
        if (playerWeight > 0 && prevPlayerMove && playerResponseProbs[prevPlayerMove]) {
          const prp = playerResponseProbs[prevPlayerMove];
          pEnemy = {
            rock: (1 - playerWeight) * pEnemy.rock + playerWeight * prp.rock,
            paper: (1 - playerWeight) * pEnemy.paper + playerWeight * prp.paper,
            scissor: (1 - playerWeight) * pEnemy.scissor + playerWeight * prp.scissor
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

    console.log(`  Player weight ${(playerWeight * 100).toFixed(0).padStart(3)}%: Net ${((stats.wins - stats.losses) / stats.total * 100).toFixed(2)}%`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  db.close();
});
