/**
 * Round 16b - Remaining untested features
 * - Weekday vs weekend
 * - Our charges influencing their behavior
 * - Our weapon stats influencing their behavior
 * - Result of previous round influence
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, player_move, enemy_stats, player_stats, weapon_stats, timestamp, result
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 16b - Remaining Untested Features`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // ==================== EXPERIMENT 78: Weekday vs Weekend ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 78: Weekday vs Weekend');
  console.log('='.repeat(60));

  const dayPatterns = {
    weekday: { rock: 0, paper: 0, scissor: 0, total: 0 },
    weekend: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  for (const b of battles) {
    if (!b.timestamp) continue;
    const date = new Date(b.timestamp);
    const day = date.getDay();
    const bucket = (day === 0 || day === 6) ? 'weekend' : 'weekday';
    dayPatterns[bucket][b.enemy_move]++;
    dayPatterns[bucket].total++;
  }

  console.log('\n  Day Type   | Rock    Paper   Scissor | Samples');
  console.log('  ' + '-'.repeat(52));
  for (const [type, counts] of Object.entries(dayPatterns)) {
    if (counts.total > 0) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${type.padEnd(10)} | ${r.padStart(5)}%  ${p.padStart(5)}%  ${s.padStart(5)}%  | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 79: Our charges influence ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 79: Do OUR charges influence their behavior?');
  console.log('='.repeat(60));

  const ourChargeBias = {
    weHaveHighRock: { rock: 0, paper: 0, scissor: 0, total: 0 },
    weHaveHighPaper: { rock: 0, paper: 0, scissor: 0, total: 0 },
    weHaveHighScissor: { rock: 0, paper: 0, scissor: 0, total: 0 },
    balanced: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  for (const b of battles) {
    try {
      const weaponStats = b.weapon_stats ? JSON.parse(b.weapon_stats) : null;
      if (!weaponStats) continue;

      const ourCharges = {
        rock: weaponStats.rock?.charges || 0,
        paper: weaponStats.paper?.charges || 0,
        scissor: weaponStats.scissor?.charges || 0
      };

      const max = Math.max(ourCharges.rock, ourCharges.paper, ourCharges.scissor);
      const min = Math.min(ourCharges.rock, ourCharges.paper, ourCharges.scissor);

      let bucket = 'balanced';
      if (max - min >= 2) {
        if (ourCharges.rock === max) bucket = 'weHaveHighRock';
        else if (ourCharges.paper === max) bucket = 'weHaveHighPaper';
        else bucket = 'weHaveHighScissor';
      }

      ourChargeBias[bucket][b.enemy_move]++;
      ourChargeBias[bucket].total++;
    } catch (e) {}
  }

  console.log('\n  Our Highest  | Enemy: Rock  Paper  Scissor | Samples');
  console.log('  ' + '-'.repeat(54));
  for (const [state, counts] of Object.entries(ourChargeBias)) {
    if (counts.total > 100) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${state.padEnd(17)} | ${r.padStart(7)}%${p.padStart(7)}%${s.padStart(8)}% | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 80: Our weapon attack influence ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 80: Do OUR weapon stats influence their behavior?');
  console.log('='.repeat(60));

  const ourAttackBias = {
    weHighRockAtk: { rock: 0, paper: 0, scissor: 0, total: 0 },
    weHighPaperAtk: { rock: 0, paper: 0, scissor: 0, total: 0 },
    weHighScissorAtk: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  for (const b of battles) {
    try {
      const playerStats = b.player_stats ? JSON.parse(b.player_stats) : null;
      if (!playerStats?.weapons) continue;

      const ourAtk = {
        rock: playerStats.weapons.rock?.attack || 0,
        paper: playerStats.weapons.paper?.attack || 0,
        scissor: playerStats.weapons.scissor?.attack || 0
      };

      const maxAtk = Math.max(ourAtk.rock, ourAtk.paper, ourAtk.scissor);
      let bucket;
      if (ourAtk.rock === maxAtk) bucket = 'weHighRockAtk';
      else if (ourAtk.paper === maxAtk) bucket = 'weHighPaperAtk';
      else bucket = 'weHighScissorAtk';

      ourAttackBias[bucket][b.enemy_move]++;
      ourAttackBias[bucket].total++;
    } catch (e) {}
  }

  console.log('\n  Our High Atk | Enemy: Rock  Paper  Scissor | Samples');
  console.log('  ' + '-'.repeat(54));
  for (const [state, counts] of Object.entries(ourAttackBias)) {
    if (counts.total > 100) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${state.padEnd(17)} | ${r.padStart(7)}%${p.padStart(7)}%${s.padStart(8)}% | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 81: Previous result influence ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 81: Previous Round Result Influence');
  console.log('='.repeat(60));

  const resultInfluence = {
    afterTheyWon: { rock: 0, paper: 0, scissor: 0, total: 0 },
    afterTheyLost: { rock: 0, paper: 0, scissor: 0, total: 0 },
    afterDraw: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  let lastEnemyId = null;
  let lastResult = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      lastResult = null;
    }

    if (lastResult) {
      let bucket;
      if (lastResult === 'win') bucket = 'afterTheyLost';  // we won = they lost
      else if (lastResult === 'loss') bucket = 'afterTheyWon';  // we lost = they won
      else bucket = 'afterDraw';

      resultInfluence[bucket][b.enemy_move]++;
      resultInfluence[bucket].total++;
    }

    lastResult = b.result;
  }

  console.log('\n  After Result | Enemy: Rock  Paper  Scissor | Samples');
  console.log('  ' + '-'.repeat(54));
  for (const [state, counts] of Object.entries(resultInfluence)) {
    if (counts.total > 100) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${state.padEnd(14)} | ${r.padStart(7)}%${p.padStart(7)}%${s.padStart(8)}% | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 82: Streak influence ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 82: Win/Lose Streak Influence');
  console.log('='.repeat(60));

  const streakInfluence = {
    theyOnWinStreak: { rock: 0, paper: 0, scissor: 0, total: 0 },
    theyOnLoseStreak: { rock: 0, paper: 0, scissor: 0, total: 0 },
    noStreak: { rock: 0, paper: 0, scissor: 0, total: 0 }
  };

  lastEnemyId = null;
  let streak = 0;  // positive = they winning, negative = they losing

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      streak = 0;
    }

    let bucket = 'noStreak';
    if (streak >= 2) bucket = 'theyOnWinStreak';
    else if (streak <= -2) bucket = 'theyOnLoseStreak';

    streakInfluence[bucket][b.enemy_move]++;
    streakInfluence[bucket].total++;

    // Update streak
    if (b.result === 'win') streak = Math.min(streak - 1, -1);  // we won = they lost
    else if (b.result === 'loss') streak = Math.max(streak + 1, 1);  // we lost = they won
    else streak = 0;  // draw resets
  }

  console.log('\n  Streak State    | Enemy: Rock  Paper  Scissor | Samples');
  console.log('  ' + '-'.repeat(56));
  for (const [state, counts] of Object.entries(streakInfluence)) {
    if (counts.total > 100) {
      const r = (counts.rock / counts.total * 100).toFixed(1);
      const p = (counts.paper / counts.total * 100).toFixed(1);
      const s = (counts.scissor / counts.total * 100).toFixed(1);
      console.log(`  ${state.padEnd(17)} | ${r.padStart(7)}%${p.padStart(7)}%${s.padStart(8)}% | ${counts.total}`);
    }
  }

  // ==================== EXPERIMENT 83: Move repetition tendency ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 83: Move Repetition Tendency');
  console.log('='.repeat(60));

  let repeats = 0;
  let switches = 0;
  lastEnemyId = null;
  let lastEnemyMove = null;

  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (lastEnemyId !== enemyId) {
      lastEnemyId = enemyId;
      lastEnemyMove = null;
    }

    if (lastEnemyMove) {
      if (b.enemy_move === lastEnemyMove) repeats++;
      else switches++;
    }

    lastEnemyMove = b.enemy_move;
  }

  const repeatRate = (repeats / (repeats + switches) * 100).toFixed(1);
  console.log(`\n  Repeat same move: ${repeatRate}% (expected if random: 33.3%)`);
  console.log(`  Total repeats: ${repeats}, switches: ${switches}`);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  db.close();
});
