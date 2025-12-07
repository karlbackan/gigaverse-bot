/**
 * Warm-start vs Cold-start Investigation
 *
 * Hypothesis: Live performance (+17%) beats backtest (+5.58%) because
 * production models have warm-start from 30k+ historical battles.
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, enemy_stats, timestamp
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 WARM-START vs COLD-START Investigation`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total battles: ${battles.length}\n`);

  // Split point: train on first 90%, test on last 10%
  const TRAIN_RATIO = 0.9;

  // Group by enemy
  const byEnemy = new Map();
  for (const b of battles) {
    const id = String(b.enemy_id);
    if (!byEnemy.has(id)) byEnemy.set(id, []);
    byEnemy.get(id).push(b);
  }

  // ==================== COLD START ====================
  console.log('='.repeat(60));
  console.log('COLD START (models learn from scratch during test)');
  console.log('='.repeat(60));

  {
    const ctwModels = new Map();
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    let wins = 0, losses = 0, total = 0;
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

      // Only predict after we have context
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

        // Charge enhancement
        try {
          const enemyStats = b.enemy_stats ? JSON.parse(b.enemy_stats) : null;
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

        // EV optimization
        const ev = {
          rock: pEnemy.scissor - pEnemy.paper,
          paper: pEnemy.rock - pEnemy.scissor,
          scissor: pEnemy.paper - pEnemy.rock
        };
        const ourMove = Object.entries(ev).reduce((a, c) => c[1] > a[1] ? c : a)[0];

        total++;
        if (ourMove === counter[b.enemy_move]) wins++;
        else if (b.enemy_move === counter[ourMove]) losses++;
      }

      // Update models
      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`  Battles tested: ${total}`);
    console.log(`  Wins: ${wins}, Losses: ${losses}`);
    console.log(`  Net advantage: ${((wins - losses) / total * 100).toFixed(2)}%\n`);
  }

  // ==================== WARM START ====================
  console.log('='.repeat(60));
  console.log('WARM START (models pre-trained on 90%, tested on 10%)');
  console.log('='.repeat(60));

  {
    // Pre-train on first 90% per enemy
    const ctwModels = new Map();
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    // Training phase
    let trainBattles = 0;
    for (const [enemyId, enemyBattles] of byEnemy) {
      const splitIdx = Math.floor(enemyBattles.length * TRAIN_RATIO);
      const trainData = enemyBattles.slice(0, splitIdx);

      const ctw = new ContextTreeWeighting(3);
      ctwModels.set(enemyId, ctw);

      let prev2 = [];
      for (const b of trainData) {
        ctw.update(b.enemy_move);
        if (prev2.length === 2) {
          gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
        }
        prev2.push(b.enemy_move);
        if (prev2.length > 2) prev2.shift();
        trainBattles++;
      }
    }
    console.log(`  Training battles: ${trainBattles}`);

    // Testing phase
    let wins = 0, losses = 0, total = 0;

    for (const [enemyId, enemyBattles] of byEnemy) {
      const splitIdx = Math.floor(enemyBattles.length * TRAIN_RATIO);
      const testData = enemyBattles.slice(splitIdx);

      const ctw = ctwModels.get(enemyId);
      let prev2 = [];

      // Get last 2 moves from training data for context
      const trainData = enemyBattles.slice(0, splitIdx);
      if (trainData.length >= 2) {
        prev2 = [trainData[trainData.length - 2].enemy_move, trainData[trainData.length - 1].enemy_move];
      }

      for (const b of testData) {
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

          // Charge enhancement
          try {
            const enemyStats = b.enemy_stats ? JSON.parse(b.enemy_stats) : null;
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

          // EV optimization
          const ev = {
            rock: pEnemy.scissor - pEnemy.paper,
            paper: pEnemy.rock - pEnemy.scissor,
            scissor: pEnemy.paper - pEnemy.rock
          };
          const ourMove = Object.entries(ev).reduce((a, c) => c[1] > a[1] ? c : a)[0];

          total++;
          if (ourMove === counter[b.enemy_move]) wins++;
          else if (b.enemy_move === counter[ourMove]) losses++;
        }

        // Continue updating models during test (online learning)
        ctw.update(b.enemy_move);
        if (prev2.length === 2) {
          gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
        }
        prev2.push(b.enemy_move);
        if (prev2.length > 2) prev2.shift();
      }
    }

    console.log(`  Test battles: ${total}`);
    console.log(`  Wins: ${wins}, Losses: ${losses}`);
    console.log(`  Net advantage: ${((wins - losses) / total * 100).toFixed(2)}%\n`);
  }

  // ==================== WARM START (no online learning) ====================
  console.log('='.repeat(60));
  console.log('WARM START FROZEN (pre-trained, no updates during test)');
  console.log('='.repeat(60));

  {
    const ctwModels = new Map();
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    // Training phase (same as before)
    for (const [enemyId, enemyBattles] of byEnemy) {
      const splitIdx = Math.floor(enemyBattles.length * TRAIN_RATIO);
      const trainData = enemyBattles.slice(0, splitIdx);

      const ctw = new ContextTreeWeighting(3);
      ctwModels.set(enemyId, ctw);

      let prev2 = [];
      for (const b of trainData) {
        ctw.update(b.enemy_move);
        if (prev2.length === 2) {
          gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
        }
        prev2.push(b.enemy_move);
        if (prev2.length > 2) prev2.shift();
      }
    }

    // Testing phase - NO model updates
    let wins = 0, losses = 0, total = 0;

    for (const [enemyId, enemyBattles] of byEnemy) {
      const splitIdx = Math.floor(enemyBattles.length * TRAIN_RATIO);
      const testData = enemyBattles.slice(splitIdx);

      const ctw = ctwModels.get(enemyId);
      let prev2 = [];

      const trainData = enemyBattles.slice(0, splitIdx);
      if (trainData.length >= 2) {
        prev2 = [trainData[trainData.length - 2].enemy_move, trainData[trainData.length - 1].enemy_move];
      }

      for (const b of testData) {
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

          // Charge enhancement
          try {
            const enemyStats = b.enemy_stats ? JSON.parse(b.enemy_stats) : null;
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

          const ev = {
            rock: pEnemy.scissor - pEnemy.paper,
            paper: pEnemy.rock - pEnemy.scissor,
            scissor: pEnemy.paper - pEnemy.rock
          };
          const ourMove = Object.entries(ev).reduce((a, c) => c[1] > a[1] ? c : a)[0];

          total++;
          if (ourMove === counter[b.enemy_move]) wins++;
          else if (b.enemy_move === counter[ourMove]) losses++;
        }

        // Only update context, not models
        prev2.push(b.enemy_move);
        if (prev2.length > 2) prev2.shift();
      }
    }

    console.log(`  Test battles: ${total}`);
    console.log(`  Wins: ${wins}, Losses: ${losses}`);
    console.log(`  Net advantage: ${((wins - losses) / total * 100).toFixed(2)}%\n`);
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('If warm-start >> cold-start, that explains live performance.');
  console.log('Live models have full history, backtest started empty.\n');

  db.close();
});
