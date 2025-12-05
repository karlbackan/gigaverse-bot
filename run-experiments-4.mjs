/**
 * Round 4 Experiments - N-gram combinations and confidence-based strategies
 */

import sqlite3 from 'sqlite3';
import { ContextTreeWeighting } from './src/context-tree-weighting.mjs';
import fs from 'fs';

const DB_PATH = './data/battle-statistics.db';
const MOVES = ['rock', 'paper', 'scissor'];

class ExperimentRunner4 {
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

  // ==================== EXPERIMENT 20: Confidence-Based Fallback ====================
  async experimentConfidenceFallback() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 20: Confidence-Based Fallback');
    console.log('=' .repeat(60));

    // When CTW confidence low, fall back to frequency
    const thresholds = [0.35, 0.38, 0.40, 0.42, 0.45];
    const results = [];

    for (const threshold of thresholds) {
      const stats = { predictions: 0, correct: 0, fallbacks: 0 };
      const models = new Map();
      const freqs = new Map();

      let lastEnemyId = null;
      for (const battle of this.battles) {
        const enemyId = String(battle.enemy_id);
        const { enemy_move } = battle;

        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          models.set(enemyId, new ContextTreeWeighting(3));
          freqs.set(enemyId, { rock: 1, paper: 1, scissor: 1 });
        }

        const ctw = models.get(enemyId);
        const freq = freqs.get(enemyId);

        if (ctw.history.length >= 1) {
          const probs = ctw.predict();
          if (probs) {
            const maxProb = Math.max(probs.rock, probs.paper, probs.scissor);

            let predicted;
            if (maxProb >= threshold) {
              // High confidence - trust CTW
              predicted = this.argmax(probs);
            } else {
              // Low confidence - use frequency
              predicted = this.argmax(freq);
              stats.fallbacks++;
            }

            stats.predictions++;
            if (predicted === enemy_move) stats.correct++;
          }
        }

        ctw.update(enemy_move);
        freq[enemy_move]++;
      }

