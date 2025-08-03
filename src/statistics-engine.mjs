import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StatisticsEngine {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'battle-statistics.json');
    this.moveSequences = new Map(); // Track move sequences by enemy
    this.sessionData = {
      startTime: Date.now(),
      battles: [],
      enemies: new Map()
    };
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
        
        // Convert arrays back to Maps
        if (data.enemyStats) {
          this.enemyStats = new Map(data.enemyStats);
        } else {
          this.enemyStats = new Map();
        }
        
        if (data.moveSequences) {
          this.moveSequences = new Map(data.moveSequences);
        }
        
        console.log(`Loaded statistics for ${this.enemyStats.size} enemies`);
      } else {
        this.enemyStats = new Map();
        console.log('No existing statistics found, starting fresh');
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      this.enemyStats = new Map();
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
        enemyStats: Array.from(this.enemyStats.entries()),
        moveSequences: Array.from(this.moveSequences.entries())
      };

      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving statistics:', error);
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

    // Get or create enemy record
    if (!this.enemyStats.has(enemyId)) {
      this.enemyStats.set(enemyId, {
        firstSeen: timestamp,
        lastSeen: timestamp,
        totalBattles: 0,
        moves: { rock: 0, paper: 0, scissor: 0 },
        movesByTurn: {},
        moveSequences: {},
        statCorrelations: {},
        noobIdPatterns: {}
      });
    }

    const enemy = this.enemyStats.get(enemyId);
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
    const sequence = this.moveSequences.get(enemyId) || [];
    if (sequence.length < 2) return null;
    return sequence.slice(-2).join('-');
  }

  updateSequence(enemyId, move) {
    if (!this.moveSequences.has(enemyId)) {
      this.moveSequences.set(enemyId, []);
    }
    const sequence = this.moveSequences.get(enemyId);
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

  predictNextMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId) {
    const enemy = this.enemyStats.get(enemyId);
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
      overall: 0.1,        // Overall move distribution
      turnSpecific: 0.2,   // Turn-specific patterns
      sequence: 0.4,       // Move sequences (most important)
      statCorrelation: 0.15, // Stat-based patterns
      noobIdPattern: 0.15   // Time-based shifts
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

    // Normalize predictions
    const total = predictions.rock + predictions.paper + predictions.scissor;
    if (total > 0) {
      predictions.rock /= total;
      predictions.paper /= total;
      predictions.scissor /= total;
    }

    // Apply weapon stats weighting
    const weaponScores = this.calculateWeaponScores(predictions, weaponStats);

    return {
      predictions,
      weaponScores,
      confidence: this.calculateConfidence(enemy, sequenceKey)
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
      const enemy = this.enemyStats.get(enemyId);
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
    const report = {
      totalEnemies: this.enemyStats.size,
      totalBattles: Array.from(this.enemyStats.values()).reduce((sum, e) => sum + e.totalBattles, 0),
      sessionBattles: this.sessionData.battles.length,
      enemyReports: []
    };
    
    for (const [id, enemy] of this.enemyStats.entries()) {
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
}