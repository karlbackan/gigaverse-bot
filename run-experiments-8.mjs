/**
 * Round 8 Experiments - Advanced pattern analysis
 * - Outcome-conditioned 2-grams
 * - Player-conditioned patterns (what they do after WE play X)
 * - Streak-conditioned patterns
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

function getOutcome(playerMove, enemyMove) {
  if (playerMove === counter[enemyMove]) return 'win';
  if (enemyMove === counter[playerMove]) return 'loss';
  return 'draw';
}

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, player_move, enemy_move
  FROM battles
  WHERE player_move IN ('rock','paper','scissor')
    AND enemy_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 8 EXPERIMENTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // ==================== EXPERIMENT 38: Outcome-Conditioned 2-gram ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 38: Outcome-Conditioned 2-gram');
  console.log('='.repeat(60));
  console.log('After (outcome + last enemy move), what do they play?\n');

  // Build outcome-conditioned 2-gram
  const outcomeGrams = {};
  for (const outcome of ['win', 'loss', 'draw']) {
    for (const lastMove of MOVES) {
      outcomeGrams[`${outcome},${lastMove}`] = { rock: 0, paper: 0, scissor: 0 };
    }
  }

  let lastEnemyId = null;
  let prevEnemyMove = null;
  let prevPlayerMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevEnemyMove = null;
      prevPlayerMove = null;
    }

    if (prevEnemyMove && prevPlayerMove) {
      const outcome = getOutcome(prevPlayerMove, prevEnemyMove);  // from enemy perspective
      const enemyOutcome = outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw';
      const key = `${enemyOutcome},${prevEnemyMove}`;
      outcomeGrams[key][b.enemy_move]++;
    }

    prevEnemyMove = b.enemy_move;
    prevPlayerMove = b.player_move;
  }

  // Find strongest patterns
  const outcomePatterns = [];
  for (const [key, counts] of Object.entries(outcomeGrams)) {
    const total = counts.rock + counts.paper + counts.scissor;
    if (total < 100) continue;
    const maxMove = Object.entries(counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
    const maxProb = counts[maxMove] / total;
    outcomePatterns.push({ pattern: key, nextMove: maxMove, prob: maxProb, count: total });
  }
  outcomePatterns.sort((a, b) => b.prob - a.prob);

  console.log('  Strongest outcome-conditioned patterns:');
  for (const p of outcomePatterns.slice(0, 9)) {
    console.log(`    After "${p.pattern}" -> ${p.nextMove} (${(p.prob*100).toFixed(1)}%, n=${p.count})`);
  }

  // Test outcome-conditioned predictor
  let stats = { wins: 0, losses: 0, total: 0 };
  lastEnemyId = null;
  prevEnemyMove = null;
  prevPlayerMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevEnemyMove = null;
      prevPlayerMove = null;
    }

    if (prevEnemyMove && prevPlayerMove) {
      const outcome = getOutcome(prevPlayerMove, prevEnemyMove);
      const enemyOutcome = outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw';
      const key = `${enemyOutcome},${prevEnemyMove}`;
      const counts = outcomeGrams[key];
      const total = counts.rock + counts.paper + counts.scissor;

      if (total >= 50) {
        const predicted = Object.entries(counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        const ourMove = counter[predicted];

        stats.total++;
        if (ourMove === counter[b.enemy_move]) stats.wins++;
        else if (b.enemy_move === counter[ourMove]) stats.losses++;
      }
    }

    prevEnemyMove = b.enemy_move;
    prevPlayerMove = b.player_move;
  }

  console.log(`\n  Outcome-conditioned 2-gram: Win ${(stats.wins/stats.total*100).toFixed(2)}%, Net ${((stats.wins-stats.losses)/stats.total*100).toFixed(2)}%`);

  // ==================== EXPERIMENT 39: Player-Conditioned Patterns ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 39: Player-Conditioned Patterns');
  console.log('='.repeat(60));
  console.log('After WE play X, what do they respond with?\n');

  // Build player-conditioned model
  const playerGrams = {};
  for (const playerMove of MOVES) {
    playerGrams[playerMove] = { rock: 0, paper: 0, scissor: 0 };
  }

  lastEnemyId = null;
  prevPlayerMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevPlayerMove = null;
    }

    if (prevPlayerMove) {
      playerGrams[prevPlayerMove][b.enemy_move]++;
    }

    prevPlayerMove = b.player_move;
  }

  console.log('  After WE play X:');
  for (const [playerMove, counts] of Object.entries(playerGrams)) {
    const total = counts.rock + counts.paper + counts.scissor;
    console.log(`    After we play ${playerMove}: R=${(counts.rock/total*100).toFixed(1)}% P=${(counts.paper/total*100).toFixed(1)}% S=${(counts.scissor/total*100).toFixed(1)}%`);
  }

  // ==================== EXPERIMENT 40: Combined Outcome + Player ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 40: Combined (Outcome + Our Move + Their Move)');
  console.log('='.repeat(60));

  const combinedGrams = {};
  lastEnemyId = null;
  prevEnemyMove = null;
  prevPlayerMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevEnemyMove = null;
      prevPlayerMove = null;
    }

    if (prevEnemyMove && prevPlayerMove) {
      const outcome = getOutcome(prevPlayerMove, prevEnemyMove);
      const key = `${outcome},${prevPlayerMove},${prevEnemyMove}`;
      if (!combinedGrams[key]) combinedGrams[key] = { rock: 0, paper: 0, scissor: 0 };
      combinedGrams[key][b.enemy_move]++;
    }

    prevEnemyMove = b.enemy_move;
    prevPlayerMove = b.player_move;
  }

  // Find strongest combined patterns
  const combinedPatterns = [];
  for (const [key, counts] of Object.entries(combinedGrams)) {
    const total = counts.rock + counts.paper + counts.scissor;
    if (total < 50) continue;
    const maxMove = Object.entries(counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
    const maxProb = counts[maxMove] / total;
    combinedPatterns.push({ pattern: key, nextMove: maxMove, prob: maxProb, count: total });
  }
  combinedPatterns.sort((a, b) => b.prob - a.prob);

  console.log('\n  Strongest combined patterns:');
  for (const p of combinedPatterns.slice(0, 10)) {
    console.log(`    After "${p.pattern}" -> ${p.nextMove} (${(p.prob*100).toFixed(1)}%, n=${p.count})`);
  }

  // Test combined predictor
  stats = { wins: 0, losses: 0, total: 0 };
  lastEnemyId = null;
  prevEnemyMove = null;
  prevPlayerMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prevEnemyMove = null;
      prevPlayerMove = null;
    }

    if (prevEnemyMove && prevPlayerMove) {
      const outcome = getOutcome(prevPlayerMove, prevEnemyMove);
      const key = `${outcome},${prevPlayerMove},${prevEnemyMove}`;
      const counts = combinedGrams[key];

      if (counts) {
        const total = counts.rock + counts.paper + counts.scissor;
        if (total >= 30) {
          const predicted = Object.entries(counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          const ourMove = counter[predicted];

          stats.total++;
          if (ourMove === counter[b.enemy_move]) stats.wins++;
          else if (b.enemy_move === counter[ourMove]) stats.losses++;
        }
      }
    }

    prevEnemyMove = b.enemy_move;
    prevPlayerMove = b.player_move;
  }

  console.log(`\n  Combined 3-feature: Win ${(stats.wins/stats.total*100).toFixed(2)}%, Net ${((stats.wins-stats.losses)/stats.total*100).toFixed(2)}%`);
  console.log(`  Coverage: ${(stats.total/battles.length*100).toFixed(1)}%`);

  // ==================== EXPERIMENT 41: 3-gram (pure enemy moves) ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 41: Compare all 2-gram variants');
  console.log('='.repeat(60));

  // Pure 2-gram (already proven)
  const pure2gram = {};
  for (const m1 of MOVES) {
    for (const m2 of MOVES) {
      pure2gram[`${m1},${m2}`] = { rock: 0, paper: 0, scissor: 0 };
    }
  }

  lastEnemyId = null;
  let prev2 = [];
  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prev2 = [];
    }
    if (prev2.length === 2) {
      pure2gram[`${prev2[0]},${prev2[1]}`][b.enemy_move]++;
    }
    prev2.push(b.enemy_move);
    if (prev2.length > 2) prev2.shift();
  }

  // Test all variants
  const variants = [
    { name: 'Pure 2-gram', model: pure2gram, keyFn: (prev, prevP, prevE, out) => prev.length === 2 ? `${prev[0]},${prev[1]}` : null },
    { name: 'Outcome-conditioned', model: outcomeGrams, keyFn: (prev, prevP, prevE, out) => prevE && out ? `${out},${prevE}` : null },
  ];

  console.log('\n  Variant comparison:');
  console.log('  ' + '-'.repeat(40));
  console.log('  Pure 2-gram:          Win 35.32%, Net 2.94%');
  console.log('  Outcome-conditioned:  (calculated above)');
  console.log('  Combined 3-feature:   (calculated above)');

  // ==================== EXPERIMENT 42: Adaptive Weight Selection ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 42: Confidence-based model selection');
  console.log('='.repeat(60));

  // Use whichever model is more confident
  stats = { wins: 0, losses: 0, total: 0, used2gram: 0, usedOutcome: 0 };
  lastEnemyId = null;
  prev2 = [];
  prevEnemyMove = null;
  prevPlayerMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      prev2 = [];
      prevEnemyMove = null;
      prevPlayerMove = null;
    }

    if (prev2.length === 2 && prevEnemyMove && prevPlayerMove) {
      // Get 2-gram prediction
      const gram2Key = `${prev2[0]},${prev2[1]}`;
      const gram2Counts = pure2gram[gram2Key];
      const gram2Total = gram2Counts.rock + gram2Counts.paper + gram2Counts.scissor;
      const gram2Max = Math.max(gram2Counts.rock, gram2Counts.paper, gram2Counts.scissor) / gram2Total;

      // Get outcome-conditioned prediction
      const outcome = getOutcome(prevPlayerMove, prevEnemyMove);
      const enemyOutcome = outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw';
      const outKey = `${enemyOutcome},${prevEnemyMove}`;
      const outCounts = outcomeGrams[outKey];
      const outTotal = outCounts.rock + outCounts.paper + outCounts.scissor;
      const outMax = Math.max(outCounts.rock, outCounts.paper, outCounts.scissor) / outTotal;

      // Use more confident model
      let predicted, ourMove;
      if (gram2Max >= outMax) {
        predicted = Object.entries(gram2Counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        stats.used2gram++;
      } else {
        predicted = Object.entries(outCounts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        stats.usedOutcome++;
      }
      ourMove = counter[predicted];

      stats.total++;
      if (ourMove === counter[b.enemy_move]) stats.wins++;
      else if (b.enemy_move === counter[ourMove]) stats.losses++;
    }

    prev2.push(b.enemy_move);
    if (prev2.length > 2) prev2.shift();
    prevEnemyMove = b.enemy_move;
    prevPlayerMove = b.player_move;
  }

  console.log(`\n  Max-confidence selection: Win ${(stats.wins/stats.total*100).toFixed(2)}%, Net ${((stats.wins-stats.losses)/stats.total*100).toFixed(2)}%`);
  console.log(`    Used 2-gram: ${stats.used2gram}, Used outcome: ${stats.usedOutcome}`);

  // ==================== Summary ====================
  console.log('\n' + '='.repeat(60));
  console.log('ROUND 8 SUMMARY');
  console.log('='.repeat(60));
  console.log('  Baseline (20/80 CTW+2gram): Net 2.70%');
  console.log('  Outcome-conditioned: See above');
  console.log('  Combined 3-feature: See above');
  console.log('  Max-confidence: See above\n');

  db.close();
});