      const accuracy = stats.correct / stats.predictions * 100;
      const fallbackRate = stats.fallbacks / stats.predictions * 100;
      results.push({ threshold, accuracy, fallbackRate });
      console.log(`  Threshold ${threshold.toFixed(2)}: ${accuracy.toFixed(2)}% (${fallbackRate.toFixed(1)}% fallbacks)`);
    }

    const best = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`\n  Best: Threshold ${best.threshold} at ${best.accuracy.toFixed(2)}%`);
    console.log(`  vs Pure CTW-3: ~34.90%\n`);

    this.results.confidenceFallback = results;
    return results;
  }

  // ==================== EXPERIMENT 21: N-gram Ensemble ====================
  async experimentNgramEnsemble() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 21: N-gram Ensemble (1+2+3-gram)');
    console.log('=' .repeat(60));

    // Combine predictions from different n-gram models
    const stats = { predictions: 0, correct: 0 };

    // Global n-gram counts
    const ngrams = {
      unigram: { rock: 0, paper: 0, scissor: 0 },
      bigram: {},   // "rock,paper" -> {rock: x, paper: y, scissor: z}
      trigram: {}   // "rock,paper,scissor" -> {...}
    };

    const opponentHistory = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        opponentHistory.set(enemyId, []);
      }

      const history = opponentHistory.get(enemyId);

      // Make predictions when we have enough history
      if (history.length >= 2) {
        const ensemble = { rock: 0, paper: 0, scissor: 0 };
        let totalWeight = 0;

        // Unigram (frequency)
        const uniTotal = ngrams.unigram.rock + ngrams.unigram.paper + ngrams.unigram.scissor;
        if (uniTotal > 100) {
          for (const m of MOVES) {
            ensemble[m] += (ngrams.unigram[m] + 1) / (uniTotal + 3);
          }
          totalWeight += 1;
        }

        // Bigram
        const bi = history.slice(-1)[0];
        if (ngrams.bigram[bi]) {
          const counts = ngrams.bigram[bi];
          const total = counts.rock + counts.paper + counts.scissor;
          if (total > 30) {
            for (const m of MOVES) {
              ensemble[m] += 2 * (counts[m] + 1) / (total + 3);  // weight 2
            }
            totalWeight += 2;
          }
        }

        // Trigram
        if (history.length >= 2) {
          const tri = history.slice(-2).join(',');
          if (ngrams.trigram[tri]) {
            const counts = ngrams.trigram[tri];
            const total = counts.rock + counts.paper + counts.scissor;
            if (total > 20) {
              for (const m of MOVES) {
                ensemble[m] += 3 * (counts[m] + 1) / (total + 3);  // weight 3
              }
              totalWeight += 3;
            }
          }
        }

        if (totalWeight > 0) {
          for (const m of MOVES) ensemble[m] /= totalWeight;
          const predicted = this.argmax(ensemble);
          stats.predictions++;
          if (predicted === enemy_move) stats.correct++;
        }
      }

      // Update n-grams
      ngrams.unigram[enemy_move]++;

      if (history.length >= 1) {
        const bi = history.slice(-1)[0];
        if (!ngrams.bigram[bi]) ngrams.bigram[bi] = { rock: 0, paper: 0, scissor: 0 };
        ngrams.bigram[bi][enemy_move]++;
      }

      if (history.length >= 2) {
        const tri = history.slice(-2).join(',');
        if (!ngrams.trigram[tri]) ngrams.trigram[tri] = { rock: 0, paper: 0, scissor: 0 };
        ngrams.trigram[tri][enemy_move]++;
      }

      history.push(enemy_move);
    }

    const accuracy = stats.correct / stats.predictions * 100;
    console.log(`\n  N-gram ensemble accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`  vs Random: ${(accuracy - 33.3).toFixed(2)}%`);
    console.log(`  vs CTW-3: ${(accuracy - 34.90).toFixed(2)}%\n`);

    this.results.ngramEnsemble = { accuracy };
    return { accuracy };
  }

  // ==================== EXPERIMENT 22: CTW + N-gram Hybrid ====================
  async experimentCTWNgramHybrid() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 22: CTW + N-gram Hybrid');
    console.log('=' .repeat(60));

    // Blend CTW with trigram when available
    const blendRatios = [
      { ctw: 1.0, ngram: 0.0 },
      { ctw: 0.8, ngram: 0.2 },
      { ctw: 0.6, ngram: 0.4 },
      { ctw: 0.5, ngram: 0.5 },
    ];

    const results = [];

    for (const ratio of blendRatios) {
      const stats = { predictions: 0, correct: 0 };
      const models = new Map();
      const trigrams = new Map();
      const histories = new Map();

      let lastEnemyId = null;
      for (const battle of this.battles) {
        const enemyId = String(battle.enemy_id);
        const { enemy_move } = battle;

        if (lastEnemyId !== enemyId) {
          lastEnemyId = enemyId;
          models.set(enemyId, new ContextTreeWeighting(3));
          trigrams.set(enemyId, {});
          histories.set(enemyId, []);
        }

        const ctw = models.get(enemyId);
        const tri = trigrams.get(enemyId);
        const history = histories.get(enemyId);

        if (ctw.history.length >= 1) {
          const ctwProbs = ctw.predict();
          if (ctwProbs) {
            // Get trigram prediction if available
            let triProbs = null;
            if (history.length >= 2) {
              const key = history.slice(-2).join(',');
              if (tri[key]) {
                const counts = tri[key];
                const total = counts.rock + counts.paper + counts.scissor;
                if (total > 5) {
                  triProbs = {
                    rock: (counts.rock + 1) / (total + 3),
                    paper: (counts.paper + 1) / (total + 3),
                    scissor: (counts.scissor + 1) / (total + 3)
                  };
                }
              }
            }

            // Blend predictions
            let finalProbs;
            if (triProbs) {
              finalProbs = {
                rock: ratio.ctw * ctwProbs.rock + ratio.ngram * triProbs.rock,
                paper: ratio.ctw * ctwProbs.paper + ratio.ngram * triProbs.paper,
                scissor: ratio.ctw * ctwProbs.scissor + ratio.ngram * triProbs.scissor
              };
            } else {
              finalProbs = ctwProbs;
            }

            const predicted = this.argmax(finalProbs);
            stats.predictions++;
            if (predicted === enemy_move) stats.correct++;
          }
        }

        // Update models
        ctw.update(enemy_move);
        if (history.length >= 2) {
          const key = history.slice(-2).join(',');
          if (!tri[key]) tri[key] = { rock: 0, paper: 0, scissor: 0 };
          tri[key][enemy_move]++;
        }
        history.push(enemy_move);
      }

      const accuracy = stats.correct / stats.predictions * 100;
      results.push({ ...ratio, accuracy });
      console.log(`  CTW ${ratio.ctw} + Ngram ${ratio.ngram}: ${accuracy.toFixed(2)}%`);
    }

    const best = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    console.log(`\n  Best: CTW ${best.ctw} + Ngram ${best.ngram} at ${best.accuracy.toFixed(2)}%\n`);

    this.results.ctwNgramHybrid = results;
    return results;
  }

  // ==================== EXPERIMENT 23: Per-Opponent Optimal Strategy ====================
  async experimentPerOpponentOptimal() {
    console.log('=' .repeat(60));
    console.log('EXPERIMENT 23: Per-Opponent Optimal Strategy');
    console.log('=' .repeat(60));

    // First pass: learn optimal strategy per opponent
    const opponentData = new Map();
    const models = new Map();

    let lastEnemyId = null;
    for (const battle of this.battles) {
      const enemyId = String(battle.enemy_id);
      const { enemy_move } = battle;

      if (lastEnemyId !== enemyId) {
        lastEnemyId = enemyId;
        models.set(enemyId, new ContextTreeWeighting(3));
        opponentData.set(enemyId, {
          ctwCorrect: 0,
          freqCorrect: 0,
          total: 0,
          freq: { rock: 0, paper: 0, scissor: 0 }
        });
      }

      const ctw = models.get(enemyId);
      const data = opponentData.get(enemyId);

      if (ctw.history.length >= 1) {
        const ctwProbs = ctw.predict();
        if (ctwProbs) {
          // Check CTW accuracy
          const ctwPred = this.argmax(ctwProbs);
          if (ctwPred === enemy_move) data.ctwCorrect++;

          // Check frequency accuracy
          const freqTotal = data.freq.rock + data.freq.paper + data.freq.scissor;
          if (freqTotal > 5) {
            const freqPred = this.argmax(data.freq);
            if (freqPred === enemy_move) data.freqCorrect++;
          }

          data.total++;
        }
      }

      ctw.update(enemy_move);
      data.freq[enemy_move]++;
    }

    // Analyze per-opponent performance
    const analysis = [];
    for (const [enemyId, data] of opponentData) {
      if (data.total > 30) {
        const ctwAcc = data.ctwCorrect / data.total * 100;
        const freqAcc = data.freqCorrect / data.total * 100;
        const bestStrategy = ctwAcc > freqAcc ? 'CTW' : 'FREQ';
        analysis.push({ enemyId, ctwAcc, freqAcc, bestStrategy, battles: data.total });
      }
    }

    analysis.sort((a, b) => b.ctwAcc - a.ctwAcc);

    console.log('\n  Per-Opponent Strategy Comparison:');
    console.log('  ' + '-'.repeat(60));
    console.log('  Enemy'.padEnd(15) + 'CTW Acc'.padEnd(12) + 'Freq Acc'.padEnd(12) + 'Best'.padEnd(8) + 'Battles');
    for (const a of analysis.slice(0, 15)) {
      console.log(`  ${a.enemyId.toString().padEnd(15)}${a.ctwAcc.toFixed(1).padStart(6)}%${a.freqAcc.toFixed(1).padStart(10)}%${a.bestStrategy.padStart(8)}${a.battles.toString().padStart(8)}`);
    }

    const ctwWins = analysis.filter(a => a.bestStrategy === 'CTW').length;
    const freqWins = analysis.filter(a => a.bestStrategy === 'FREQ').length;
    console.log(`\n  CTW wins for ${ctwWins}/${analysis.length} opponents`);
    console.log(`  FREQ wins for ${freqWins}/${analysis.length} opponents\n`);

    this.results.perOpponentOptimal = analysis;
    return analysis;
  }

  // ==================== Run All ====================
  async runAll() {
    console.log('\n🧪 ROUND 4 EXPERIMENTS');
    console.log('=' .repeat(60));

    await this.connect();
    await this.loadBattles();

    await this.experimentConfidenceFallback();
    await this.experimentNgramEnsemble();
    await this.experimentCTWNgramHybrid();
    await this.experimentPerOpponentOptimal();

    // Summary
    console.log('=' .repeat(60));
    console.log('ROUND 4 SUMMARY');
    console.log('=' .repeat(60));

    const confBest = this.results.confidenceFallback?.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    const hybridBest = this.results.ctwNgramHybrid?.reduce((a, b) => a.accuracy > b.accuracy ? a : b);

    console.log(`  Confidence Fallback:  ${confBest?.accuracy?.toFixed(2)}% (threshold ${confBest?.threshold})`);
    console.log(`  N-gram Ensemble:      ${this.results.ngramEnsemble?.accuracy?.toFixed(2)}%`);
    console.log(`  CTW+Ngram Hybrid:     ${hybridBest?.accuracy?.toFixed(2)}% (${hybridBest?.ctw}/${hybridBest?.ngram})`);
    console.log('\n  Baseline CTW-3: 34.90%\n');

    // Append to results
    const existing = JSON.parse(fs.readFileSync('./data/experiment-results.json', 'utf8'));
    const combined = { ...existing, ...this.results };
    fs.writeFileSync('./data/experiment-results.json', JSON.stringify(combined, null, 2));
    console.log('Results appended to data/experiment-results.json\n');

    this.db.close();
    return this.results;
  }
}

const runner = new ExperimentRunner4();
runner.runAll().catch(console.error);
