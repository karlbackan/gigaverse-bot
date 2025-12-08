/**
 * Backtest ML predictions on recent battles
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

// Get last 150 battles plus history needed for context
db.all(`
  SELECT enemy_id, enemy_move, enemy_stats, player_move, result, timestamp
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, allBattles) => {

  // Get the last 150 battle timestamps
  db.all(`
    SELECT timestamp FROM battles
    WHERE enemy_move IN ('rock','paper','scissor')
    ORDER BY timestamp DESC
    LIMIT 150
  `, [], (err, recentTimestamps) => {

    const cutoffTimestamp = recentTimestamps[recentTimestamps.length - 1].timestamp;

    console.log(`\n🔬 BACKTEST: ML Predictions on Last 150 Battles`);
    console.log(`${'='.repeat(60)}`);

    // Build CTW models and 2-gram from ALL data (simulating warm start)
    const ctwModels = new Map();
    const gram2 = new Map();
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        gram2.set(`${m1},${m2}`, { rock: 0, paper: 0, scissor: 0 });
      }
    }

    // Track per-enemy history
    const enemyHistory = new Map();

    // Results
    let mlWins = 0, mlLosses = 0, mlTies = 0;
    let actualWins = 0, actualLosses = 0, actualTies = 0;
    let correctPredictions = 0;
    let tested = 0;

    for (const b of allBattles) {
      const enemyId = String(b.enemy_id);

      // Initialize if needed
      if (!ctwModels.has(enemyId)) {
        ctwModels.set(enemyId, new ContextTreeWeighting(3));
      }
      if (!enemyHistory.has(enemyId)) {
        enemyHistory.set(enemyId, []);
      }

      const ctw = ctwModels.get(enemyId);
      const history = enemyHistory.get(enemyId);

      // Is this one of the last 150 battles?
      if (b.timestamp >= cutoffTimestamp) {
        // Make prediction using current model state
        if (ctw.history.length >= 2 && history.length >= 2) {
          const ctwProbs = ctw.predict() || { rock: 1/3, paper: 1/3, scissor: 1/3 };

          // Get 2-gram prediction
          const key2 = `${history[history.length-2]},${history[history.length-1]}`;
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

          // 20/80 ensemble
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
          const mlMove = Object.entries(ev).reduce((a, c) => c[1] > a[1] ? c : a)[0];

          // Check ML result
          tested++;
          if (mlMove === counter[b.enemy_move]) mlWins++;
          else if (b.enemy_move === counter[mlMove]) mlLosses++;
          else mlTies++;

          // Track prediction accuracy
          const predictedEnemy = Object.entries(pEnemy).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          if (predictedEnemy === b.enemy_move) correctPredictions++;

          // Track actual result
          if (b.result === 'win') actualWins++;
          else if (b.result === 'loss') actualLosses++;
          else actualTies++;
        }
      }

      // Always update models (for warm start)
      ctw.update(b.enemy_move);
      history.push(b.enemy_move);
      if (history.length >= 2) {
        const key = `${history[history.length-2]},${history[history.length-1]}`;
        gram2.get(key)[b.enemy_move]++;
      }
    }

    console.log(`\nTested ${tested} of last 150 battles (some lack context)\n`);

    console.log('=== ML PREDICTIONS (what should have happened) ===');
    console.log(`  Wins:   ${mlWins} (${(mlWins/tested*100).toFixed(1)}%)`);
    console.log(`  Losses: ${mlLosses} (${(mlLosses/tested*100).toFixed(1)}%)`);
    console.log(`  Ties:   ${mlTies} (${(mlTies/tested*100).toFixed(1)}%)`);
    console.log(`  Net:    ${((mlWins - mlLosses)/tested*100).toFixed(2)}%`);

    console.log('\n=== ACTUAL RESULTS (what really happened) ===');
    console.log(`  Wins:   ${actualWins} (${(actualWins/tested*100).toFixed(1)}%)`);
    console.log(`  Losses: ${actualLosses} (${(actualLosses/tested*100).toFixed(1)}%)`);
    console.log(`  Ties:   ${actualTies} (${(actualTies/tested*100).toFixed(1)}%)`);
    console.log(`  Net:    ${((actualWins - actualLosses)/tested*100).toFixed(2)}%`);

    console.log('\n=== PREDICTION ACCURACY ===');
    console.log(`  Correctly predicted enemy move: ${correctPredictions}/${tested} (${(correctPredictions/tested*100).toFixed(1)}%)`);
    console.log(`  Random baseline: 33.3%`);

    console.log('\n=== DIFFERENCE ===');
    const mlNet = (mlWins - mlLosses)/tested*100;
    const actualNet = (actualWins - actualLosses)/tested*100;
    console.log(`  ML would have been: ${mlNet >= actualNet ? '+' : ''}${(mlNet - actualNet).toFixed(2)}% better`);

    db.close();
  });
});
