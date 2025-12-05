/**
 * Round 10 Experiments - Opponent exploitability detection
 * Can we detect early which opponents are predictable?
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 10 EXPERIMENTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // ==================== EXPERIMENT 46: Early exploitability detection ====================
  console.log('='.repeat(60));
  console.log('EXPERIMENT 46: Early Exploitability Detection');
  console.log('='.repeat(60));
  console.log('After N battles, can we detect if opponent is predictable?\n');

  // Group battles by opponent
  const enemyBattles = new Map();
  for (const b of battles) {
    const enemyId = String(b.enemy_id);
    if (!enemyBattles.has(enemyId)) enemyBattles.set(enemyId, []);
    enemyBattles.get(enemyId).push(b);
  }

  // For each opponent, measure accuracy at different battle counts
  const checkpoints = [5, 10, 20, 50, 100];
  const exploitabilityByCheckpoint = new Map();

  for (const checkpoint of checkpoints) {
    exploitabilityByCheckpoint.set(checkpoint, []);
  }

  for (const [enemyId, opponentBattles] of enemyBattles) {
    if (opponentBattles.length < 100) continue;

    const ctw = new ContextTreeWeighting(3);
    let correct = 0;
    let total = 0;

    for (let i = 0; i < opponentBattles.length; i++) {
      const b = opponentBattles[i];

      // Make prediction
      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = Object.entries(probs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          if (predicted === b.enemy_move) correct++;
          total++;
        }
      }

      // Record exploitability at checkpoints
      for (const checkpoint of checkpoints) {
        if (i === checkpoint - 1) {
          const earlyAcc = total > 0 ? correct / total : 0;
          exploitabilityByCheckpoint.get(checkpoint).push({
            enemyId,
            earlyAccuracy: earlyAcc,
            finalCorrect: 0,  // Will fill later
            finalTotal: 0
          });
        }
      }

      ctw.update(b.enemy_move);
    }

    // Record final accuracy for this opponent
    const finalAcc = total > 0 ? correct / total : 0;
    for (const checkpoint of checkpoints) {
      const entry = exploitabilityByCheckpoint.get(checkpoint).find(e => e.enemyId === enemyId);
      if (entry) {
        entry.finalAccuracy = finalAcc;
      }
    }
  }

  // Analyze correlation between early and final accuracy
  console.log('  Early vs Final Accuracy Correlation:');
  console.log('  ' + '-'.repeat(50));

  for (const checkpoint of checkpoints) {
    const data = exploitabilityByCheckpoint.get(checkpoint);
    if (data.length < 5) continue;

    // Calculate correlation
    const meanEarly = data.reduce((s, d) => s + d.earlyAccuracy, 0) / data.length;
    const meanFinal = data.reduce((s, d) => s + d.finalAccuracy, 0) / data.length;

    let numerator = 0;
    let denomEarly = 0;
    let denomFinal = 0;

    for (const d of data) {
      numerator += (d.earlyAccuracy - meanEarly) * (d.finalAccuracy - meanFinal);
      denomEarly += (d.earlyAccuracy - meanEarly) ** 2;
      denomFinal += (d.finalAccuracy - meanFinal) ** 2;
    }

    const correlation = denomEarly > 0 && denomFinal > 0
      ? numerator / Math.sqrt(denomEarly * denomFinal)
      : 0;

    console.log(`    After ${String(checkpoint).padEnd(3)} battles: r = ${correlation.toFixed(3)} (n=${data.length})`);
  }

  // ==================== EXPERIMENT 47: Entropy-based detection ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 47: Entropy-Based Opponent Classification');
  console.log('='.repeat(60));

  // Calculate entropy for early moves
  const entropyAnalysis = [];

  for (const [enemyId, opponentBattles] of enemyBattles) {
    if (opponentBattles.length < 50) continue;

    // Calculate entropy of first 20 moves
    const first20 = opponentBattles.slice(0, 20);
    const counts = { rock: 0, paper: 0, scissor: 0 };
    for (const b of first20) {
      counts[b.enemy_move]++;
    }

    let entropy = 0;
    for (const move of MOVES) {
      const p = counts[move] / 20;
      if (p > 0) entropy -= p * Math.log2(p);
    }

    // Calculate final accuracy
    const ctw = new ContextTreeWeighting(3);
    let correct = 0;
    let total = 0;

    for (const b of opponentBattles) {
      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = Object.entries(probs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          if (predicted === b.enemy_move) correct++;
          total++;
        }
      }
      ctw.update(b.enemy_move);
    }

    entropyAnalysis.push({
      enemyId,
      entropy,
      finalAccuracy: correct / total,
      battles: opponentBattles.length
    });
  }

  // Sort by entropy
  entropyAnalysis.sort((a, b) => a.entropy - b.entropy);

  console.log('\n  Low Entropy (predictable):');
  for (const e of entropyAnalysis.slice(0, 5)) {
    console.log(`    ${e.enemyId.padEnd(12)}: H=${e.entropy.toFixed(2)}, Acc=${(e.finalAccuracy*100).toFixed(1)}%`);
  }

  console.log('\n  High Entropy (random):');
  for (const e of entropyAnalysis.slice(-5)) {
    console.log(`    ${e.enemyId.padEnd(12)}: H=${e.entropy.toFixed(2)}, Acc=${(e.finalAccuracy*100).toFixed(1)}%`);
  }

  // Correlation between entropy and accuracy
  const meanEntropy = entropyAnalysis.reduce((s, e) => s + e.entropy, 0) / entropyAnalysis.length;
  const meanAcc = entropyAnalysis.reduce((s, e) => s + e.finalAccuracy, 0) / entropyAnalysis.length;

  let numerator = 0;
  let denomE = 0;
  let denomA = 0;

  for (const e of entropyAnalysis) {
    numerator += (e.entropy - meanEntropy) * (e.finalAccuracy - meanAcc);
    denomE += (e.entropy - meanEntropy) ** 2;
    denomA += (e.finalAccuracy - meanAcc) ** 2;
  }

  const entropyCorr = numerator / Math.sqrt(denomE * denomA);
  console.log(`\n  Entropy vs Accuracy correlation: r = ${entropyCorr.toFixed(3)}`);
  console.log('  (Negative = low entropy opponents are more predictable)');

  // ==================== EXPERIMENT 48: Adaptive strategy by opponent type ====================
  console.log('\n' + '='.repeat(60));
  console.log('EXPERIMENT 48: Strategy Selection by Early Entropy');
  console.log('='.repeat(60));

  // Test: Use CTW for low-entropy opponents, Nash for high-entropy
  const entropyThresholds = [1.4, 1.5, 1.55, 1.58];

  for (const threshold of entropyThresholds) {
    let stats = { wins: 0, losses: 0, total: 0, usedCTW: 0, usedNash: 0 };

    for (const [enemyId, opponentBattles] of enemyBattles) {
      if (opponentBattles.length < 30) continue;

      // Calculate entropy of first 20 moves
      const first20 = opponentBattles.slice(0, Math.min(20, opponentBattles.length));
      const counts = { rock: 0, paper: 0, scissor: 0 };
      for (const b of first20) {
        counts[b.enemy_move]++;
      }

      let entropy = 0;
      const n = first20.length;
      for (const move of MOVES) {
        const p = counts[move] / n;
        if (p > 0) entropy -= p * Math.log2(p);
      }

      const isLowEntropy = entropy < threshold;
      const ctw = new ContextTreeWeighting(3);

      for (const b of opponentBattles) {
        if (ctw.history.length >= 1) {
          let ourMove;

          if (isLowEntropy) {
            // Use CTW
            const probs = ctw.predict();
            if (probs) {
              const predicted = Object.entries(probs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
              ourMove = counter[predicted];
              stats.usedCTW++;
            }
          } else {
            // Use Nash (random)
            ourMove = MOVES[Math.floor(Math.random() * 3)];
            stats.usedNash++;
          }

          if (ourMove) {
            stats.total++;
            if (ourMove === counter[b.enemy_move]) stats.wins++;
            else if (b.enemy_move === counter[ourMove]) stats.losses++;
          }
        }

        ctw.update(b.enemy_move);
      }
    }

    const netAdv = stats.total > 0 ? (stats.wins - stats.losses) / stats.total * 100 : 0;
    const ctwPct = (stats.usedCTW / stats.total * 100).toFixed(0);
    console.log(`  Threshold ${threshold.toFixed(2)}: Net ${netAdv.toFixed(2)}% (${ctwPct}% CTW)`);
  }

  // Pure CTW baseline
  let pureStats = { wins: 0, losses: 0, total: 0 };
  for (const [enemyId, opponentBattles] of enemyBattles) {
    if (opponentBattles.length < 30) continue;
    const ctw = new ContextTreeWeighting(3);

    for (const b of opponentBattles) {
      if (ctw.history.length >= 1) {
        const probs = ctw.predict();
        if (probs) {
          const predicted = Object.entries(probs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
          const ourMove = counter[predicted];

          pureStats.total++;
          if (ourMove === counter[b.enemy_move]) pureStats.wins++;
          else if (b.enemy_move === counter[ourMove]) pureStats.losses++;
        }
      }
      ctw.update(b.enemy_move);
    }
  }

  console.log(`\n  Pure CTW:    Net ${((pureStats.wins - pureStats.losses) / pureStats.total * 100).toFixed(2)}%`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('ROUND 10 SUMMARY');
  console.log('='.repeat(60));
  console.log('  Entropy-based detection shows promise but');
  console.log('  pure CTW still performs best overall.\n');

  db.close();
});
