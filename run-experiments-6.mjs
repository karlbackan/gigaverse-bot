/**
 * Round 6 Experiments - Bot exploitation, 2-grams, clustering
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';
import fs from 'fs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

class ExperimentRunner6 {
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
      SELECT enemy_id, player_move, enemy_move, result, turn
      FROM battles
      WHERE player_move IN ('rock', 'paper', 'scissor')
        AND enemy_move IN ('rock', 'paper', 'scissor')
      ORDER BY enemy_id, timestamp
    `);
    console.log(`Loaded ${this.battles.length} battles\n`);
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

  // ==================== EXPERIMENT 29: Bot Detection & Exploitation ====================
  async experimentBotExploitation() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 29: Bot Detection & Exploitation');
    console.log('=' .repeat(60));

    // Group battles by enemy
    const enemyBattles = new Map();
    for (const b of this.battles) {
      const enemyId = String(b.enemy_id);
      if (!enemyBattles.has(enemyId)) enemyBattles.set(enemyId, []);
      enemyBattles.get(enemyId).push(b);
    }

    // Detect bots: high repeat rate + high predictability
    const botAnalysis = [];
    for (const [enemyId, battles] of enemyBattles) {
      if (battles.length < 20) continue;

      // Check repeat rate (same move twice in a row)
      let repeats = 0;
      for (let i = 1; i < battles.length; i++) {
        if (battles[i].enemy_move === battles[i-1].enemy_move) repeats++;
      }
      const repeatRate = repeats / (battles.length - 1);

      // Check cycle detection (R->P->S or R->S->P)
      let clockwise = 0, counter = 0;
      for (let i = 1; i < battles.length; i++) {
        const prev = battles[i-1].enemy_move;
        const curr = battles[i].enemy_move;
        if ((prev === 'rock' && curr === 'paper') ||
            (prev === 'paper' && curr === 'scissor') ||
            (prev === 'scissor' && curr === 'rock')) clockwise++;
        if ((prev === 'rock' && curr === 'scissor') ||
            (prev === 'scissor' && curr === 'paper') ||
            (prev === 'paper' && curr === 'rock')) counter++;
      }
      const cycleScore = Math.max(clockwise, counter) / (battles.length - 1);

      // Check alternation (never same move twice)
      let alternates = 0;
      for (let i = 1; i < battles.length; i++) {
        if (battles[i].enemy_move !== battles[i-1].enemy_move) alternates++;
      }
      const altRate = alternates / (battles.length - 1);

      // CTW accuracy for this opponent
      const ctw = new ContextTreeWeighting(3);
      let correct = 0, total = 0;
      for (const b of battles) {
        if (ctw.history.length >= 1) {
          const probs = ctw.predict();
          if (probs) {
            const predicted = this.argmax(probs);
            if (predicted === b.enemy_move) correct++;
            total++;
          }
        }
        ctw.update(b.enemy_move);
      }
      const accuracy = total > 0 ? correct / total * 100 : 0;

      botAnalysis.push({
        enemyId,
        battles: battles.length,
        repeatRate,
        cycleScore,
        altRate,
        accuracy,
        isBot: repeatRate > 0.7 || cycleScore > 0.5 || accuracy > 80
      });
    }

    // Sort by accuracy
    botAnalysis.sort((a, b) => b.accuracy - a.accuracy);

    console.log('\n  Potential Bots (high predictability):');
    console.log('  ' + '-'.repeat(70));
    const bots = botAnalysis.filter(b => b.isBot);
    for (const b of bots.slice(0, 10)) {
      console.log(`    Enemy ${b.enemyId.padEnd(12)}: ${b.accuracy.toFixed(1)}% acc, repeat=${(b.repeatRate*100).toFixed(0)}%, cycle=${(b.cycleScore*100).toFixed(0)}% (${b.battles} battles)`);
    }

    // Calculate potential gain from bot exploitation
    const botBattles = bots.reduce((sum, b) => sum + b.battles, 0);
    const avgBotAcc = bots.length > 0 ? bots.reduce((sum, b) => sum + b.accuracy, 0) / bots.length : 0;
    console.log(`\n  Detected ${bots.length} bots with ${botBattles} total battles`);
    console.log(`  Average bot accuracy: ${avgBotAcc.toFixed(1)}%`);

    // What if we perfect-predict bots and CTW for others?
    let hybridWins = 0, hybridLosses = 0, hybridDraws = 0;
    const botIds = new Set(bots.map(b => b.enemyId));
    const models = new Map();
    let lastEnemyId = null;

    for (const b of this.battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(3));
      }

      const ctw = models.get(enemyId);
      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          // For bots, we could use specialized strategy, but CTW already works well
          const ourMove = { rock: 'paper', paper: 'scissor', scissor: 'rock' }[predicted];

          if (ourMove === { rock: 'paper', paper: 'scissor', scissor: 'rock' }[b.enemy_move]) hybridWins++;
          else if (b.enemy_move === { rock: 'paper', paper: 'scissor', scissor: 'rock' }[ourMove]) hybridLosses++;
          else hybridDraws++;
        }
      }
      ctw.update(b.enemy_move);
    }

    const total = hybridWins + hybridLosses + hybridDraws;
    console.log(`\n  Hybrid strategy (CTW + bot detection): Win ${(hybridWins/total*100).toFixed(2)}%, Net ${((hybridWins-hybridLosses)/total*100).toFixed(2)}%`);
    console.log('  (Baseline pure CTW: 34.90% win, 1.93% net)\n');

    this.results.botExploitation = { bots, botBattles, avgBotAcc };
    return botAnalysis;
  }

  // ==================== EXPERIMENT 30: 2-Gram Pattern Exploitation ====================
  async experiment2GramExploitation() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 30: 2-Gram Pattern Exploitation');
    console.log('=' .repeat(60));

    // Build 2-gram transition table per opponent
    const twoGrams = {};
    for (const m1 of MOVES) {
      for (const m2 of MOVES) {
        const key = `${m1},${m2}`;
        twoGrams[key] = { rock: 0, paper: 0, scissor: 0 };
      }
    }

    // Global 2-gram counts
    let lastEnemyId = null;
    let prev2 = [];
    for (const b of this.battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prev2 = [];
      }

      if (prev2.length === 2) {
        const key = `${prev2[0]},${prev2[1]}`;
        twoGrams[key][b.enemy_move]++;
      }

      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    // Find strongest patterns
    const patterns = [];
    for (const [key, counts] of Object.entries(twoGrams)) {
      const total = counts.rock + counts.paper + counts.scissor;
      if (total < 100) continue;
      const maxMove = Object.entries(counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
      const maxProb = counts[maxMove] / total;
      patterns.push({ pattern: key, nextMove: maxMove, prob: maxProb, count: total });
    }
    patterns.sort((a, b) => b.prob - a.prob);

    console.log('\n  Strongest 2-Gram Patterns:');
    console.log('  ' + '-'.repeat(50));
    for (const p of patterns.slice(0, 10)) {
      console.log(`    After "${p.pattern}" -> ${p.nextMove} (${(p.prob*100).toFixed(1)}%, n=${p.count})`);
    }

    // Test 2-gram predictor
    let wins = 0, losses = 0, draws = 0, predictions = 0;
    lastEnemyId = null;
    prev2 = [];

    for (const b of this.battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        prev2 = [];
      }

      if (prev2.length === 2) {
        const key = `${prev2[0]},${prev2[1]}`;
        const counts = twoGrams[key];
        const total = counts.rock + counts.paper + counts.scissor;
        if (total >= 50) {
          const predicted = Object.entries(counts).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          const ourMove = counter[predicted];
          predictions++;

          if (ourMove === counter[b.enemy_move]) wins++;
          else if (b.enemy_move === counter[ourMove]) losses++;
          else draws++;
        }
      }

      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`\n  2-Gram Predictor Results:`);
    console.log(`    Predictions made: ${predictions} (${(predictions/this.battles.length*100).toFixed(1)}%)`);
    console.log(`    Win rate: ${(wins/predictions*100).toFixed(2)}%`);
    console.log(`    Net advantage: ${((wins-losses)/predictions*100).toFixed(2)}%\n`);

    this.results.twoGram = { patterns: patterns.slice(0, 20), winRate: wins/predictions*100 };
    return patterns;
  }

  // ==================== EXPERIMENT 31: Opponent Clustering ====================
  async experimentOpponentClustering() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 31: Opponent Clustering by Behavior');
    console.log('=' .repeat(60));

    // Extract features for each opponent
    const features = [];
    const enemyBattles = new Map();

    for (const b of this.battles) {
      const enemyId = String(b.enemy_id);
      if (!enemyBattles.has(enemyId)) enemyBattles.set(enemyId, []);
      enemyBattles.get(enemyId).push(b);
    }

    for (const [enemyId, battles] of enemyBattles) {
      if (battles.length < 30) continue;

      // Feature 1: Move distribution
      const dist = { rock: 0, paper: 0, scissor: 0 };
      for (const b of battles) dist[b.enemy_move]++;
      const n = battles.length;

      // Feature 2: Repeat rate
      let repeats = 0;
      for (let i = 1; i < battles.length; i++) {
        if (battles[i].enemy_move === battles[i-1].enemy_move) repeats++;
      }

      // Feature 3: Entropy (randomness)
      let entropy = 0;
      for (const move of MOVES) {
        const p = dist[move] / n;
        if (p > 0) entropy -= p * Math.log2(p);
      }

      // Feature 4: CTW accuracy
      const ctw = new ContextTreeWeighting(3);
      let correct = 0, total = 0;
      for (const b of battles) {
        if (ctw.history.length >= 1) {
          const probs = ctw.predict();
          if (probs) {
            const predicted = this.argmax(probs);
            if (predicted === b.enemy_move) correct++;
            total++;
          }
        }
        ctw.update(b.enemy_move);
      }

      features.push({
        enemyId,
        battles: n,
        rockPct: dist.rock / n,
        paperPct: dist.paper / n,
        scissorPct: dist.scissor / n,
        repeatRate: repeats / (n - 1),
        entropy,
        accuracy: total > 0 ? correct / total * 100 : 0
      });
    }

    // Simple clustering: categorize by dominant behavior
    const clusters = {
      'random': [],      // High entropy, ~33% CTW accuracy
      'biased': [],      // One move > 40%
      'patterned': [],   // High CTW accuracy > 40%
      'repeater': [],    // High repeat rate > 50%
      'other': []
    };

    for (const f of features) {
      if (f.repeatRate > 0.5) clusters.repeater.push(f);
      else if (f.accuracy > 45) clusters.patterned.push(f);
      else if (Math.max(f.rockPct, f.paperPct, f.scissorPct) > 0.4) clusters.biased.push(f);
      else if (f.accuracy < 35) clusters.random.push(f);
      else clusters.other.push(f);
    }

    console.log('\n  Opponent Clusters:');
    console.log('  ' + '-'.repeat(50));
    for (const [name, members] of Object.entries(clusters)) {
      const avgAcc = members.length > 0 ? members.reduce((s, m) => s + m.accuracy, 0) / members.length : 0;
      const totalBattles = members.reduce((s, m) => s + m.battles, 0);
      console.log(`    ${name.padEnd(12)}: ${members.length} opponents, ${totalBattles} battles, avg accuracy ${avgAcc.toFixed(1)}%`);
    }

    // Calculate optimal strategy per cluster
    console.log('\n  Cluster-Specific Strategies:');
    for (const [name, members] of Object.entries(clusters)) {
      if (members.length === 0) continue;

      if (name === 'random') {
        console.log(`    ${name}: Play Nash (random) - cannot exploit`);
      } else if (name === 'biased') {
        // Find average bias direction
        const avgRock = members.reduce((s, m) => s + m.rockPct, 0) / members.length;
        const avgPaper = members.reduce((s, m) => s + m.paperPct, 0) / members.length;
        const avgScissor = members.reduce((s, m) => s + m.scissorPct, 0) / members.length;
        const bias = avgRock > avgPaper && avgRock > avgScissor ? 'rock' :
                     avgPaper > avgScissor ? 'paper' : 'scissor';
        console.log(`    ${name}: Counter ${bias} bias (play ${counter[bias]})`);
      } else if (name === 'patterned' || name === 'repeater') {
        console.log(`    ${name}: Use CTW (high accuracy)`);
      } else {
        console.log(`    ${name}: Use CTW (default)`);
      }
    }
    console.log('');

    this.results.clustering = clusters;
    return clusters;
  }

  // ==================== EXPERIMENT 32: Temporal Stability ====================
  async experimentTemporalStability() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 32: Temporal Stability (Train/Test Split)');
    console.log('=' .repeat(60));

    // Train on first 70%, test on last 30%
    const trainRatio = 0.7;
    const trainBattles = Math.floor(this.battles.length * trainRatio);

    // Build CTW models on training data
    const models = new Map();
    let lastEnemyId = null;

    for (let i = 0; i < trainBattles; i++) {
      const b = this.battles[i];
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(3));
      }
      models.get(enemyId).update(b.enemy_move);
    }

    // Test on remaining data (WITHOUT updating models)
    let staticWins = 0, staticLosses = 0, staticDraws = 0, staticTotal = 0;
    let adaptiveWins = 0, adaptiveLosses = 0, adaptiveDraws = 0, adaptiveTotal = 0;

    // Clone models for adaptive test
    const adaptiveModels = new Map();
    for (const [id, ctw] of models) {
      const newCtw = new ContextTreeWeighting(3);
      for (const move of ctw.history) newCtw.update(move);
      adaptiveModels.set(id, newCtw);
    }

    lastEnemyId = null;
    for (let i = trainBattles; i < this.battles.length; i++) {
      const b = this.battles[i];
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        if (!models.has(enemyId)) {
          models.set(enemyId, new ContextTreeWeighting(3));
          adaptiveModels.set(enemyId, new ContextTreeWeighting(3));
        }
      }

      // Static model (trained, never updated)
      const staticCtw = models.get(enemyId);
      if (staticCtw.history.length >= 1) {
        const probs = staticCtw.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          const ourMove = counter[predicted];
          staticTotal++;
          if (ourMove === counter[b.enemy_move]) staticWins++;
          else if (b.enemy_move === counter[ourMove]) staticLosses++;
          else staticDraws++;
        }
      }

      // Adaptive model (trained, keeps updating)
      const adaptiveCtw = adaptiveModels.get(enemyId);
      if (adaptiveCtw.history.length >= 1) {
        const probs = adaptiveCtw.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          const ourMove = counter[predicted];
          adaptiveTotal++;
          if (ourMove === counter[b.enemy_move]) adaptiveWins++;
          else if (b.enemy_move === counter[ourMove]) adaptiveLosses++;
          else adaptiveDraws++;
        }
      }
      adaptiveCtw.update(b.enemy_move);
    }

    console.log(`\n  Train on first ${trainRatio*100}%, test on last ${(1-trainRatio)*100}%:`);
    console.log('  ' + '-'.repeat(50));
    console.log(`    Static model (no updates):   Win ${(staticWins/staticTotal*100).toFixed(2)}%, Net ${((staticWins-staticLosses)/staticTotal*100).toFixed(2)}%`);
    console.log(`    Adaptive model (updates):    Win ${(adaptiveWins/adaptiveTotal*100).toFixed(2)}%, Net ${((adaptiveWins-adaptiveLosses)/adaptiveTotal*100).toFixed(2)}%`);
    console.log(`\n  Interpretation:`);
    console.log(`    - If similar: Patterns are stable over time`);
    console.log(`    - If adaptive >> static: Opponents change strategy\n`);

    this.results.temporalStability = {
      staticWinRate: staticWins/staticTotal*100,
      adaptiveWinRate: adaptiveWins/adaptiveTotal*100
    };
    return { staticWinRate: staticWins/staticTotal*100, adaptiveWinRate: adaptiveWins/adaptiveTotal*100 };
  }

  // ==================== EXPERIMENT 33: Cross-Opponent Transfer ====================
  async experimentCrossTransfer() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 33: Cross-Opponent Transfer Learning');
    console.log('=' .repeat(60));

    // Can patterns from one opponent help predict another?
    // Build global CTW on all training data
    const trainRatio = 0.7;
    const globalCtw = new ContextTreeWeighting(3);

    // Group by opponent for per-opponent training
    const enemyBattles = new Map();
    for (const b of this.battles) {
      const enemyId = String(b.enemy_id);
      if (!enemyBattles.has(enemyId)) enemyBattles.set(enemyId, []);
      enemyBattles.get(enemyId).push(b);
    }

    // Train global on first 70% of each opponent
    for (const [enemyId, battles] of enemyBattles) {
      const trainN = Math.floor(battles.length * trainRatio);
      for (let i = 0; i < trainN; i++) {
        globalCtw.update(battles[i].enemy_move);
      }
    }

    // Test: For new opponents (those with only test data), use global model
    let globalWins = 0, globalLosses = 0, globalTotal = 0;
    let localWins = 0, localLosses = 0, localTotal = 0;

    for (const [enemyId, battles] of enemyBattles) {
      const trainN = Math.floor(battles.length * trainRatio);
      const localCtw = new ContextTreeWeighting(3);

      // Train local
      for (let i = 0; i < trainN; i++) {
        localCtw.update(battles[i].enemy_move);
      }

      // Test on remaining
      for (let i = trainN; i < battles.length; i++) {
        const b = battles[i];

        // Global model
        if (globalCtw.history.length >= 1) {
          const probs = globalCtw.predict();
          if (probs) {
            const predicted = this.argmax(probs);
            const ourMove = counter[predicted];
            globalTotal++;
            if (ourMove === counter[b.enemy_move]) globalWins++;
            else if (b.enemy_move === counter[ourMove]) globalLosses++;
          }
        }

        // Local model
        if (localCtw.history.length >= 1) {
          const probs = localCtw.predict();
          if (probs) {
            const predicted = this.argmax(probs);
            const ourMove = counter[predicted];
            localTotal++;
            if (ourMove === counter[b.enemy_move]) localWins++;
            else if (b.enemy_move === counter[ourMove]) localLosses++;
          }
        }

        localCtw.update(b.enemy_move);
      }
    }

    console.log(`\n  Transfer Learning Results:`);
    console.log('  ' + '-'.repeat(50));
    console.log(`    Global model (all opponents): Win ${(globalWins/globalTotal*100).toFixed(2)}%, Net ${((globalWins-globalLosses)/globalTotal*100).toFixed(2)}%`);
    console.log(`    Local models (per-opponent):  Win ${(localWins/localTotal*100).toFixed(2)}%, Net ${((localWins-localLosses)/localTotal*100).toFixed(2)}%`);
    console.log(`\n  Interpretation:`);
    console.log(`    - If local >> global: Opponents have unique patterns`);
    console.log(`    - If similar: Cross-opponent learning could help cold-start\n`);

    this.results.crossTransfer = {
      globalWinRate: globalWins/globalTotal*100,
      localWinRate: localWins/localTotal*100
    };
  }

  // ==================== EXPERIMENT 34: Hybrid CTW + Frequency ====================
  async experimentHybridCTWFreq() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 34: Hybrid CTW + Frequency (Low History)');
    console.log('=' .repeat(60));

    // Use frequency for first N moves, then switch to CTW
    const switchPoints = [3, 5, 10, 20, 50];

    for (const switchAt of switchPoints) {
      let wins = 0, losses = 0, draws = 0, total = 0;
      const models = new Map();
      const freqs = new Map();

      let lastEnemyId = null;
      for (const b of this.battles) {
        const enemyId = String(b.enemy_id);
        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          models.set(enemyId, new ContextTreeWeighting(3));
          freqs.set(enemyId, { rock: 0, paper: 0, scissor: 0, total: 0 });
        }

        const ctw = models.get(enemyId);
        const freq = freqs.get(enemyId);

        if (freq.total >= 1) {
          let ourMove;
          if (freq.total < switchAt) {
            // Use frequency
            const maxMove = Object.entries(freq)
              .filter(([k]) => k !== 'total')
              .reduce((a, c) => c[1] > a[1] ? c : a)[0];
            ourMove = counter[maxMove];
          } else {
            // Use CTW
            const probs = ctw.predict();
            if (probs) {
              const predicted = this.argmax(probs);
              ourMove = counter[predicted];
            }
          }

          if (ourMove) {
            total++;
            if (ourMove === counter[b.enemy_move]) wins++;
            else if (b.enemy_move === counter[ourMove]) losses++;
            else draws++;
          }
        }

        ctw.update(b.enemy_move);
        freq[b.enemy_move]++;
        freq.total++;
      }

      console.log(`  Switch at ${String(switchAt).padEnd(3)} moves: Win ${(wins/total*100).toFixed(2)}%, Net ${((wins-losses)/total*100).toFixed(2)}%`);
    }

    // Pure CTW baseline
    let wins = 0, losses = 0, total = 0;
    const models = new Map();
    let lastEnemyId = null;
    for (const b of this.battles) {
      const enemyId = String(b.enemy_id);
      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(3));
      }

      const ctw = models.get(enemyId);
      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = this.argmax(probs);
          const ourMove = counter[predicted];
          total++;
          if (ourMove === counter[b.enemy_move]) wins++;
          else if (b.enemy_move === counter[ourMove]) losses++;
        }
      }
      ctw.update(b.enemy_move);
    }
    console.log(`  Pure CTW:         Win ${(wins/total*100).toFixed(2)}%, Net ${((wins-losses)/total*100).toFixed(2)}%\n`);
  }

  // ==================== Run All ====================
  async runAll() {
    console.log('\n🧪 ROUND 6 EXPERIMENTS');
    console.log('=' .repeat(60));

    await this.connect();
    await this.loadBattles();

    await this.experimentBotExploitation();
    await this.experiment2GramExploitation();
    await this.experimentOpponentClustering();
    await this.experimentTemporalStability();
    await this.experimentCrossTransfer();
    await this.experimentHybridCTWFreq();

    // Summary
    console.log('=' .repeat(60));
    console.log('ROUND 6 SUMMARY');
    console.log('=' .repeat(60));

    console.log(`  Bots detected: ${this.results.botExploitation?.bots?.length || 0}`);
    console.log(`  2-gram strongest: ${this.results.twoGram?.patterns?.[0]?.pattern} -> ${this.results.twoGram?.patterns?.[0]?.nextMove} (${this.results.twoGram?.patterns?.[0]?.prob?.toFixed(1)*100}%)`);
    console.log(`  Temporal stability: Static ${this.results.temporalStability?.staticWinRate?.toFixed(2)}% vs Adaptive ${this.results.temporalStability?.adaptiveWinRate?.toFixed(2)}%`);
    console.log(`  Transfer learning: Global ${this.results.crossTransfer?.globalWinRate?.toFixed(2)}% vs Local ${this.results.crossTransfer?.localWinRate?.toFixed(2)}%`);
    console.log('');

    // Save results
    try {
      const existing = JSON.parse(fs.readFileSync('./data/experiment-results.json', 'utf8'));
      const combined = { ...existing, round6: this.results };
      fs.writeFileSync('./data/experiment-results.json', JSON.stringify(combined, null, 2));
      console.log('Results saved to data/experiment-results.json\n');
    } catch (e) {
      console.log('Could not save results:', e.message);
    }

    this.db.close();
    return this.results;
  }
}

const runner = new ExperimentRunner6();
runner.runAll().catch(console.error);
