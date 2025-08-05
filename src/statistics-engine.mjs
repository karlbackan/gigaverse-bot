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
        chargePatterns: {} // NEW: Track behavior by charge state
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
    }

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
    const total = r + p + s;
    
    // Special cases for limited options
    if (r === 0 && p > 0 && s > 0) return 'no_rock';
    if (p === 0 && r > 0 && s > 0) return 'no_paper';
    if (s === 0 && r > 0 && p > 0) return 'no_scissor';
    
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

    // Weight factors (configurable)
    const weights = {
      overall: 0.05,       // Overall move distribution (reduced)
      turnSpecific: 0.10,  // Turn-specific patterns (reduced)
      sequence: 0.25,      // Move sequences (reduced for charge priority)
      statCorrelation: 0.1, // Stat-based patterns (reduced)
      noobIdPattern: 0.05,  // Time-based shifts (reduced)
      recent: 0.20,        // Recent battles
      chargePattern: 0.25  // NEW: Charge-based behavior (high priority!)
    };

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

    return {
      predictions,
      weaponScores,
      confidence: Math.min(0.9, this.calculateConfidence(enemy, sequenceKey) + chargeConfidenceBoost),
      possibleMoves: enemyPossibleMoves  // Include for decision making
    };
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
        noobIdShifts: this.analyzeNoobIdShifts(enemy.noobIdPatterns)
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