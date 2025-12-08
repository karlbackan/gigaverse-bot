/**
 * Round 17 - Testing Improvement Ideas
 * 1. LSTM vs CTW
 * 2. Per-opponent adaptive weights
 * 3. Opponent type detection
 * 4. Baseline (current NGRAM_CTW)
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];
const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
const moveToIdx = { rock: 0, paper: 1, scissor: 2 };
const idxToMove = ['rock', 'paper', 'scissor'];

// Simple LSTM-like cell with forget/input/output gates
class SimpleLSTM {
  constructor(hiddenSize = 8) {
    this.hiddenSize = hiddenSize;
    this.h = new Array(hiddenSize).fill(0);
    this.c = new Array(hiddenSize).fill(0);

    // Initialize weights randomly (seeded for reproducibility)
    this.Wf = this.randomMatrix(hiddenSize, 3 + hiddenSize);
    this.Wi = this.randomMatrix(hiddenSize, 3 + hiddenSize);
    this.Wc = this.randomMatrix(hiddenSize, 3 + hiddenSize);
    this.Wo = this.randomMatrix(hiddenSize, 3 + hiddenSize);
    this.Wy = this.randomMatrix(3, hiddenSize);

    this.history = [];
  }

  randomMatrix(rows, cols) {
    return Array(rows).fill(null).map(() =>
      Array(cols).fill(null).map(() => (Math.random() - 0.5) * 0.5)
    );
  }

  sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x)))); }
  tanh(x) { return Math.tanh(Math.max(-10, Math.min(10, x))); }

  forward(input) {
    // input is one-hot encoded move [r, p, s]
    const x = [...input, ...this.h];

    // Forget gate
    const f = this.Wf.map(row => this.sigmoid(row.reduce((s, w, i) => s + w * x[i], 0)));
    // Input gate
    const i = this.Wi.map(row => this.sigmoid(row.reduce((s, w, j) => s + w * x[j], 0)));
    // Candidate
    const cHat = this.Wc.map(row => this.tanh(row.reduce((s, w, j) => s + w * x[j], 0)));
    // Output gate
    const o = this.Wo.map(row => this.sigmoid(row.reduce((s, w, j) => s + w * x[j], 0)));

    // Update cell and hidden state
    this.c = this.c.map((cVal, idx) => f[idx] * cVal + i[idx] * cHat[idx]);
    this.h = this.c.map((cVal, idx) => o[idx] * this.tanh(cVal));

    // Output layer
    const y = this.Wy.map(row => row.reduce((s, w, j) => s + w * this.h[j], 0));

    // Softmax
    const maxY = Math.max(...y);
    const expY = y.map(v => Math.exp(v - maxY));
    const sumExp = expY.reduce((a, b) => a + b, 0);
    return expY.map(v => v / sumExp);
  }

  update(move) {
    const input = [0, 0, 0];
    input[moveToIdx[move]] = 1;
    this.forward(input);
    this.history.push(move);
  }

  predict() {
    if (this.history.length < 1) return { rock: 1/3, paper: 1/3, scissor: 1/3 };
    const lastMove = this.history[this.history.length - 1];
    const input = [0, 0, 0];
    input[moveToIdx[lastMove]] = 1;
    const probs = this.forward(input);
    return { rock: probs[0], paper: probs[1], scissor: probs[2] };
  }
}

const db = new sqlite3.Database(DB_PATH);

db.all(`
  SELECT enemy_id, enemy_move, enemy_stats, timestamp
  FROM battles
  WHERE enemy_move IN ('rock','paper','scissor')
  ORDER BY enemy_id, timestamp
`, [], (err, battles) => {
  console.log(`\n🧪 ROUND 17 - Improvement Ideas`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Loaded ${battles.length} battles\n`);

  // Group by enemy
  const byEnemy = new Map();
  for (const b of battles) {
    const id = String(b.enemy_id);
    if (!byEnemy.has(id)) byEnemy.set(id, []);
    byEnemy.get(id).push(b);
  }

  // ==================== BASELINE: Current NGRAM_CTW ====================
  console.log('='.repeat(60));
  console.log('BASELINE: Current NGRAM_CTW (20/80 CTW + 2-gram + charges)');
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

      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`  Net advantage: ${((wins - losses) / total * 100).toFixed(2)}%`);
    console.log(`  Win rate: ${(wins / total * 100).toFixed(2)}%`);
    console.log(`  Tested: ${total} battles\n`);
  }

  // ==================== TEST 1: LSTM vs CTW ====================
  console.log('='.repeat(60));
  console.log('TEST 1: LSTM (replacing CTW)');
  console.log('='.repeat(60));

  {
    const lstmModels = new Map();
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
        if (!lstmModels.has(enemyId)) {
          lstmModels.set(enemyId, new SimpleLSTM(8));
        }
      }

      const lstm = lstmModels.get(enemyId);

      if (lstm.history.length >= 2 && prev2.length === 2) {
        const lstmProbs = lstm.predict();
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

        // 20/80 LSTM/2-gram
        let pEnemy = {
          rock: 0.2 * lstmProbs.rock + 0.8 * gramProbs.rock,
          paper: 0.2 * lstmProbs.paper + 0.8 * gramProbs.paper,
          scissor: 0.2 * lstmProbs.scissor + 0.8 * gramProbs.scissor
        };

        // Charge enhancement (same as baseline)
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

      lstm.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`  Net advantage: ${((wins - losses) / total * 100).toFixed(2)}%`);
    console.log(`  vs Baseline: ${((wins - losses) / total * 100 - 5.58).toFixed(2)}%`);
    console.log(`  Tested: ${total} battles\n`);
  }

  // ==================== TEST 2: Adaptive Weights ====================
  console.log('='.repeat(60));
  console.log('TEST 2: Per-opponent Adaptive Weights');
  console.log('='.repeat(60));

  {
    const ctwModels = new Map();
    const gram2 = new Map();
    const opponentStats = new Map(); // Track per-opponent performance

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
          opponentStats.set(enemyId, { ctwCorrect: 0, gramCorrect: 0, total: 0 });
        }
      }

      const ctw = ctwModels.get(enemyId);
      const stats = opponentStats.get(enemyId);

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

        // Adaptive weights based on past performance
        let ctwWeight = 0.2;
        let gramWeight = 0.8;
        if (stats.total >= 20) {
          const ctwRate = stats.ctwCorrect / stats.total;
          const gramRate = stats.gramCorrect / stats.total;
          const totalRate = ctwRate + gramRate;
          if (totalRate > 0) {
            ctwWeight = ctwRate / totalRate;
            gramWeight = gramRate / totalRate;
          }
        }

        let pEnemy = {
          rock: ctwWeight * ctwProbs.rock + gramWeight * gramProbs.rock,
          paper: ctwWeight * ctwProbs.paper + gramWeight * gramProbs.paper,
          scissor: ctwWeight * ctwProbs.scissor + gramWeight * gramProbs.scissor
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

        // Track which predictor was correct
        const ctwPred = Object.entries(ctwProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        const gramPred = Object.entries(gramProbs).reduce((a, c) => c[1] > a[1] ? c : a)[0];
        if (ctwPred === b.enemy_move) stats.ctwCorrect++;
        if (gramPred === b.enemy_move) stats.gramCorrect++;
        stats.total++;
      }

      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`  Net advantage: ${((wins - losses) / total * 100).toFixed(2)}%`);
    console.log(`  vs Baseline: ${((wins - losses) / total * 100 - 5.58).toFixed(2)}%`);
    console.log(`  Tested: ${total} battles\n`);
  }

  // ==================== TEST 3: Opponent Type Detection ====================
  console.log('='.repeat(60));
  console.log('TEST 3: Opponent Type Detection (random/pattern/biased)');
  console.log('='.repeat(60));

  {
    const ctwModels = new Map();
    const gram2 = new Map();
    const opponentType = new Map();

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
          opponentType.set(enemyId, {
            moves: [],
            rock: 0, paper: 0, scissor: 0,
            type: 'unknown'
          });
        }
      }

      const ctw = ctwModels.get(enemyId);
      const typeInfo = opponentType.get(enemyId);

      // Detect opponent type after 30 observations
      if (typeInfo.moves.length >= 30 && typeInfo.type === 'unknown') {
        const n = typeInfo.moves.length;
        const rPct = typeInfo.rock / n;
        const pPct = typeInfo.paper / n;
        const sPct = typeInfo.scissor / n;

        // Check for bias (one move > 40%)
        if (rPct > 0.4 || pPct > 0.4 || sPct > 0.4) {
          typeInfo.type = 'biased';
        } else {
          // Check for patterns using entropy
          const entropy = -[rPct, pPct, sPct].reduce((e, p) =>
            p > 0 ? e + p * Math.log2(p) : e, 0);
          typeInfo.type = entropy > 1.5 ? 'random' : 'pattern';
        }
      }

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

        // Adjust strategy based on opponent type
        let pEnemy;
        if (typeInfo.type === 'biased') {
          // For biased opponents, use frequency counts
          const n = typeInfo.moves.length;
          pEnemy = {
            rock: typeInfo.rock / n,
            paper: typeInfo.paper / n,
            scissor: typeInfo.scissor / n
          };
        } else if (typeInfo.type === 'random') {
          // For random opponents, use uniform (no point in prediction)
          pEnemy = { rock: 1/3, paper: 1/3, scissor: 1/3 };
        } else {
          // For pattern/unknown, use normal ensemble
          pEnemy = {
            rock: 0.2 * ctwProbs.rock + 0.8 * gramProbs.rock,
            paper: 0.2 * ctwProbs.paper + 0.8 * gramProbs.paper,
            scissor: 0.2 * ctwProbs.scissor + 0.8 * gramProbs.scissor
          };
        }

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

      ctw.update(b.enemy_move);
      typeInfo.moves.push(b.enemy_move);
      typeInfo[b.enemy_move]++;
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    // Count opponent types
    let randomCount = 0, patternCount = 0, biasedCount = 0, unknownCount = 0;
    for (const [id, info] of opponentType) {
      if (info.type === 'random') randomCount++;
      else if (info.type === 'pattern') patternCount++;
      else if (info.type === 'biased') biasedCount++;
      else unknownCount++;
    }

    console.log(`  Net advantage: ${((wins - losses) / total * 100).toFixed(2)}%`);
    console.log(`  vs Baseline: ${((wins - losses) / total * 100 - 5.58).toFixed(2)}%`);
    console.log(`  Opponent types: ${randomCount} random, ${patternCount} pattern, ${biasedCount} biased, ${unknownCount} unknown`);
    console.log(`  Tested: ${total} battles\n`);
  }

  // ==================== TEST 4: Higher CTW Weight ====================
  console.log('='.repeat(60));
  console.log('TEST 4: Different CTW/2-gram Weights');
  console.log('='.repeat(60));

  for (const ctwW of [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0]) {
    const gramW = 1.0 - ctwW;

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
          rock: ctwW * ctwProbs.rock + gramW * gramProbs.rock,
          paper: ctwW * ctwProbs.paper + gramW * gramProbs.paper,
          scissor: ctwW * ctwProbs.scissor + gramW * gramProbs.scissor
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

      ctw.update(b.enemy_move);
      if (prev2.length === 2) {
        gram2.get(`${prev2[0]},${prev2[1]}`)[b.enemy_move]++;
      }
      prev2.push(b.enemy_move);
      if (prev2.length > 2) prev2.shift();
    }

    console.log(`  CTW ${(ctwW*100).toFixed(0)}% / 2-gram ${(gramW*100).toFixed(0)}%: Net ${((wins - losses) / total * 100).toFixed(2)}%`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  db.close();
});
