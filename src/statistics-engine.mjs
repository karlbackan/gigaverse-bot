import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StatisticsEngine {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'battle-statistics.json');
    // Track move sequences by dungeon type and enemy
    this.moveSequences = {
      1: new Map(), // Dungetron 5000
      3: new Map()  // Underhaul
    };
    this.sessionData = {
      startTime: Date.now(),
      battles: [],
      enemies: new Map()
    };
    this.currentDungeonType = 1; // Default to Dungetron 5000
    this.lastPrediction = null; // Track last prediction for validation
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
        
        // Initialize enemy stats for each dungeon type
        this.enemyStats = {
          1: new Map(), // Dungetron 5000
          3: new Map()  // Underhaul
        };
        
        // Handle new structure (by dungeon type)
        if (data.dungeonStats) {
          for (const [dungeonType, enemyData] of Object.entries(data.dungeonStats)) {
            const dtype = parseInt(dungeonType);
            if (this.enemyStats[dtype]) {
              this.enemyStats[dtype] = new Map(enemyData);
              
              // Ensure all enemies have required fields (for backward compatibility)
              for (const [enemyId, enemy] of this.enemyStats[dtype].entries()) {
                if (!enemy.recentBattles) {
                  enemy.recentBattles = [];
                }
                if (!enemy.chargePatterns) {
                  enemy.chargePatterns = {};
                }
                // Initialize new tracking fields for backwards compatibility
                if (enemy.wins === undefined) enemy.wins = 0;
                if (enemy.losses === undefined) enemy.losses = 0;
                if (enemy.ties === undefined) enemy.ties = 0;
                if (enemy.winRate === undefined) enemy.winRate = 0;
                if (!enemy.predictionHistory) enemy.predictionHistory = [];
                if (enemy.predictionAccuracy === undefined) enemy.predictionAccuracy = 0;
                if (!enemy.healthPatterns) enemy.healthPatterns = {};
                if (!enemy.longerSequences) enemy.longerSequences = {};
                if (!enemy.chargeUtilization) enemy.chargeUtilization = {};
              }
            }
          }
        } else if (data.enemyStats) {
          // Handle old format - import into Dungetron 5000
          console.log('Migrating old statistics format to new dungeon-specific format...');
          this.enemyStats[1] = new Map(data.enemyStats);
          
          // Ensure all enemies have required fields
          for (const [enemyId, enemy] of this.enemyStats[1].entries()) {
            if (!enemy.recentBattles) {
              enemy.recentBattles = [];
            }
            if (!enemy.chargePatterns) {
              enemy.chargePatterns = {};
            }
            // Initialize new tracking fields for backwards compatibility
            if (enemy.wins === undefined) enemy.wins = 0;
            if (enemy.losses === undefined) enemy.losses = 0;
            if (enemy.ties === undefined) enemy.ties = 0;
            if (enemy.winRate === undefined) enemy.winRate = 0;
            if (!enemy.predictionHistory) enemy.predictionHistory = [];
            if (enemy.predictionAccuracy === undefined) enemy.predictionAccuracy = 0;
            if (!enemy.healthPatterns) enemy.healthPatterns = {};
            if (!enemy.longerSequences) enemy.longerSequences = {};
            if (!enemy.chargeUtilization) enemy.chargeUtilization = {};
          }
        }
        
        // Load move sequences by dungeon type
        if (data.moveSequencesByDungeon) {
          for (const [dungeonType, sequences] of Object.entries(data.moveSequencesByDungeon)) {
            const dtype = parseInt(dungeonType);
            if (this.moveSequences[dtype]) {
              this.moveSequences[dtype] = new Map(sequences);
            }
          }
        } else if (data.moveSequences) {
          // Handle old format - import into Dungetron 5000
          this.moveSequences[1] = new Map(data.moveSequences);
        }
        
        const dungetronCount = this.enemyStats[1].size;
        const underhaulCount = this.enemyStats[3].size;
        console.log(`Loaded statistics: ${dungetronCount} Dungetron enemies, ${underhaulCount} Underhaul enemies`);
      } else {
        this.enemyStats = {
          1: new Map(), // Dungetron 5000
          3: new Map()  // Underhaul
        };
        console.log('No existing statistics found, starting fresh');
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      this.enemyStats = {
        1: new Map(),
        3: new Map()
      };
    }
  }

  // Initialize comprehensive metrics for backward compatibility
  initializeComprehensiveMetrics(enemy) {
    // Only add metrics if they don't already exist
    if (enemy.wins === undefined) {
      // 1. Win/Loss Tracking
      enemy.wins = 0;
      enemy.losses = 0;
      enemy.ties = 0;
      enemy.winRate = 0;
      
      // 2. Prediction Validation
      enemy.predictionHistory = [];
      enemy.predictionAccuracy = 0;
      
      // 3. Health-based Patterns
      enemy.healthPatterns = {};
      
      // 4. Extended Sequences
      enemy.longerSequences = {};
      
      // 5. Charge Utilization
      enemy.chargeUtilization = {};
      
      // 6. Turn Performance
      enemy.turnPerformance = {};
      
      // 7. Player Stat Correlations
      enemy.playerStatPatterns = {};
      
      // 8. Enemy Stat Correlations  
      enemy.enemyStatPatterns = {};
      
      // 9. Weapon Effectiveness
      enemy.weaponEffectiveness = {};
      
      // 10. Consecutive Patterns
      enemy.consecutivePatterns = {};
      
      // 11. Response Patterns
      enemy.responsePatterns = {};
      
      // 12. Momentum Tracking
      enemy.momentumPatterns = {};
      
      // 13. Time Patterns
      enemy.timePatterns = {};
      
      // 14. Session Patterns
      enemy.sessionPatterns = {};
      
      // 15. Damage Patterns
      enemy.damagePatterns = {};
      
      // 16. Healing Patterns
      enemy.healingPatterns = {};
      
      // 17. Shield Patterns
      enemy.shieldPatterns = {};
      
      // 18. Energy Patterns
      enemy.energyPatterns = {};
      
      // 19. Granular NoobId Patterns
      enemy.detailedNoobPatterns = {};
      
      // 20. Turn Duration Patterns
      enemy.turnDurationPatterns = {};
      
      // 21. Conservation Patterns
      enemy.conservationPatterns = {};
      
      // 22. Multi-turn Effectiveness
      enemy.multiTurnEffectiveness = {};
      
      // 23. Counter-move Success
      enemy.counterMoveSuccess = {};
      
      // 24. Tie-breaker Patterns
      enemy.tieBreakerPatterns = {};
      
      // 25. Recovery Patterns
      enemy.recoveryPatterns = {};
    }
  }

  saveData() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        lastUpdated: Date.now(),
        dungeonStats: {
          1: Array.from(this.enemyStats[1].entries()),
          3: Array.from(this.enemyStats[3].entries())
        },
        moveSequencesByDungeon: {
          1: Array.from(this.moveSequences[1].entries()),
          3: Array.from(this.moveSequences[3].entries())
        }
      };

      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving statistics:', error);
    }
  }

  setDungeonType(dungeonType) {
    if (dungeonType === 1 || dungeonType === 3) {
      this.currentDungeonType = dungeonType;
      if (!config.minimalOutput) {
        const dungeonName = dungeonType === 1 ? 'Dungetron 5000' : 'Underhaul';
        console.log(`Statistics engine set to track ${dungeonName} enemies`);
      }
    }
  }

  recordBattle(battleData) {
    const {
      enemyId,
      turn,
      playerAction,
      enemyAction,
      result,
      playerStats,
      enemyStats,
      weaponStats,
      noobId,
      timestamp = Date.now()
    } = battleData;

    // Get or create enemy record for current dungeon type
    const dungeonStats = this.enemyStats[this.currentDungeonType];
    if (!dungeonStats.has(enemyId)) {
      dungeonStats.set(enemyId, {
        firstSeen: timestamp,
        lastSeen: timestamp,
        totalBattles: 0,
        moves: { rock: 0, paper: 0, scissor: 0 },
        movesByTurn: {},
        moveSequences: {},
        statCorrelations: {},
        noobIdPatterns: {},
        recentBattles: [], // For recency weighting
        chargePatterns: {}, // Track behavior by charge state
        
        // New tracking fields
        wins: 0,
        losses: 0,
        ties: 0,
        winRate: 0,
        predictionHistory: [], // Track prediction accuracy
        predictionAccuracy: 0,
        healthPatterns: {}, // Track behavior by health thresholds
        longerSequences: {}, // Track 4-5 move patterns
        chargeUtilization: {} // Track charge efficiency
      });
    }

    const enemy = dungeonStats.get(enemyId);
    enemy.lastSeen = timestamp;
    enemy.totalBattles++;

    // Record basic move
    if (enemyAction) {
      enemy.moves[enemyAction]++;
    }

    // Record move by turn
    if (!enemy.movesByTurn[turn]) {
      enemy.movesByTurn[turn] = { rock: 0, paper: 0, scissor: 0 };
    }
    enemy.movesByTurn[turn][enemyAction]++;

    // Track move sequences (last 3 moves)
    const sequenceKey = this.getSequenceKey(enemyId);
    if (sequenceKey && sequenceKey.length >= 2) {
      if (!enemy.moveSequences[sequenceKey]) {
        enemy.moveSequences[sequenceKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.moveSequences[sequenceKey][enemyAction]++;
    }

    // Update sequence tracking
    this.updateSequence(enemyId, enemyAction);

    // Track stat correlations
    if (playerStats && enemyStats) {
      const statKey = this.getStatKey(playerStats, enemyStats);
      if (!enemy.statCorrelations[statKey]) {
        enemy.statCorrelations[statKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.statCorrelations[statKey][enemyAction]++;
    }

    // Track noobId patterns (time-based shifts)
    if (noobId) {
      const noobIdRange = Math.floor(noobId / 100) * 100; // Group by 100s
      if (!enemy.noobIdPatterns[noobIdRange]) {
        enemy.noobIdPatterns[noobIdRange] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.noobIdPatterns[noobIdRange][enemyAction]++;
    }
    
    // Store in recent battles for recency weighting
    enemy.recentBattles.push({
      turn,
      move: enemyAction,
      timestamp,
      sequenceKey: this.getSequenceKey(enemyId)
    });
    
    // Keep only last 100 battles for recency
    if (enemy.recentBattles.length > 100) {
      enemy.recentBattles.shift();
    }
    
    // Track charge-based behavior patterns
    if (enemyStats && enemyStats.charges && enemyAction) {
      const chargeKey = this.getChargeKey(enemyStats.charges);
      if (!enemy.chargePatterns[chargeKey]) {
        enemy.chargePatterns[chargeKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.chargePatterns[chargeKey][enemyAction]++;
      
      // Track charge utilization efficiency
      const totalCharges = (enemyStats.charges.rock || 0) + (enemyStats.charges.paper || 0) + (enemyStats.charges.scissor || 0);
      const chargeUtilKey = `turn${turn}_charges${totalCharges}`;
      if (!enemy.chargeUtilization[chargeUtilKey]) {
        enemy.chargeUtilization[chargeUtilKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.chargeUtilization[chargeUtilKey][enemyAction]++;
    }
    
    // Track win/loss/tie results (from bot's perspective)
    // When bot wins, enemy loses; when bot loses, enemy wins
    if (result === 'win') {
      enemy.losses++;  // Bot won, so enemy lost
    } else if (result === 'loss') {
      enemy.wins++;    // Bot lost, so enemy won
    } else if (result === 'tie') {
      enemy.ties++;
    }
    
    // Update win rate
    const totalResults = enemy.wins + enemy.losses;
    if (totalResults > 0) {
      enemy.winRate = enemy.wins / totalResults;
    }
    
    // Track health-based patterns
    if (enemyStats && enemyStats.health !== undefined) {
      const healthThreshold = this.getHealthThreshold(enemyStats.health);
      if (!enemy.healthPatterns[healthThreshold]) {
        enemy.healthPatterns[healthThreshold] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.healthPatterns[healthThreshold][enemyAction]++;
    }
    
    // Track longer sequences (4-5 moves)
    const longerSequenceKey = this.getLongerSequenceKey(enemyId);
    if (longerSequenceKey && longerSequenceKey.length >= 3) {
      if (!enemy.longerSequences[longerSequenceKey]) {
        enemy.longerSequences[longerSequenceKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.longerSequences[longerSequenceKey][enemyAction]++;
    }
    
    // Store prediction for next turn (will be validated on next battle)
    if (this.lastPrediction && this.lastPrediction.enemyId === enemyId) {
      // Validate previous prediction
      const predictedMove = this.getHighestProbMove(this.lastPrediction.predictions);
      const wasCorrect = predictedMove === enemyAction;
      
      enemy.predictionHistory.push({
        predicted: predictedMove,
        actual: enemyAction,
        correct: wasCorrect,
        confidence: this.lastPrediction.confidence,
        timestamp
      });
      
      // Keep only last 50 predictions
      if (enemy.predictionHistory.length > 50) {
        enemy.predictionHistory.shift();
      }
      
      // Update accuracy
      const correctPredictions = enemy.predictionHistory.filter(p => p.correct).length;
      enemy.predictionAccuracy = enemy.predictionHistory.length > 0 
        ? correctPredictions / enemy.predictionHistory.length 
        : 0;
    }

    // COMPREHENSIVE METRICS TRACKING (NOT USED FOR DECISIONS)
    this.trackComprehensiveMetrics(enemy, battleData, turn, playerAction, enemyAction, result, playerStats, enemyStats, weaponStats, noobId, timestamp);

    // Record to session
    this.sessionData.battles.push({
      enemyId,
      turn,
      playerAction,
      enemyAction,
      result,
      timestamp,
      weaponStats
    });

    // Auto-save every 10 battles
    if (this.sessionData.battles.length % 10 === 0) {
      this.saveData();
    }
  }

  // Track comprehensive metrics (NOT used for decisions)
  trackComprehensiveMetrics(enemy, battleData, turn, playerAction, enemyAction, result, playerStats, enemyStats, weaponStats, noobId, timestamp) {
    // 1. Win/Loss Tracking (from bot's perspective)
    // When bot wins, enemy loses; when bot loses, enemy wins
    if (result === 'win') enemy.losses++;      // Bot won, so enemy lost
    else if (result === 'loss') enemy.wins++;  // Bot lost, so enemy won
    else if (result === 'tie') enemy.ties++;
    enemy.winRate = enemy.wins / (enemy.wins + enemy.losses + enemy.ties);

    // 2. Prediction Validation (store for future analysis)
    enemy.predictionHistory.push({
      turn,
      predicted: null, // TODO: Store prediction when available
      actual: enemyAction,
      correct: false, // TODO: Calculate when prediction available
      timestamp
    });
    if (enemy.predictionHistory.length > 50) enemy.predictionHistory.shift();

    // 3. Health-based Patterns
    if (enemyStats?.healthPercent !== undefined) {
      const healthBracket = Math.floor(enemyStats.healthPercent / 10) * 10; // 0-9 -> 0, 10-19 -> 10, etc.
      const healthKey = `hp_${healthBracket}`;
      if (!enemy.healthPatterns[healthKey]) {
        enemy.healthPatterns[healthKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.healthPatterns[healthKey][enemyAction]++;
    }

    // 4. Extended Sequences (4-5 moves)
    const sequence = this.moveSequences[this.currentDungeonType].get(battleData.enemyId) || [];
    if (sequence.length >= 3) {
      const longerSeq = sequence.slice(-3).join('-');
      if (!enemy.longerSequences[longerSeq]) {
        enemy.longerSequences[longerSeq] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.longerSequences[longerSeq][enemyAction]++;
    }

    // 5. Charge Utilization (efficiency tracking)
    if (enemyStats?.charges) {
      const totalCharges = Math.max(0, enemyStats.charges.rock) + 
                          Math.max(0, enemyStats.charges.paper) + 
                          Math.max(0, enemyStats.charges.scissor);
      const chargeLevel = totalCharges <= 2 ? 'low' : totalCharges <= 5 ? 'medium' : 'high';
      
      if (!enemy.chargeUtilization[chargeLevel]) {
        enemy.chargeUtilization[chargeLevel] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.chargeUtilization[chargeLevel][enemyAction]++;
    }

    // 6. Turn Performance
    if (!enemy.turnPerformance[turn]) {
      enemy.turnPerformance[turn] = { wins: 0, losses: 0, ties: 0, total: 0 };
    }
    enemy.turnPerformance[turn].total++;
    if (result === 'win') enemy.turnPerformance[turn].losses++;  // Bot won, enemy lost
    else if (result === 'loss') enemy.turnPerformance[turn].wins++;   // Bot lost, enemy won
    else if (result === 'tie') enemy.turnPerformance[turn].ties++;

    // 7. Player Stat Correlations
    if (playerStats?.healthPercent !== undefined) {
      const playerHealthKey = `player_hp_${Math.floor(playerStats.healthPercent / 20) * 20}`;
      if (!enemy.playerStatPatterns[playerHealthKey]) {
        enemy.playerStatPatterns[playerHealthKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.playerStatPatterns[playerHealthKey][enemyAction]++;
    }

    // 8. Enemy Stat Correlations
    if (enemyStats?.healthPercent !== undefined && enemyStats?.shield !== undefined) {
      const enemyKey = `enemy_hp${Math.floor(enemyStats.healthPercent / 25) * 25}_sh${enemyStats.shield > 0 ? 'yes' : 'no'}`;
      if (!enemy.enemyStatPatterns[enemyKey]) {
        enemy.enemyStatPatterns[enemyKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.enemyStatPatterns[enemyKey][enemyAction]++;
    }

    // 9. Weapon Effectiveness
    if (weaponStats && playerAction) {
      const weaponKey = `vs_${playerAction}`;
      if (!enemy.weaponEffectiveness[weaponKey]) {
        enemy.weaponEffectiveness[weaponKey] = { rock: 0, paper: 0, scissor: 0, win: 0, loss: 0 };
      }
      enemy.weaponEffectiveness[weaponKey][enemyAction]++;
      if (result === 'win') enemy.weaponEffectiveness[weaponKey].loss++;  // Bot won, enemy lost
      else if (result === 'loss') enemy.weaponEffectiveness[weaponKey].win++;   // Bot lost, enemy won
    }

    // 10. Consecutive Patterns
    const lastMove = sequence.length > 0 ? sequence[sequence.length - 1] : null;
    if (lastMove === enemyAction) {
      const consecKey = `repeat_${enemyAction}`;
      if (!enemy.consecutivePatterns[consecKey]) {
        enemy.consecutivePatterns[consecKey] = { count: 0, maxStreak: 0, currentStreak: 0 };
      }
      enemy.consecutivePatterns[consecKey].currentStreak++;
      enemy.consecutivePatterns[consecKey].count++;
      enemy.consecutivePatterns[consecKey].maxStreak = Math.max(
        enemy.consecutivePatterns[consecKey].maxStreak,
        enemy.consecutivePatterns[consecKey].currentStreak
      );
    } else if (lastMove) {
      // Reset streak for previous move
      Object.keys(enemy.consecutivePatterns).forEach(key => {
        if (key !== `repeat_${enemyAction}`) {
          enemy.consecutivePatterns[key].currentStreak = 0;
        }
      });
    }

    // 11. Response Patterns
    if (playerAction) {
      const responseKey = `after_${playerAction}`;
      if (!enemy.responsePatterns[responseKey]) {
        enemy.responsePatterns[responseKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.responsePatterns[responseKey][enemyAction]++;
    }

    // 12. Momentum Tracking
    const recentResults = enemy.recentBattles.slice(-5).map(b => b.result || 'unknown');
    let momentum = 'neutral';
    const recentWins = recentResults.filter(r => r === 'win').length;
    const recentLosses = recentResults.filter(r => r === 'loss').length;
    
    if (recentWins >= 3) momentum = 'winning';
    else if (recentLosses >= 3) momentum = 'losing';
    
    if (!enemy.momentumPatterns[momentum]) {
      enemy.momentumPatterns[momentum] = { rock: 0, paper: 0, scissor: 0 };
    }
    enemy.momentumPatterns[momentum][enemyAction]++;

    // 13. Time Patterns (hourly)
    const hour = new Date(timestamp).getHours();
    const timeKey = `hour_${hour}`;
    if (!enemy.timePatterns[timeKey]) {
      enemy.timePatterns[timeKey] = { rock: 0, paper: 0, scissor: 0 };
    }
    enemy.timePatterns[timeKey][enemyAction]++;

    // 14. Session Patterns
    const sessionLength = Math.floor((timestamp - enemy.firstSeen) / (1000 * 60)); // minutes
    const sessionKey = sessionLength < 10 ? 'early' : sessionLength < 30 ? 'mid' : 'late';
    if (!enemy.sessionPatterns[sessionKey]) {
      enemy.sessionPatterns[sessionKey] = { rock: 0, paper: 0, scissor: 0 };
    }
    enemy.sessionPatterns[sessionKey][enemyAction]++;

    // 15. Damage Patterns (if available in future)
    // Placeholder for damage-based behavior tracking
    
    // 16. Healing Patterns
    if (enemyStats?.healthPercent !== undefined && enemyStats.healthPercent < 30) {
      const healKey = 'low_health';
      if (!enemy.healingPatterns[healKey]) {
        enemy.healingPatterns[healKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.healingPatterns[healKey][enemyAction]++;
    }

    // 17. Shield Patterns
    if (enemyStats?.shield !== undefined) {
      const shieldKey = enemyStats.shield > 0 ? 'with_shield' : 'no_shield';
      if (!enemy.shieldPatterns[shieldKey]) {
        enemy.shieldPatterns[shieldKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.shieldPatterns[shieldKey][enemyAction]++;
    }

    // 18. Energy Patterns (based on charges as proxy)
    if (enemyStats?.charges) {
      const totalEnergy = Math.max(0, enemyStats.charges.rock) + 
                         Math.max(0, enemyStats.charges.paper) + 
                         Math.max(0, enemyStats.charges.scissor);
      const energyKey = `energy_${Math.floor(totalEnergy / 3) * 3}`;
      if (!enemy.energyPatterns[energyKey]) {
        enemy.energyPatterns[energyKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.energyPatterns[energyKey][enemyAction]++;
    }

    // 19. Granular NoobId Patterns (more detailed time tracking)
    if (noobId) {
      const detailedRange = Math.floor(noobId / 50) * 50; // Groups of 50 instead of 100
      if (!enemy.detailedNoobPatterns[detailedRange]) {
        enemy.detailedNoobPatterns[detailedRange] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.detailedNoobPatterns[detailedRange][enemyAction]++;
    }

    // 20. Turn Duration Patterns (battle speed)
    const duration = timestamp - (enemy.lastSeen || timestamp);
    const speedKey = duration < 1000 ? 'fast' : duration < 3000 ? 'normal' : 'slow';
    if (!enemy.turnDurationPatterns[speedKey]) {
      enemy.turnDurationPatterns[speedKey] = { rock: 0, paper: 0, scissor: 0 };
    }
    enemy.turnDurationPatterns[speedKey][enemyAction]++;

    // 21. Conservation Patterns
    if (enemyStats?.charges) {
      const usedLowChargeWeapon = (enemyAction === 'rock' && enemyStats.charges.rock <= 1) ||
                                 (enemyAction === 'paper' && enemyStats.charges.paper <= 1) ||
                                 (enemyAction === 'scissor' && enemyStats.charges.scissor <= 1);
      const conservationKey = usedLowChargeWeapon ? 'risky_use' : 'safe_use';
      if (!enemy.conservationPatterns[conservationKey]) {
        enemy.conservationPatterns[conservationKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.conservationPatterns[conservationKey][enemyAction]++;
    }

    // 22. Multi-turn Effectiveness
    const multiTurnKey = `turn_${Math.min(turn, 10)}`; // Cap at turn 10
    if (!enemy.multiTurnEffectiveness[multiTurnKey]) {
      enemy.multiTurnEffectiveness[multiTurnKey] = { 
        rock: { wins: 0, total: 0 }, 
        paper: { wins: 0, total: 0 }, 
        scissor: { wins: 0, total: 0 } 
      };
    }
    enemy.multiTurnEffectiveness[multiTurnKey][enemyAction].total++;
    if (result === 'loss') enemy.multiTurnEffectiveness[multiTurnKey][enemyAction].wins++;  // Bot lost, enemy won

    // 23. Counter-move Success
    if (playerAction) {
      const expectedCounter = { rock: 'paper', paper: 'scissor', scissor: 'rock' }[playerAction];
      const counterKey = enemyAction === expectedCounter ? 'successful_counter' : 'failed_counter';
      if (!enemy.counterMoveSuccess[counterKey]) {
        enemy.counterMoveSuccess[counterKey] = { count: 0, wins: 0 };
      }
      enemy.counterMoveSuccess[counterKey].count++;
      if (result === 'loss') enemy.counterMoveSuccess[counterKey].wins++;  // Bot lost, enemy won
    }

    // 24. Tie-breaker Patterns
    if (result === 'tie') {
      const nextMoveKey = 'after_tie';
      // Store for next battle analysis
      if (!enemy.tieBreakerPatterns[nextMoveKey]) {
        enemy.tieBreakerPatterns[nextMoveKey] = { rock: 0, paper: 0, scissor: 0, nextBattleMove: null };
      }
      // This will be filled in the next battle
    } else if (enemy.tieBreakerPatterns.after_tie?.nextBattleMove === null && 
               enemy.recentBattles.length > 0 && 
               enemy.recentBattles[enemy.recentBattles.length - 1].result === 'tie') {
      // Previous battle was a tie, record this as the tie-breaker move
      enemy.tieBreakerPatterns.after_tie[enemyAction]++;
    }

    // 25. Recovery Patterns (after taking damage)
    const prevBattle = enemy.recentBattles.length > 0 ? enemy.recentBattles[enemy.recentBattles.length - 1] : null;
    if (prevBattle?.result === 'loss') {
      const recoveryKey = 'after_loss';
      if (!enemy.recoveryPatterns[recoveryKey]) {
        enemy.recoveryPatterns[recoveryKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.recoveryPatterns[recoveryKey][enemyAction]++;
    }
  }

  getSequenceKey(enemyId) {
    const sequence = this.moveSequences[this.currentDungeonType].get(enemyId) || [];
    if (sequence.length < 2) return null;
    return sequence.slice(-2).join('-');
  }

  updateSequence(enemyId, move) {
    const dungeonSequences = this.moveSequences[this.currentDungeonType];
    if (!dungeonSequences.has(enemyId)) {
      dungeonSequences.set(enemyId, []);
    }
    const sequence = dungeonSequences.get(enemyId);
    sequence.push(move);
    if (sequence.length > 3) {
      sequence.shift(); // Keep only last 3 moves
    }
  }

  getStatKey(playerStats, enemyStats) {
    // Create a simplified stat key for correlation tracking
    const pHealth = Math.floor(playerStats.healthPercent / 20) * 20; // 0, 20, 40, 60, 80, 100
    const eHealth = Math.floor(enemyStats.healthPercent / 20) * 20;
    return `p${pHealth}_e${eHealth}`;
  }
  
  getChargeKey(charges) {
    // Create a charge state key for behavioral tracking
    // Track specific charge levels and conservation patterns
    const r = charges.rock;
    const p = charges.paper;
    const s = charges.scissor;
    
    // For Underhaul: negative means recharging, 0+ means available
    // Check for recharging weapons (negative charges)
    if (r < 0 && p >= 0 && s >= 0) return 'rock_recharging';
    if (p < 0 && r >= 0 && s >= 0) return 'paper_recharging';
    if (s < 0 && r >= 0 && p >= 0) return 'scissor_recharging';
    
    // Multiple recharging
    if (r < 0 && p < 0) return 'rock_paper_recharging';
    if (r < 0 && s < 0) return 'rock_scissor_recharging';
    if (p < 0 && s < 0) return 'paper_scissor_recharging';
    if (r < 0 && p < 0 && s < 0) return 'all_recharging'; // Should never happen
    
    // Count available weapons (0 or positive charges)
    const available = (r >= 0 ? 1 : 0) + (p >= 0 ? 1 : 0) + (s >= 0 ? 1 : 0);
    const total = Math.max(0, r) + Math.max(0, p) + Math.max(0, s);
    
    // Special cases for limited options (considering 0 as usable)
    if (r < 0 && p >= 0 && s >= 0) return 'no_rock';
    if (p < 0 && r >= 0 && s >= 0) return 'no_paper';
    if (s < 0 && r >= 0 && p >= 0) return 'no_scissor';
    
    // Low charge situations
    if (total <= 3) return 'critical_low';
    if (total <= 5) return 'low_charges';
    
    // Specific charge patterns
    if (r === 1 && p >= 2 && s >= 2) return 'rock_conservation';
    if (p === 1 && r >= 2 && s >= 2) return 'paper_conservation';
    if (s === 1 && r >= 2 && p >= 2) return 'scissor_conservation';
    
    // General charge levels
    return `r${r}_p${p}_s${s}`;
  }
  
  getHealthThreshold(health) {
    // Categorize health into meaningful thresholds
    if (health >= 80) return 'high';
    if (health >= 60) return 'medium-high';
    if (health >= 40) return 'medium';
    if (health >= 20) return 'low';
    return 'critical';
  }
  
  getLongerSequenceKey(enemyId) {
    // Get last 4-5 moves for longer pattern recognition
    const dungeonSequences = this.moveSequences[this.currentDungeonType];
    if (!dungeonSequences || !dungeonSequences.has(enemyId)) {
      return null;
    }
    
    const sequence = dungeonSequences.get(enemyId);
    if (sequence.length < 3) {
      return null;
    }
    
    // Create a key from last 3-5 moves (for next move prediction)
    // We'll use up to last 4 moves to predict the 5th
    return sequence.slice(-4).join('-');
  }
  
  getHighestProbMove(predictions) {
    // Get the move with highest probability
    let maxProb = -1;
    let bestMove = 'rock';
    
    for (const [move, prob] of Object.entries(predictions)) {
      if (prob > maxProb) {
        maxProb = prob;
        bestMove = move;
      }
    }
    
    return bestMove;
  }

  predictNextMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId, enemyPossibleMoves = null) {
    const enemy = this.enemyStats[this.currentDungeonType].get(enemyId);
    if (!enemy || enemy.totalBattles < 5) {
      // Not enough data, return null
      return null;
    }

    const predictions = {
      rock: 0,
      paper: 0,
      scissor: 0
    };

    // Weight factors (adjusted based on prediction accuracy)
    const baseWeights = {
      overall: 0.05,       // Overall move distribution
      turnSpecific: 0.10,  // Turn-specific patterns
      sequence: 0.25,      // Move sequences (3-move) - RESTORED
      longerSequence: 0.05, // Longer sequences (4-5 moves) - REDUCED until we have data
      statCorrelation: 0.10, // Stat-based patterns
      noobIdPattern: 0.05,  // Time-based shifts
      recent: 0.20,        // Recent battles - RESTORED
      chargePattern: 0.25,  // Charge-based behavior - RESTORED
      healthPattern: 0.00   // Health-based patterns - DISABLED until we have data
    };
    
    // Adjust weights based on prediction accuracy if available
    const weights = { ...baseWeights };
    // Only adjust weights if we have significant prediction history
    if (enemy.predictionAccuracy !== undefined && enemy.predictionHistory.length >= 30) {
      // If we're predicting well, slightly increase confidence in our patterns
      if (enemy.predictionAccuracy > 0.65) {
        weights.sequence *= 1.1;
        weights.chargePattern *= 1.1;
        // Only boost new patterns if they have data
        if (Object.keys(enemy.longerSequences || {}).length > 5) {
          weights.longerSequence *= 1.2;
        }
        if (Object.keys(enemy.healthPatterns || {}).length > 5) {
          weights.healthPattern = 0.05; // Enable with small weight
        }
      } else if (enemy.predictionAccuracy < 0.35) {
        // If predictions are poor, rely more on recent and overall patterns
        weights.recent *= 1.2;
        weights.overall *= 1.3;
        weights.sequence *= 0.9;
      }
    }

    // 1. Overall move distribution
    const totalMoves = enemy.moves.rock + enemy.moves.paper + enemy.moves.scissor;
    if (totalMoves > 0) {
      predictions.rock += weights.overall * (enemy.moves.rock / totalMoves);
      predictions.paper += weights.overall * (enemy.moves.paper / totalMoves);
      predictions.scissor += weights.overall * (enemy.moves.scissor / totalMoves);
    }

    // 2. Turn-specific patterns
    if (enemy.movesByTurn[turn]) {
      const turnMoves = enemy.movesByTurn[turn];
      const turnTotal = turnMoves.rock + turnMoves.paper + turnMoves.scissor;
      if (turnTotal > 0) {
        predictions.rock += weights.turnSpecific * (turnMoves.rock / turnTotal);
        predictions.paper += weights.turnSpecific * (turnMoves.paper / turnTotal);
        predictions.scissor += weights.turnSpecific * (turnMoves.scissor / turnTotal);
      }
    }

    // 3. Sequence-based prediction (most important)
    const sequenceKey = this.getSequenceKey(enemyId);
    if (sequenceKey && enemy.moveSequences[sequenceKey]) {
      const seqMoves = enemy.moveSequences[sequenceKey];
      const seqTotal = seqMoves.rock + seqMoves.paper + seqMoves.scissor;
      if (seqTotal >= 3) { // Only use if we have at least 3 samples
        predictions.rock += weights.sequence * (seqMoves.rock / seqTotal);
        predictions.paper += weights.sequence * (seqMoves.paper / seqTotal);
        predictions.scissor += weights.sequence * (seqMoves.scissor / seqTotal);
      }
    }

    // 4. Stat correlation patterns
    if (playerStats && enemyStats) {
      const statKey = this.getStatKey(playerStats, enemyStats);
      if (enemy.statCorrelations[statKey]) {
        const statMoves = enemy.statCorrelations[statKey];
        const statTotal = statMoves.rock + statMoves.paper + statMoves.scissor;
        if (statTotal > 0) {
          predictions.rock += weights.statCorrelation * (statMoves.rock / statTotal);
          predictions.paper += weights.statCorrelation * (statMoves.paper / statTotal);
          predictions.scissor += weights.statCorrelation * (statMoves.scissor / statTotal);
        }
      }
    }

    // 5. NoobId patterns (time-based)
    if (noobId) {
      const noobIdRange = Math.floor(noobId / 100) * 100;
      if (enemy.noobIdPatterns[noobIdRange]) {
        const noobMoves = enemy.noobIdPatterns[noobIdRange];
        const noobTotal = noobMoves.rock + noobMoves.paper + noobMoves.scissor;
        if (noobTotal > 0) {
          predictions.rock += weights.noobIdPattern * (noobMoves.rock / noobTotal);
          predictions.paper += weights.noobIdPattern * (noobMoves.paper / noobTotal);
          predictions.scissor += weights.noobIdPattern * (noobMoves.scissor / noobTotal);
        }
      }
    }
    
    // 6. Recency-weighted predictions
    if (enemy.recentBattles && enemy.recentBattles.length > 0) {
      const now = Date.now();
      const recentMoves = { rock: 0, paper: 0, scissor: 0 };
      let totalWeight = 0;
      
      // Calculate recency-weighted move distribution
      for (const battle of enemy.recentBattles) {
        const age = (now - battle.timestamp) / (1000 * 60 * 60); // Age in hours
        const recencyWeight = Math.exp(-0.1 * age); // Exponential decay
        
        if (battle.move) {
          recentMoves[battle.move] += recencyWeight;
          totalWeight += recencyWeight;
        }
      }
      
      // Apply recent pattern predictions
      if (totalWeight > 0) {
        predictions.rock += weights.recent * (recentMoves.rock / totalWeight);
        predictions.paper += weights.recent * (recentMoves.paper / totalWeight);
        predictions.scissor += weights.recent * (recentMoves.scissor / totalWeight);
      }
    }
    
    // 7. Charge-based patterns (NEW AND CRITICAL!)
    if (enemyStats && enemyStats.charges && enemy.chargePatterns) {
      const chargeKey = this.getChargeKey(enemyStats.charges);
      if (enemy.chargePatterns[chargeKey]) {
        const chargeMoves = enemy.chargePatterns[chargeKey];
        const chargeTotal = chargeMoves.rock + chargeMoves.paper + chargeMoves.scissor;
        if (chargeTotal >= 3) { // Need at least 3 samples
          predictions.rock += weights.chargePattern * (chargeMoves.rock / chargeTotal);
          predictions.paper += weights.chargePattern * (chargeMoves.paper / chargeTotal);
          predictions.scissor += weights.chargePattern * (chargeMoves.scissor / chargeTotal);
          
          if (!config.minimalOutput) {
            console.log(`  Charge pattern "${chargeKey}": R${(chargeMoves.rock/chargeTotal*100).toFixed(0)}% P${(chargeMoves.paper/chargeTotal*100).toFixed(0)}% S${(chargeMoves.scissor/chargeTotal*100).toFixed(0)}%`);
          }
        }
      }
    }
    
    // 8. Health-based patterns
    if (enemyStats && enemyStats.health !== undefined && enemy.healthPatterns) {
      const healthThreshold = this.getHealthThreshold(enemyStats.health);
      if (enemy.healthPatterns[healthThreshold]) {
        const healthMoves = enemy.healthPatterns[healthThreshold];
        const healthTotal = healthMoves.rock + healthMoves.paper + healthMoves.scissor;
        if (healthTotal >= 5) { // Need at least 5 samples
          predictions.rock += weights.healthPattern * (healthMoves.rock / healthTotal);
          predictions.paper += weights.healthPattern * (healthMoves.paper / healthTotal);
          predictions.scissor += weights.healthPattern * (healthMoves.scissor / healthTotal);
        }
      }
    }
    
    // 9. Longer sequence patterns (4-5 moves)
    const longerSequenceKey = this.getLongerSequenceKey(enemyId);
    if (longerSequenceKey && enemy.longerSequences && enemy.longerSequences[longerSequenceKey]) {
      const longSeqMoves = enemy.longerSequences[longerSequenceKey];
      const longSeqTotal = longSeqMoves.rock + longSeqMoves.paper + longSeqMoves.scissor;
      if (longSeqTotal >= 2) { // Need at least 2 samples for longer patterns
        predictions.rock += weights.longerSequence * (longSeqMoves.rock / longSeqTotal);
        predictions.paper += weights.longerSequence * (longSeqMoves.paper / longSeqTotal);
        predictions.scissor += weights.longerSequence * (longSeqMoves.scissor / longSeqTotal);
        
        if (!config.minimalOutput) {
          console.log(`  Long sequence pattern found: R${(longSeqMoves.rock/longSeqTotal*100).toFixed(0)}% P${(longSeqMoves.paper/longSeqTotal*100).toFixed(0)}% S${(longSeqMoves.scissor/longSeqTotal*100).toFixed(0)}%`);
        }
      }
    }

    // Normalize predictions
    let total = predictions.rock + predictions.paper + predictions.scissor;
    if (total > 0) {
      predictions.rock /= total;
      predictions.paper /= total;
      predictions.scissor /= total;
    }

    // CRITICAL: Filter out impossible moves based on enemy charges
    if (enemyPossibleMoves && enemyPossibleMoves.length < 3) {
      if (!config.minimalOutput) {
        console.log(`  Charge filter: Enemy can only play ${enemyPossibleMoves.join(', ')}`);
        console.log(`  Pre-filter predictions: R${(predictions.rock*100).toFixed(0)}% P${(predictions.paper*100).toFixed(0)}% S${(predictions.scissor*100).toFixed(0)}%`);
      }
      
      // Zero out impossible moves
      if (!enemyPossibleMoves.includes('rock')) predictions.rock = 0;
      if (!enemyPossibleMoves.includes('paper')) predictions.paper = 0;
      if (!enemyPossibleMoves.includes('scissor')) predictions.scissor = 0;
      
      // Renormalize after filtering
      total = predictions.rock + predictions.paper + predictions.scissor;
      if (total > 0) {
        predictions.rock /= total;
        predictions.paper /= total;
        predictions.scissor /= total;
      }
      
      if (!config.minimalOutput) {
        console.log(`  Post-filter predictions: R${(predictions.rock*100).toFixed(0)}% P${(predictions.paper*100).toFixed(0)}% S${(predictions.scissor*100).toFixed(0)}%`);
      }
    }

    // Apply weapon stats weighting
    const weaponScores = this.calculateWeaponScores(predictions, weaponStats);
    
    // Boost confidence when enemy has limited options
    let chargeConfidenceBoost = 0;
    if (enemyPossibleMoves) {
      if (enemyPossibleMoves.length === 1) chargeConfidenceBoost = 0.5;  // 100% certain
      else if (enemyPossibleMoves.length === 2) chargeConfidenceBoost = 0.2;  // 50/50
    }
    
    // Calculate base confidence
    let baseConfidence = this.calculateConfidence(enemy, sequenceKey);
    
    // Adjust confidence based on actual prediction accuracy
    if (enemy.predictionAccuracy !== undefined && enemy.predictionHistory.length >= 10) {
      // Scale confidence based on how well we're actually predicting
      const accuracyMultiplier = 0.5 + enemy.predictionAccuracy; // 0.5 to 1.5
      baseConfidence *= accuracyMultiplier;
      
      if (!config.minimalOutput && enemy.predictionHistory.length >= 20) {
        const recent10 = enemy.predictionHistory.slice(-10);
        const recent10Accuracy = recent10.filter(p => p.correct).length / 10;
        console.log(`  Prediction accuracy: Overall ${(enemy.predictionAccuracy*100).toFixed(0)}%, Recent ${(recent10Accuracy*100).toFixed(0)}%`);
      }
    }
    
    const finalConfidence = Math.min(0.9, baseConfidence + chargeConfidenceBoost);
    
    // Store this prediction for future validation
    const prediction = {
      enemyId,
      predictions,
      weaponScores,
      confidence: finalConfidence,
      possibleMoves: enemyPossibleMoves,
      timestamp: Date.now()
    };
    
    this.lastPrediction = prediction;

    return prediction;
  }

  calculateWeaponScores(predictions, weaponStats) {
    // Rock beats scissor, paper beats rock, scissor beats paper
    const scores = {
      rock: predictions.scissor - predictions.paper,    // Good vs scissor, bad vs paper
      paper: predictions.rock - predictions.scissor,     // Good vs rock, bad vs scissor
      scissor: predictions.paper - predictions.rock      // Good vs paper, bad vs rock
    };

    // Apply attack stat weighting
    if (weaponStats) {
      const attackWeight = 0.2; // 20% bonus for attack stats
      const maxAttack = Math.max(weaponStats.rock.attack, weaponStats.paper.attack, weaponStats.scissor.attack);
      
      if (maxAttack > 0) {
        scores.rock += attackWeight * (weaponStats.rock.attack / maxAttack);
        scores.paper += attackWeight * (weaponStats.paper.attack / maxAttack);
        scores.scissor += attackWeight * (weaponStats.scissor.attack / maxAttack);
      }
    }

    return scores;
  }

  calculateConfidence(enemy, sequenceKey) {
    let confidence = 0;
    
    // Base confidence on data volume
    confidence += Math.min(enemy.totalBattles / 50, 0.3); // Up to 30% from battle count
    
    // Sequence match confidence
    if (sequenceKey && enemy.moveSequences[sequenceKey]) {
      const seqData = enemy.moveSequences[sequenceKey];
      const seqTotal = seqData.rock + seqData.paper + seqData.scissor;
      if (seqTotal >= 5) {
        confidence += 0.3; // 30% for good sequence data
        
        // Additional confidence if pattern is strong
        const maxProb = Math.max(seqData.rock, seqData.paper, seqData.scissor) / seqTotal;
        if (maxProb > 0.6) {
          confidence += 0.2; // 20% for strong pattern
        }
      }
    }
    
    return Math.min(confidence, 0.9); // Cap at 90%
  }

  getAnalysisReport(enemyId = null) {
    if (enemyId) {
      const enemy = this.enemyStats[this.currentDungeonType].get(enemyId);
      if (!enemy) return null;
      
      return {
        enemyId,
        totalBattles: enemy.totalBattles,
        moves: enemy.moves,
        favoriteMove: this.getFavoriteMove(enemy.moves),
        turnPatterns: this.analyzeTurnPatterns(enemy.movesByTurn),
        strongestSequences: this.getStrongestSequences(enemy.moveSequences),
        noobIdShifts: this.analyzeNoobIdShifts(enemy.noobIdPatterns),
        // New statistics
        wins: enemy.wins,
        losses: enemy.losses,
        ties: enemy.ties,
        winRate: enemy.winRate,
        predictionAccuracy: enemy.predictionAccuracy,
        predictionSampleSize: enemy.predictionHistory.length,
        healthPatternCount: Object.keys(enemy.healthPatterns).length,
        longerSequenceCount: Object.keys(enemy.longerSequences).length,
        chargePatternCount: Object.keys(enemy.chargePatterns).length
      };
    }
    
    // Overall analysis
    const dungeonStats = this.enemyStats[this.currentDungeonType];
    const report = {
      dungeonType: this.currentDungeonType,
      dungeonName: this.currentDungeonType === 1 ? 'Dungetron 5000' : 'Underhaul',
      totalEnemies: dungeonStats.size,
      totalBattles: Array.from(dungeonStats.values()).reduce((sum, e) => sum + e.totalBattles, 0),
      sessionBattles: this.sessionData.battles.length,
      enemyReports: []
    };
    
    for (const [id, enemy] of dungeonStats.entries()) {
      if (enemy.totalBattles >= 10) {
        report.enemyReports.push(this.getAnalysisReport(id));
      }
    }
    
    return report;
  }

  getFavoriteMove(moves) {
    const entries = Object.entries(moves);
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  analyzeTurnPatterns(movesByTurn) {
    const patterns = [];
    for (const [turn, moves] of Object.entries(movesByTurn)) {
      const total = moves.rock + moves.paper + moves.scissor;
      if (total >= 3) {
        patterns.push({
          turn: parseInt(turn),
          favoriteMove: this.getFavoriteMove(moves),
          distribution: {
            rock: moves.rock / total,
            paper: moves.paper / total,
            scissor: moves.scissor / total
          }
        });
      }
    }
    return patterns.sort((a, b) => a.turn - b.turn);
  }

  getStrongestSequences(moveSequences) {
    const sequences = [];
    for (const [seq, moves] of Object.entries(moveSequences)) {
      const total = moves.rock + moves.paper + moves.scissor;
      if (total >= 3) {
        const maxMove = this.getFavoriteMove(moves);
        const probability = moves[maxMove] / total;
        if (probability > 0.5) {
          sequences.push({
            sequence: seq,
            nextMove: maxMove,
            probability,
            samples: total
          });
        }
      }
    }
    return sequences.sort((a, b) => b.probability - a.probability).slice(0, 5);
  }

  analyzeNoobIdShifts(noobIdPatterns) {
    const shifts = [];
    const ranges = Object.keys(noobIdPatterns).map(r => parseInt(r)).sort((a, b) => a - b);
    
    for (let i = 1; i < ranges.length; i++) {
      const prev = noobIdPatterns[ranges[i-1]];
      const curr = noobIdPatterns[ranges[i]];
      
      const prevTotal = prev.rock + prev.paper + prev.scissor;
      const currTotal = curr.rock + curr.paper + curr.scissor;
      
      if (prevTotal >= 5 && currTotal >= 5) {
        const prevFav = this.getFavoriteMove(prev);
        const currFav = this.getFavoriteMove(curr);
        
        if (prevFav !== currFav) {
          shifts.push({
            fromRange: ranges[i-1],
            toRange: ranges[i],
            shift: `${prevFav} → ${currFav}`
          });
        }
      }
    }
    
    return shifts;
  }

  clearSessionData() {
    this.sessionData = {
      startTime: Date.now(),
      battles: [],
      enemies: new Map()
    };
  }

  exportStatistics() {
    this.saveData();
  }
  
  // Get battle count for an enemy
  getBattleCount(enemyId) {
    const enemy = this.enemyStats[this.currentDungeonType].get(enemyId);
    return enemy ? enemy.totalBattles : 0;
  }
}