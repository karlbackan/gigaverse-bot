/**
 * Feature Importance Analysis
 *
 * Analyzes historical battle data to find the most predictive features
 * for enemy move prediction.
 */

import sqlite3 from 'sqlite3';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class FeatureAnalyzer {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async query(sql) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async analyzeAll() {
    console.log('🔬 FEATURE IMPORTANCE ANALYSIS');
    console.log('='.repeat(60));

    await this.connect();

    const results = {};

    // 1. Enemy charge correlation
    console.log('\n📊 1. ENEMY CHARGE CORRELATION');
    results.charges = await this.analyzeChargeCorrelation();

    // 2. Turn number patterns
    console.log('\n📊 2. TURN NUMBER PATTERNS');
    results.turns = await this.analyzeTurnPatterns();

    // 3. Health-based patterns
    console.log('\n📊 3. HEALTH-BASED PATTERNS');
    results.health = await this.analyzeHealthPatterns();

    // 4. Reaction to player's last move
    console.log('\n📊 4. REACTION TO PLAYER MOVES');
    results.reaction = await this.analyzeReactionPatterns();

    // 5. Markov chains (enemy's own sequence)
    console.log('\n📊 5. MARKOV CHAIN PATTERNS');
    results.markov = await this.analyzeMarkovPatterns();

    // 6. Win/loss momentum
    console.log('\n📊 6. WIN/LOSS MOMENTUM');
    results.momentum = await this.analyzeMomentumPatterns();

    // 7. Per-enemy predictability
    console.log('\n📊 7. PER-ENEMY PREDICTABILITY');
    results.perEnemy = await this.analyzePerEnemyPatterns();

    // Summary
    this.printSummary(results);

    this.db.close();
    return results;
  }

  async analyzeChargeCorrelation() {
    // Check correlation between enemy's highest charge and their move
    const sql = `
      WITH charge_analysis AS (
        SELECT
          enemy_move,
          json_extract(enemy_stats, '$.charges.rock') as rock_charges,
          json_extract(enemy_stats, '$.charges.paper') as paper_charges,
          json_extract(enemy_stats, '$.charges.scissor') as scissor_charges
        FROM battles
        WHERE enemy_stats IS NOT NULL
          AND enemy_move IN ('rock', 'paper', 'scissor')
          AND json_extract(enemy_stats, '$.charges') IS NOT NULL
      )
      SELECT
        CASE
          WHEN rock_charges > paper_charges AND rock_charges > scissor_charges THEN 'rock_highest'
          WHEN paper_charges > rock_charges AND paper_charges > scissor_charges THEN 'paper_highest'
          WHEN scissor_charges > rock_charges AND scissor_charges > paper_charges THEN 'scissor_highest'
          ELSE 'tied'
        END as highest_charge,
        enemy_move,
        COUNT(*) as cnt
      FROM charge_analysis
      GROUP BY highest_charge, enemy_move
    `;

    const rows = await this.query(sql);

    // Calculate correlations
    const byHighest = {};
    for (const row of rows) {
      if (!byHighest[row.highest_charge]) byHighest[row.highest_charge] = {};
      byHighest[row.highest_charge][row.enemy_move] = row.cnt;
    }

    console.log('   When enemy has most charges in X, probability they play X:');

    let avgLift = 0;
    let count = 0;

    for (const [highest, moves] of Object.entries(byHighest)) {
      if (highest === 'tied') continue;

      const total = Object.values(moves).reduce((a, b) => a + b, 0);
      const targetMove = highest.replace('_highest', '');
      const targetPct = (moves[targetMove] || 0) / total * 100;
      const lift = targetPct - 33.3;

      console.log(`   ${highest}: ${targetPct.toFixed(1)}% (lift: ${lift > 0 ? '+' : ''}${lift.toFixed(1)}%)`);
      avgLift += Math.abs(lift);
      count++;
    }

    return { avgLift: avgLift / count, predictive: avgLift / count > 3 };
  }

  async analyzeTurnPatterns() {
    const sql = `
      SELECT
        turn,
        enemy_move,
        COUNT(*) as cnt
      FROM battles
      WHERE enemy_move IN ('rock', 'paper', 'scissor')
        AND turn <= 10
      GROUP BY turn, enemy_move
    `;

    const rows = await this.query(sql);

    const byTurn = {};
    for (const row of rows) {
      if (!byTurn[row.turn]) byTurn[row.turn] = {};
      byTurn[row.turn][row.enemy_move] = row.cnt;
    }

    console.log('   Move distribution by turn (deviation from 33.3%):');

    let maxDeviation = 0;

    for (let turn = 1; turn <= 5; turn++) {
      if (!byTurn[turn]) continue;
      const total = Object.values(byTurn[turn]).reduce((a, b) => a + b, 0);
      const deviations = MOVES.map(m => {
        const pct = (byTurn[turn][m] || 0) / total * 100;
        return Math.abs(pct - 33.3);
      });
      const maxDev = Math.max(...deviations);
      maxDeviation = Math.max(maxDeviation, maxDev);

      const rockPct = ((byTurn[turn].rock || 0) / total * 100).toFixed(1);
      const paperPct = ((byTurn[turn].paper || 0) / total * 100).toFixed(1);
      const scissorPct = ((byTurn[turn].scissor || 0) / total * 100).toFixed(1);
      console.log(`   Turn ${turn}: R=${rockPct}% P=${paperPct}% S=${scissorPct}%`);
    }

    return { maxDeviation, predictive: maxDeviation > 3 };
  }

  async analyzeHealthPatterns() {
    const sql = `
      SELECT
        CASE
          WHEN CAST(json_extract(enemy_stats, '$.healthPercent') AS INTEGER) > 70 THEN 'high'
          WHEN CAST(json_extract(enemy_stats, '$.healthPercent') AS INTEGER) > 30 THEN 'medium'
          ELSE 'low'
        END as health_state,
        enemy_move,
        COUNT(*) as cnt
      FROM battles
      WHERE enemy_stats IS NOT NULL
        AND enemy_move IN ('rock', 'paper', 'scissor')
        AND json_extract(enemy_stats, '$.healthPercent') IS NOT NULL
      GROUP BY health_state, enemy_move
    `;

    const rows = await this.query(sql);

    const byHealth = {};
    for (const row of rows) {
      if (!byHealth[row.health_state]) byHealth[row.health_state] = {};
      byHealth[row.health_state][row.enemy_move] = row.cnt;
    }

    console.log('   Move distribution by enemy health state:');

    let maxDeviation = 0;

    for (const [state, moves] of Object.entries(byHealth)) {
      const total = Object.values(moves).reduce((a, b) => a + b, 0);
      const deviations = MOVES.map(m => Math.abs((moves[m] || 0) / total * 100 - 33.3));
      maxDeviation = Math.max(maxDeviation, ...deviations);

      const rockPct = ((moves.rock || 0) / total * 100).toFixed(1);
      const paperPct = ((moves.paper || 0) / total * 100).toFixed(1);
      const scissorPct = ((moves.scissor || 0) / total * 100).toFixed(1);
      console.log(`   ${state.padEnd(6)} health: R=${rockPct}% P=${paperPct}% S=${scissorPct}%`);
    }

    return { maxDeviation, predictive: maxDeviation > 3 };
  }

  async analyzeReactionPatterns() {
    // Do enemies react to our previous move?
    const sql = `
      WITH sequential AS (
        SELECT
          enemy_id,
          enemy_move,
          LAG(player_move) OVER (PARTITION BY enemy_id ORDER BY timestamp) as our_prev_move
        FROM battles
        WHERE enemy_move IN ('rock', 'paper', 'scissor')
          AND player_move IN ('rock', 'paper', 'scissor')
      )
      SELECT
        our_prev_move,
        enemy_move,
        COUNT(*) as cnt
      FROM sequential
      WHERE our_prev_move IS NOT NULL
      GROUP BY our_prev_move, enemy_move
    `;

    const rows = await this.query(sql);

    const byOurMove = {};
    for (const row of rows) {
      if (!byOurMove[row.our_prev_move]) byOurMove[row.our_prev_move] = {};
      byOurMove[row.our_prev_move][row.enemy_move] = row.cnt;
    }

    console.log('   Enemy response to our previous move:');

    let counterRate = 0;
    let copyRate = 0;
    let total = 0;

    const counterMap = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

    for (const [ourMove, theirMoves] of Object.entries(byOurMove)) {
      const moveTotal = Object.values(theirMoves).reduce((a, b) => a + b, 0);
      const counterMove = counterMap[ourMove];
      const counterPct = (theirMoves[counterMove] || 0) / moveTotal * 100;
      const copyPct = (theirMoves[ourMove] || 0) / moveTotal * 100;

      console.log(`   After we play ${ourMove}: counter=${counterPct.toFixed(1)}%, copy=${copyPct.toFixed(1)}%`);

      counterRate += counterPct;
      copyRate += copyPct;
      total++;
    }

    counterRate /= total;
    copyRate /= total;

    console.log(`   Average counter rate: ${counterRate.toFixed(1)}% (33.3% = random)`);
    console.log(`   Average copy rate: ${copyRate.toFixed(1)}% (33.3% = random)`);

    return {
      counterRate,
      copyRate,
      predictive: Math.abs(counterRate - 33.3) > 2 || Math.abs(copyRate - 33.3) > 2
    };
  }

  async analyzeMarkovPatterns() {
    // Enemy's move based on their previous move
    const sql = `
      WITH sequential AS (
        SELECT
          enemy_id,
          enemy_move,
          LAG(enemy_move) OVER (PARTITION BY enemy_id ORDER BY timestamp) as their_prev_move
        FROM battles
        WHERE enemy_move IN ('rock', 'paper', 'scissor')
      )
      SELECT
        their_prev_move,
        enemy_move,
        COUNT(*) as cnt
      FROM sequential
      WHERE their_prev_move IS NOT NULL
      GROUP BY their_prev_move, enemy_move
    `;

    const rows = await this.query(sql);

    const byPrevMove = {};
    for (const row of rows) {
      if (!byPrevMove[row.their_prev_move]) byPrevMove[row.their_prev_move] = {};
      byPrevMove[row.their_prev_move][row.enemy_move] = row.cnt;
    }

    console.log('   Markov-1 transitions (enemy\'s next move based on their previous):');

    let repeatRate = 0;
    let cycleRate = 0;  // rock->paper->scissor->rock
    let total = 0;

    const cycleMap = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

    for (const [prevMove, nextMoves] of Object.entries(byPrevMove)) {
      const moveTotal = Object.values(nextMoves).reduce((a, b) => a + b, 0);
      const repeatPct = (nextMoves[prevMove] || 0) / moveTotal * 100;
      const cyclePct = (nextMoves[cycleMap[prevMove]] || 0) / moveTotal * 100;

      console.log(`   After ${prevMove}: repeat=${repeatPct.toFixed(1)}%, cycle=${cyclePct.toFixed(1)}%`);

      repeatRate += repeatPct;
      cycleRate += cyclePct;
      total++;
    }

    repeatRate /= total;
    cycleRate /= total;

    console.log(`   Average repeat rate: ${repeatRate.toFixed(1)}% (33.3% = random)`);
    console.log(`   Average cycle rate: ${cycleRate.toFixed(1)}% (33.3% = random)`);

    return {
      repeatRate,
      cycleRate,
      predictive: Math.abs(repeatRate - 33.3) > 2 || Math.abs(cycleRate - 33.3) > 2
    };
  }

  async analyzeMomentumPatterns() {
    // Does the enemy change behavior after winning/losing?
    const sql = `
      WITH sequential AS (
        SELECT
          enemy_id,
          enemy_move,
          LAG(result) OVER (PARTITION BY enemy_id ORDER BY timestamp) as our_prev_result
        FROM battles
        WHERE enemy_move IN ('rock', 'paper', 'scissor')
      )
      SELECT
        CASE our_prev_result
          WHEN 'win' THEN 'after_we_won'
          WHEN 'loss' THEN 'after_we_lost'
          WHEN 'draw' THEN 'after_draw'
          ELSE 'first'
        END as momentum,
        enemy_move,
        COUNT(*) as cnt
      FROM sequential
      WHERE our_prev_result IS NOT NULL
      GROUP BY momentum, enemy_move
    `;

    const rows = await this.query(sql);

    const byMomentum = {};
    for (const row of rows) {
      if (!byMomentum[row.momentum]) byMomentum[row.momentum] = {};
      byMomentum[row.momentum][row.enemy_move] = row.cnt;
    }

    console.log('   Enemy move distribution after different outcomes:');

    let maxDeviation = 0;

    for (const [momentum, moves] of Object.entries(byMomentum)) {
      const total = Object.values(moves).reduce((a, b) => a + b, 0);
      const deviations = MOVES.map(m => Math.abs((moves[m] || 0) / total * 100 - 33.3));
      maxDeviation = Math.max(maxDeviation, ...deviations);

      const rockPct = ((moves.rock || 0) / total * 100).toFixed(1);
      const paperPct = ((moves.paper || 0) / total * 100).toFixed(1);
      const scissorPct = ((moves.scissor || 0) / total * 100).toFixed(1);
      console.log(`   ${momentum.padEnd(14)}: R=${rockPct}% P=${paperPct}% S=${scissorPct}%`);
    }

    return { maxDeviation, predictive: maxDeviation > 2 };
  }

  async analyzePerEnemyPatterns() {
    // Which enemies are most predictable?
    const sql = `
      WITH enemy_stats AS (
        SELECT
          enemy_id,
          COUNT(*) as battles,
          SUM(CASE WHEN enemy_move = 'rock' THEN 1 ELSE 0 END) as rock,
          SUM(CASE WHEN enemy_move = 'paper' THEN 1 ELSE 0 END) as paper,
          SUM(CASE WHEN enemy_move = 'scissor' THEN 1 ELSE 0 END) as scissor
        FROM battles
        WHERE enemy_move IN ('rock', 'paper', 'scissor')
        GROUP BY enemy_id
        HAVING COUNT(*) >= 50
      )
      SELECT
        enemy_id,
        battles,
        rock, paper, scissor,
        -- Chi-square for randomness
        (POWER(rock - battles/3.0, 2) / (battles/3.0)) +
        (POWER(paper - battles/3.0, 2) / (battles/3.0)) +
        (POWER(scissor - battles/3.0, 2) / (battles/3.0)) as chi_sq,
        -- Max single move percentage
        MAX(100.0 * rock / battles, 100.0 * paper / battles, 100.0 * scissor / battles) as max_pct
      FROM enemy_stats
      ORDER BY chi_sq DESC
      LIMIT 10
    `;

    const rows = await this.query(sql);

    console.log('   Most predictable enemies (highest chi-square):');
    console.log('   Enemy  | Battles | R%    | P%    | S%    | χ²    | Bias');
    console.log('   ' + '-'.repeat(60));

    let predictableCount = 0;

    for (const row of rows) {
      const rPct = (row.rock / row.battles * 100).toFixed(1);
      const pPct = (row.paper / row.battles * 100).toFixed(1);
      const sPct = (row.scissor / row.battles * 100).toFixed(1);
      const biased = row.chi_sq > 5.99 ? 'YES' : 'no';
      if (row.chi_sq > 5.99) predictableCount++;

      console.log(`   ${String(row.enemy_id).padEnd(6)} | ${String(row.battles).padEnd(7)} | ${rPct.padStart(5)} | ${pPct.padStart(5)} | ${sPct.padStart(5)} | ${row.chi_sq.toFixed(2).padStart(5)} | ${biased}`);
    }

    return { predictableCount, totalTested: rows.length };
  }

  printSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📈 FEATURE IMPORTANCE SUMMARY');
    console.log('='.repeat(60));

    const features = [
      { name: 'Enemy Charges (highest)', lift: results.charges.avgLift, predictive: results.charges.predictive },
      { name: 'Turn Number', lift: results.turns.maxDeviation, predictive: results.turns.predictive },
      { name: 'Enemy Health State', lift: results.health.maxDeviation, predictive: results.health.predictive },
      { name: 'Reaction to Our Move', lift: Math.max(Math.abs(results.reaction.counterRate - 33.3), Math.abs(results.reaction.copyRate - 33.3)), predictive: results.reaction.predictive },
      { name: 'Markov-1 (Their Sequence)', lift: Math.max(Math.abs(results.markov.repeatRate - 33.3), Math.abs(results.markov.cycleRate - 33.3)), predictive: results.markov.predictive },
      { name: 'Win/Loss Momentum', lift: results.momentum.maxDeviation, predictive: results.momentum.predictive },
    ];

    // Sort by lift
    features.sort((a, b) => b.lift - a.lift);

    console.log('\n   Feature                    | Lift from Random | Useful?');
    console.log('   ' + '-'.repeat(55));

    for (const f of features) {
      const useful = f.predictive ? '✅ YES' : '❌ No';
      console.log(`   ${f.name.padEnd(28)} | ${('+' + f.lift.toFixed(1) + '%').padStart(16)} | ${useful}`);
    }

    console.log('\n   RECOMMENDED FEATURES TO ADD:');
    for (const f of features) {
      if (f.predictive) {
        console.log(`   ✅ ${f.name}`);
      }
    }
  }
}

// Run analysis
const analyzer = new FeatureAnalyzer();
analyzer.analyzeAll().catch(console.error);
