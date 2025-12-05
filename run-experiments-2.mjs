/**
 * Round 2 Experiments - Following up on initial findings
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';
import fs from 'fs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class ExperimentRunner2 {
  constructor() {
    this.db = null;
    this.battles = [];
    this.results = {};
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async loadBattles() {
    this.battles = await this.query(`
      SELECT enemy_id, player_move, enemy_move, result, turn, timestamp
      FROM battles
      WHERE player_move IN ('rock', 'paper', 'scissor')
        AND enemy_move IN ('rock', 'paper', 'scissor')
      ORDER BY enemy_id, timestamp
    `);
    console.log(`Loaded ${this.battles.length} battles\n`);
  }

  getCounter(move) {
    return { rock: 'paper', paper: 'scissor', scissor: 'rock' }[move];
  }

  beats(a, b) {
    return (a === 'rock' && b === 'scissor') ||
           (a === 'paper' && b === 'rock') ||
           (a === 'scissor' && b === 'paper');
  }

  argmax(probs) {
    let best = null;
    let bestProb = -1;
    for (const [move, prob] of Object.entries(probs)) {
      if (prob > bestProb) {
        bestProb = prob;
        best = move;
      }
    }
    return best;
  }

  // ==================== EXPERIMENT 9: Adaptive Depth ====================
  async experimentAdaptiveDepth() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 9: Adaptive Depth (more history = deeper)');
    console.log('=' .repeat(60));

    // Strategy: Use depth based on opponent history size
    // < 20 battles: depth 2
    // 20-50 battles: depth 3
    // > 50 battles: depth 4

    const stats = { predictions: 0, correct: 0 };
    const opponentBattles = new Map();
    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        opponentBattles.set(enemyId, 0);
        models.set(enemyId, {
          d2: new ContextTreeWeighting(2),
          d3: new ContextTreeWeighting(3),
          d4: new ContextTreeWeighting(4)
        });
      }

      const count = opponentBattles.get(enemyId);
      const m = models.get(enemyId);

      // Choose depth based on history
      let model;
      if (count < 20) model = m.d2;
      else if (count < 50) model = m.d3;
      else model = m.d4;

      if (model.history.length >= 1) {
        const probs = model.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          stats.predictions++;
          if (predicted === enemy_move) stats.correct++;
        }
      }

      // Update all models
      m.d2.update(enemy_move);
      m.d3.update(enemy_move);
      m.d4.update(enemy_move);
      opponentBattles.set(enemyId, count + 1);
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  Adaptive depth accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%`);
    console.log(`  vs Fixed depth-2: ${(accuracy - 34.83).toFixed(2)}%\n`);

    this.results.adaptiveDepth = { accuracy };
    return { accuracy };
  }

  // ==================== EXPERIMENT 10: Multi-Depth Ensemble ====================
  async experimentMultiDepthEnsemble() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 10: Multi-Depth Ensemble (2+3+4)');
    console.log('=' .repeat(60));

    const stats = { predictions: 0, correct: 0 };
    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, {
          d2: new ContextTreeWeighting(2),
          d3: new ContextTreeWeighting(3),
          d4: new ContextTreeWeighting(4)
        });
      }

      const m = models.get(enemyId);

      // Ensemble: average predictions from all depths
      if (m.d2.history.length >= 1) {
        const p2 = m.d2.predict();
        const p3 = m.d3.predict();
        const p4 = m.d4.predict();

        if (p2 && p3 && p4) {
          const ensemble = {
            rock: (p2.rock + p3.rock + p4.rock) / 3,
            paper: (p2.paper + p3.paper + p4.paper) / 3,
            scissor: (p2.scissor + p3.scissor + p4.scissor) / 3
          };
          const predicted = this.argmax(ensemble);
          stats.predictions++;
          if (predicted === enemy_move) stats.correct++;
        }
      }

      // Update all models
      m.d2.update(enemy_move);
      m.d3.update(enemy_move);
      m.d4.update(enemy_move);
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  Multi-depth ensemble accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%`);
    console.log(`  vs Fixed depth-2: ${(accuracy - 34.83).toFixed(2)}%\n`);

    this.results.multiDepthEnsemble = { accuracy };
    return { accuracy };
  }

  // ==================== EXPERIMENT 11: Streak Detection ====================
  async experimentStreakDetection() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 11: Streak Detection (opponent on streak)');
    console.log('=' .repeat(60));

    // Track opponent streaks and behavior during streaks
    const streakStats = {
      onWinStreak: { rock: 0, paper: 0, scissor: 0 },
      onLoseStreak: { rock: 0, paper: 0, scissor: 0 },
      noStreak: { rock: 0, paper: 0, scissor: 0 }
    };

    const stats = { predictions: 0, correct: 0 };
    const opponentStreaks = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { player_move, enemy_move, result } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        opponentStreaks.set(enemyId, { wins: 0, losses: 0 });
      }

      const streak = opponentStreaks.get(enemyId);

      // Determine streak type
      let streakType;
      if (streak.wins >= 3) streakType = 'onWinStreak';
      else if (streak.losses >= 3) streakType = 'onLoseStreak';
      else streakType = 'noStreak';

      // Record behavior
      streakStats[streakType][enemy_move]++;

      // Predict based on streak behavior (after enough data)
      const counts = streakStats[streakType];
      const total = counts.rock + counts.paper + counts.scissor;
      if (total > 100) {
        const predicted = this.argmax(counts);
        stats.predictions++;
        if (predicted === enemy_move) stats.correct++;
      }

      // Update streaks (from enemy perspective)
      const enemyWon = this.beats(enemy_move, player_move);
      const enemyLost = this.beats(player_move, enemy_move);

      if (enemyWon) {
        streak.wins++;
        streak.losses = 0;
      } else if (enemyLost) {
        streak.losses++;
        streak.wins = 0;
      } else {
        // Draw doesn't break streak
      }
    }

    // Print streak behavior
    console.log('\n  Opponent Behavior by Streak:');
    for (const [type, counts] of Object.entries(streakStats)) {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total > 0) {
        const dist = MOVES.map(m => `${m}: ${(counts[m] / total * 100).toFixed(1)}%`).join(', ');
        console.log(`    ${type.padEnd(15)}: ${dist}`);
      }
    }

    const accuracy = stats.predictions > 0 ? stats.correct / stats.predictions * 100 : 0;
    console.log(`\n  Prediction accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%\n`);

    this.results.streakDetection = { streakStats, accuracy };
    return { streakStats, accuracy };
  }

  // ==================== EXPERIMENT 12: Bot Detection ====================
  async experimentBotDetection() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 12: Bot vs Human Detection');
    console.log('=' .repeat(60));

    // Detect bots by looking for:
    // 1. Exact pattern repeats
    // 2. Very high predictability
    // 3. Low entropy

    const opponentAnalysis = new Map();
    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(2));
        opponentAnalysis.set(enemyId, {
          total: 0,
          correct: 0,
          moves: [],
          repeatPatterns: 0
        });
      }

      const model = models.get(enemyId);
      const analysis = opponentAnalysis.get(enemyId);

      if (model.history.length >= 1) {
        const probs = model.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          if (predicted === enemy_move) analysis.correct++;
        }
      }

      analysis.total++;
      analysis.moves.push(enemy_move);

      // Check for exact 3-move pattern repeats
      if (analysis.moves.length >= 6) {
        const last3 = analysis.moves.slice(-3).join('');
        const prev3 = analysis.moves.slice(-6, -3).join('');
        if (last3 === prev3) analysis.repeatPatterns++;
      }

      model.update(enemy_move);
    }

    // Classify opponents
    const bots = [];
    const humans = [];

    for (const [enemyId, analysis] of opponentAnalysis) {
      if (analysis.total < 20) continue;

      const accuracy = analysis.correct / analysis.total;
      const repeatRate = analysis.repeatPatterns / analysis.total;

      // Bot indicators: high accuracy OR high repeat rate
      const isBot = accuracy > 0.6 || repeatRate > 0.2;

      const entry = {
        enemyId,
        battles: analysis.total,
        accuracy: accuracy * 100,
        repeatRate: repeatRate * 100
      };

      if (isBot) bots.push(entry);
      else humans.push(entry);
    }

    bots.sort((a, b) => b.accuracy - a.accuracy);
    humans.sort((a, b) => b.battles - a.battles);

    console.log(`\n  Detected ${bots.length} likely BOTS:`);
    for (const b of bots.slice(0, 10)) {
      console.log(`    ${b.enemyId.padEnd(15)}: ${b.accuracy.toFixed(1)}% predictable, ${b.repeatRate.toFixed(1)}% repeats (${b.battles} battles)`);
    }

    console.log(`\n  Detected ${humans.length} likely HUMANS (top by battles):`);
    for (const h of humans.slice(0, 10)) {
      console.log(`    ${h.enemyId.padEnd(15)}: ${h.accuracy.toFixed(1)}% predictable, ${h.repeatRate.toFixed(1)}% repeats (${h.battles} battles)`);
    }

    this.results.botDetection = { bots, humans: humans.slice(0, 20) };
    return { bots, humans };
  }

  // ==================== EXPERIMENT 13: Time Patterns ====================
  async experimentTimePatterns() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 13: Time-Based Patterns');
    console.log('=' .repeat(60));

    // Do opponents behave differently based on turn number?
    const turnRangeStats = {
      early: { rock: 0, paper: 0, scissor: 0 },     // turns 1-10
      mid: { rock: 0, paper: 0, scissor: 0 },       // turns 11-50
      late: { rock: 0, paper: 0, scissor: 0 }       // turns 51+
    };

    for (const battle of this.battles) {
      const { enemy_move, turn } = battle;
      if (!enemy_move) continue;

      let range;
      if (turn <= 10) range = 'early';
      else if (turn <= 50) range = 'mid';
      else range = 'late';

      turnRangeStats[range][enemy_move]++;
    }

    console.log('\n  Move Distribution by Turn Range:');
    for (const [range, counts] of Object.entries(turnRangeStats)) {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total > 0) {
        const dist = MOVES.map(m => `${m}: ${(counts[m] / total * 100).toFixed(1)}%`).join(', ');
        console.log(`    ${range.padEnd(8)}: ${dist} (n=${total})`);
      }
    }

    // Calculate entropy for each range
    const entropy = (counts) => {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total === 0) return 0;
      let h = 0;
      for (const c of Object.values(counts)) {
        const p = c / total;
        if (p > 0) h -= p * Math.log2(p);
      }
      return h;
    };

    console.log('\n  Entropy by Range (max 1.585 for uniform):');
    for (const [range, counts] of Object.entries(turnRangeStats)) {
      const h = entropy(counts);
      console.log(`    ${range.padEnd(8)}: ${h.toFixed(3)} ${h < 1.5 ? '(some bias)' : '(uniform)'}`);
    }

    this.results.timePatterns = turnRangeStats;
    return turnRangeStats;
  }

  // ==================== EXPERIMENT 14: Counter Detection ====================
  async experimentCounterDetection() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 14: Counter Detection (are they countering us?)');
    console.log('=' .repeat(60));

    // Do opponents play the counter to our last move?
    const counterStats = {
      countered: 0,    // They played counter to our last move
      same: 0,         // They played same as our last move
      beaten: 0,       // They played what our last move beats
      total: 0
    };

    let lastEnemyId = null;
    let lastPlayerMove = null;

    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { player_move, enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        lastPlayerMove = null;
      }

      if (lastPlayerMove) {
        counterStats.total++;

        const counter = this.getCounter(lastPlayerMove);
        if (enemy_move === counter) {
          counterStats.countered++;
        } else if (enemy_move === lastPlayerMove) {
          counterStats.same++;
        } else {
          counterStats.beaten++;
        }
      }

      lastPlayerMove = player_move;
    }

    const total = counterStats.total;
    console.log('\n  Enemy Response to Our Last Move:');
    console.log(`    Countered our move:  ${(counterStats.countered / total * 100).toFixed(1)}% (${counterStats.countered})`);
    console.log(`    Same as our move:    ${(counterStats.same / total * 100).toFixed(1)}% (${counterStats.same})`);
    console.log(`    Beaten by our move:  ${(counterStats.beaten / total * 100).toFixed(1)}% (${counterStats.beaten})`);
    console.log(`\n    Expected (random): 33.3% each`);

    const counterRate = counterStats.countered / total * 100;
    if (counterRate > 35) {
      console.log(`\n    ⚠️ Opponents may be counter-playing us (${counterRate.toFixed(1)}% > 33.3%)`);
    } else {
      console.log(`\n    ✅ No significant counter-playing detected`);
    }

    this.results.counterDetection = counterStats;
    return counterStats;
  }

  // ==================== Run All Round 2 Experiments ====================
  async runAll() {
    console.log('\n🧪 ROUND 2 EXPERIMENTS');
    console.log('=' .repeat(60));

    await this.connect();
    await this.loadBattles();

    await this.experimentAdaptiveDepth();
    await this.experimentMultiDepthEnsemble();
    await this.experimentStreakDetection();
    await this.experimentBotDetection();
    await this.experimentTimePatterns();
    await this.experimentCounterDetection();

    // Summary
    console.log('=' .repeat(60));
    console.log('ROUND 2 SUMMARY');
    console.log('=' .repeat(60));
    console.log(`  Adaptive Depth:       ${this.results.adaptiveDepth?.accuracy?.toFixed(2) || 'N/A'}%`);
    console.log(`  Multi-Depth Ensemble: ${this.results.multiDepthEnsemble?.accuracy?.toFixed(2) || 'N/A'}%`);
    console.log(`  Streak Detection:     ${this.results.streakDetection?.accuracy?.toFixed(2) || 'N/A'}%`);
    console.log('\n  Baseline depth-2 CTW: 34.83%\n');

    // Append to results file
    const existing = JSON.parse(fs.readFileSync('./data/experiment-results.json', 'utf8'));
    const combined = { ...existing, ...this.results };
    fs.writeFileSync('./data/experiment-results.json', JSON.stringify(combined, null, 2));
    console.log('Results appended to data/experiment-results.json\n');

    this.db.close();
    return this.results;
  }
}

const runner = new ExperimentRunner2();
runner.runAll().catch(console.error);
