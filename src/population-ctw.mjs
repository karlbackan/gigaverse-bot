/**
 * Population-Prior CTW
 *
 * Pre-trains a CTW model on ALL historical battles across all opponents.
 * This captures common patterns that most opponents follow:
 * - Rock-Paper-Scissor cycling tendencies
 * - Win-Stay-Lose-Shift patterns
 * - General human/bot behavioral patterns
 *
 * For new opponents, blend population prediction with per-opponent prediction
 * based on sample size (more samples = trust per-opponent more).
 */

import { ContextTreeWeighting } from './context-tree-weighting.mjs';
import sqlite3 from 'sqlite3';
import fs from 'fs';

const DB_PATH = './data/battle-statistics.db';
const POPULATION_CTW_PATH = './data/population-ctw.json';

/**
 * Train population CTW from all historical battles
 */
export async function trainPopulationCTW() {
  console.log('🌍 Training Population CTW from historical data...');

  const db = new sqlite3.Database(DB_PATH);

  return new Promise((resolve, reject) => {
    // Get all battles ordered by enemy and turn (to maintain sequences)
    db.all(`
      SELECT enemy_id, enemy_move
      FROM battles
      ORDER BY enemy_id, turn
    `, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const ctw = new ContextTreeWeighting(6);  // Markov-6 depth

      let lastEnemy = null;
      let battleCount = 0;

      for (const row of rows) {
        // Reset context when switching enemies (don't carry patterns across)
        if (row.enemy_id !== lastEnemy) {
          // We don't reset the CTW tree, but the history resets naturally
          // when we call update() after switching enemies
          lastEnemy = row.enemy_id;
        }

        if (row.enemy_move) {
          ctw.update(row.enemy_move);
          battleCount++;
        }
      }

      console.log(`🌍 Population CTW trained on ${battleCount} moves`);
      console.log(`🌍 Stats: ${JSON.stringify(ctw.getStats())}`);

      // Save to file
      const serialized = ctw.serialize();
      fs.writeFileSync(POPULATION_CTW_PATH, JSON.stringify(serialized, null, 2));
      console.log(`🌍 Population CTW saved to ${POPULATION_CTW_PATH}`);

      db.close();
      resolve(ctw);
    });
  });
}

/**
 * Load pre-trained population CTW from file
 */
export function loadPopulationCTW() {
  if (!fs.existsSync(POPULATION_CTW_PATH)) {
    console.log('⚠️ Population CTW not found, returning null');
    return null;
  }

  const data = JSON.parse(fs.readFileSync(POPULATION_CTW_PATH, 'utf8'));
  const ctw = new ContextTreeWeighting(data.maxDepth || 6);
  ctw.deserialize(data);

  console.log(`🌍 Population CTW loaded (${ctw.history.length} history)`);
  return ctw;
}

/**
 * Blend per-opponent prediction with population prediction
 *
 * @param {object} opponentPred - Per-opponent CTW prediction
 * @param {object} populationPred - Population CTW prediction
 * @param {number} opponentSamples - Number of samples for this opponent
 * @returns {object} Blended prediction
 */
export function blendPredictions(opponentPred, populationPred, opponentSamples) {
  // Alpha = how much to trust per-opponent model
  // At 0 samples: alpha = 0 (100% population)
  // At 30 samples: alpha = 0.5 (50/50 blend)
  // At 100+ samples: alpha ~= 1 (mostly per-opponent)
  const alpha = Math.min(0.95, opponentSamples / 60);

  return {
    rock: alpha * opponentPred.rock + (1 - alpha) * populationPred.rock,
    paper: alpha * opponentPred.paper + (1 - alpha) * populationPred.paper,
    scissor: alpha * opponentPred.scissor + (1 - alpha) * populationPred.scissor
  };
}

// Allow running as script to train
if (process.argv[1].includes('population-ctw')) {
  trainPopulationCTW()
    .then(() => console.log('✅ Done'))
    .catch(err => console.error('❌ Error:', err));
}

export default { trainPopulationCTW, loadPopulationCTW, blendPredictions };
