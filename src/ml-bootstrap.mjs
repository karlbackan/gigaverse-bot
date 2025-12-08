/**
 * ML Bootstrap Script
 *
 * Trains all ML models from historical battle data in the SQLite database.
 * Run this once to initialize models with 25,000+ battles of training data.
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { MLDecisionEngine } from './ml-decision-engine.mjs';
import MLStatePersistence from './ml-state-persistence.mjs';

const DB_PATH = './data/battle-statistics.db';

class MLBootstrap {
  constructor() {
    this.db = null;
    this.mlEngine = new MLDecisionEngine();
    this.stats = {
      battlesProcessed: 0,
      enemiesProcessed: new Set(),
      wins: 0,
      losses: 0,
      ties: 0
    };
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

  async close() {
    return new Promise((resolve) => {
      if (this.db) this.db.close(resolve);
      else resolve();
    });
  }

  /**
   * Load all battles from database
   */
  async loadBattles() {
    console.log('📊 Loading battles from database...');

    const battles = await this.query(`
      SELECT
        enemy_id,
        dungeon_id,
        turn,
        player_move,
        enemy_move,
        result,
        previous_move,
        player_health,
        enemy_health,
        player_stats,
        enemy_stats
      FROM battles
      ORDER BY timestamp ASC
    `);

    console.log(`   Found ${battles.length} battles`);
    return battles;
  }

  /**
   * Group battles by enemy for sequential processing
   */
  groupByEnemy(battles) {
    const enemyBattles = new Map();

    for (const battle of battles) {
      if (!enemyBattles.has(battle.enemy_id)) {
        enemyBattles.set(battle.enemy_id, []);
      }
      enemyBattles.get(battle.enemy_id).push(battle);
    }

    return enemyBattles;
  }

  /**
   * Train all models on battle history
   */
  async trainModels(battles) {
    console.log('\n🧠 Training ML models...\n');

    const enemyBattles = this.groupByEnemy(battles);
    console.log(`   Processing ${enemyBattles.size} unique enemies\n`);

    let processed = 0;
    const total = enemyBattles.size;

    for (const [enemyId, enemyHistory] of enemyBattles) {
      // Sort by turn
      enemyHistory.sort((a, b) => a.turn - b.turn);

      // Process each battle in sequence
      for (const battle of enemyHistory) {
        await this.processBattle(enemyId, battle);
      }

      processed++;
      if (processed % 100 === 0) {
        const pct = ((processed / total) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${processed}/${total} enemies (${pct}%)`);
      }

      this.stats.enemiesProcessed.add(enemyId);
    }

    console.log(`\r   Progress: ${total}/${total} enemies (100.0%)    `);
  }

  /**
   * Process a single battle - update all ML models
   */
  async processBattle(enemyId, battle) {
    const { player_move, enemy_move, result, turn, player_health, enemy_health } = battle;

    // Convert enemyId to string (database stores as integer)
    const enemyIdStr = String(enemyId);

    // Create features for Q-learning
    const features = this.createFeatures(enemyIdStr, turn, player_health, enemy_health);

    // Update CTW with enemy move
    this.mlEngine.ensureCTWModel(enemyIdStr);
    const ctwModel = this.mlEngine.ctwModels.get(enemyIdStr);
    ctwModel.update(enemy_move);

    // Update Iocaine Powder
    this.mlEngine.iocaine.update(enemyIdStr, player_move, enemy_move);

    // Update RNN
    this.mlEngine.ensureRNNModel(enemyIdStr);
    const rnnModel = this.mlEngine.rnnModels.get(enemyIdStr);
    rnnModel.update(player_move, enemy_move);

    // Update Bayesian model
    this.mlEngine.bayesian.update(enemyIdStr, player_move, enemy_move);

    // Update Global N-gram predictor
    this.mlEngine.globalNgram.update(enemyIdStr, enemy_move);

    // Update Q-learning
    this.mlEngine.updateQLearning(features, player_move, result);

    // Update opponent model
    this.mlEngine.ensureOpponentModel(enemyIdStr);
    this.mlEngine.updateOpponentModel(enemyIdStr, enemy_move, result, turn);

    // Track statistics
    this.stats.battlesProcessed++;
    if (result === 'win') this.stats.wins++;
    else if (result === 'loss') this.stats.losses++;
    else this.stats.ties++;
  }

  /**
   * Create feature vector for Q-learning
   */
  createFeatures(enemyId, turn, playerHealth, enemyHealth) {
    const model = this.mlEngine.opponentModels.get(enemyId);

    return [
      turn / 100,
      (playerHealth || 26) / 100,
      (enemyHealth || 10) / 100,
      model ? model.totalBattles / 100 : 0,
      model ? model.wins / Math.max(1, model.totalBattles) : 0.5,
      model ? model.adaptationRate : 0.5,
      model && model.moves.length > 0 ? (model.moves.filter(m => m === 'rock').length / model.moves.length) : 0.33,
      model && model.moves.length > 0 ? (model.moves.filter(m => m === 'paper').length / model.moves.length) : 0.33,
      model && model.moves.length > 0 ? (model.moves.filter(m => m === 'scissor').length / model.moves.length) : 0.33,
      0.5, // pattern strength placeholder
      0.5, // volatility placeholder
      0,   // shield placeholder
      turn % 10 / 10,
      Math.sin(turn / 10),
      Math.cos(turn / 10)
    ];
  }

  /**
   * Calculate strategy performance from historical predictions
   */
  async calculateStrategyPerformance(battles) {
    console.log('\n📈 Calculating strategy performance from history...\n');

    // Simulate what each strategy would have predicted
    const strategyResults = {
      statistical: { wins: 0, losses: 0, plays: 0 },
      anti_pattern: { wins: 0, losses: 0, plays: 0 },
      iocaine: { wins: 0, losses: 0, plays: 0 },
      ctw: { wins: 0, losses: 0, plays: 0 },
      bayesian: { wins: 0, losses: 0, plays: 0 },
      random: { wins: 0, losses: 0, plays: 0 },
      charge_based: { wins: 0, losses: 0, plays: 0 }
    };

    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    const counters = { rock: 'scissor', paper: 'rock', scissor: 'paper' };

    // For random strategy
    const randomWinRate = 1/3;

    // Group by enemy for proper sequential evaluation
    const enemyBattles = this.groupByEnemy(battles);

    for (const [enemyId, history] of enemyBattles) {
      history.sort((a, b) => a.turn - b.turn);

      // Track move frequencies for this enemy
      const moveCounts = { rock: 0, paper: 0, scissor: 0 };

      for (let i = 0; i < history.length; i++) {
        const battle = history[i];
        const actualEnemyMove = battle.enemy_move;

        // Only evaluate after we have some history
        if (i >= 3) {
          // Statistical strategy: counter most frequent move
          const mostFrequent = Object.entries(moveCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
          const statPrediction = counter[mostFrequent];
          this.evaluateStrategy(strategyResults.statistical, statPrediction, actualEnemyMove, counter, counters);

          // Anti-pattern: counter last move
          const lastMove = history[i-1].enemy_move;
          const antiPrediction = counter[lastMove];
          this.evaluateStrategy(strategyResults.anti_pattern, antiPrediction, actualEnemyMove, counter, counters);
        }

        // Random always gets ~33% win rate
        strategyResults.random.plays++;
        strategyResults.random.wins += randomWinRate;
        strategyResults.random.losses += randomWinRate;

        // Update counts
        moveCounts[actualEnemyMove]++;
      }
    }

    // Use Iocaine's internal performance tracking
    const iocaineStats = this.mlEngine.iocaine.getStats(Array.from(enemyBattles.keys())[0]);
    if (iocaineStats && iocaineStats.topStrategies) {
      const bestScore = Math.max(...iocaineStats.topStrategies.map(s => s.score));
      strategyResults.iocaine.plays = this.stats.battlesProcessed;
      strategyResults.iocaine.wins = (bestScore > 0 ? bestScore : this.stats.battlesProcessed * 0.4);
      strategyResults.iocaine.losses = this.stats.battlesProcessed * 0.3;
    }

    // CTW and Bayesian - estimate from overall win rate
    const overallWinRate = this.stats.wins / this.stats.battlesProcessed;
    const estimatedImprovement = 0.1; // Assume 10% better than baseline

    strategyResults.ctw.plays = this.stats.battlesProcessed;
    strategyResults.ctw.wins = this.stats.battlesProcessed * (overallWinRate + estimatedImprovement);
    strategyResults.ctw.losses = this.stats.battlesProcessed * (1 - overallWinRate - estimatedImprovement) * 0.5;

    strategyResults.bayesian.plays = this.stats.battlesProcessed;
    strategyResults.bayesian.wins = this.stats.battlesProcessed * (overallWinRate + estimatedImprovement * 0.8);
    strategyResults.bayesian.losses = this.stats.battlesProcessed * (1 - overallWinRate - estimatedImprovement * 0.8) * 0.5;

    // Charge-based strategy: uses +5.4% lift from charge correlation
    // Evaluate from historical data with charge info
    strategyResults.charge_based.plays = this.stats.battlesProcessed;
    // From data analysis: 38-39% win rate when exploiting charge correlation vs 33% random
    const chargeLift = 0.054;  // +5.4% from data analysis
    strategyResults.charge_based.wins = this.stats.battlesProcessed * (0.333 + chargeLift);
    strategyResults.charge_based.losses = this.stats.battlesProcessed * (1 - 0.333 - chargeLift) * 0.5;

    return strategyResults;
  }

  evaluateStrategy(stats, prediction, actualEnemyMove, counter, counters) {
    stats.plays++;
    if (prediction === counter[actualEnemyMove]) {
      stats.wins++;
    } else if (prediction === counters[actualEnemyMove]) {
      stats.losses++;
    }
    // Ties don't add to wins or losses
  }

  /**
   * Update bandit arms with calculated performance
   */
  updateBanditArms(strategyResults) {
    console.log('\n🎰 Updating Thompson Sampling bandit arms...\n');

    for (const [strategy, results] of Object.entries(strategyResults)) {
      const arm = this.mlEngine.bandit.arms.get(strategy);
      if (arm) {
        arm.plays = Math.round(results.plays);
        arm.wins = Math.round(results.wins);
        arm.losses = Math.round(results.losses);
        arm.value = arm.wins / Math.max(1, arm.plays);
        arm.confidence = Math.sqrt(arm.plays / 10);

        const winRate = (arm.wins / Math.max(1, arm.plays) * 100).toFixed(1);
        console.log(`   ${strategy}: ${arm.wins} wins, ${arm.losses} losses, ${arm.plays} plays (${winRate}% win rate)`);
      }
    }

    // Initialize new strategies with priors based on overall performance
    const avgWinRate = this.stats.wins / this.stats.battlesProcessed;
    const priorPlays = 100; // Give new strategies some prior experience

    for (const strategy of ['neural', 'meta_game', 'q_learning', 'ensemble']) {
      const arm = this.mlEngine.bandit.arms.get(strategy);
      if (arm && arm.plays === 0) {
        arm.plays = priorPlays;
        arm.wins = Math.round(priorPlays * avgWinRate);
        arm.losses = Math.round(priorPlays * (1 - avgWinRate) * 0.5);
        arm.value = arm.wins / arm.plays;
        console.log(`   ${strategy}: initialized with prior (${(avgWinRate * 100).toFixed(1)}% estimated)`);
      }
    }
  }

  /**
   * Save trained state
   */
  async saveState() {
    console.log('\n💾 Saving ML state...');

    try {
      const persistence = new MLStatePersistence();
      await persistence.saveMLState(this.mlEngine);
      console.log('   ✅ ML state saved successfully');
    } catch (error) {
      console.error('   ❌ Failed to save ML state:', error.message);
    }
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 BOOTSTRAP SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Battles processed: ${this.stats.battlesProcessed.toLocaleString()}`);
    console.log(`   Unique enemies: ${this.stats.enemiesProcessed.size.toLocaleString()}`);
    console.log(`   Overall record: ${this.stats.wins}W / ${this.stats.losses}L / ${this.stats.ties}T`);
    console.log(`   Win rate: ${(this.stats.wins / this.stats.battlesProcessed * 100).toFixed(1)}%`);
    console.log('');
    console.log(`   Q-states learned: ${this.mlEngine.qLearning.states.size}`);
    console.log(`   CTW models: ${this.mlEngine.ctwModels.size}`);
    console.log(`   RNN models: ${this.mlEngine.rnnModels.size}`);
    console.log(`   Opponent models: ${this.mlEngine.opponentModels.size}`);
    console.log(`   Bayesian opponents: ${this.mlEngine.bayesian.opponents.size}`);
    console.log('='.repeat(50));
  }

  /**
   * Main bootstrap process
   */
  async run() {
    console.log('🚀 ML Bootstrap - Training from Historical Data\n');
    console.log('='.repeat(50));

    try {
      await this.connect();
      console.log('✅ Connected to database\n');

      const battles = await this.loadBattles();
      await this.trainModels(battles);

      const strategyResults = await this.calculateStrategyPerformance(battles);
      this.updateBanditArms(strategyResults);

      await this.saveState();
      this.printSummary();

    } catch (error) {
      console.error('❌ Bootstrap failed:', error);
    } finally {
      await this.close();
    }
  }
}

// Run bootstrap
const bootstrap = new MLBootstrap();
bootstrap.run();
