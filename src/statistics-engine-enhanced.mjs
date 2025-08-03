import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StatisticsEngineEnhanced {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', 'battle-statistics.json');
    this.moveHistory = new Map(); // Full history per enemy
    this.sessionData = {
      startTime: Date.now(),
      battles: [],
      enemies: new Map()
    };
    
    // Configuration for pattern detection
    this.patternConfig = {
      minSequenceLength: 2,
      maxSequenceLength: 9, // Support up to 9-move patterns like Wizard_16
      minSamples: 3, // Minimum samples to consider a pattern valid
      confidenceThreshold: 0.7 // Minimum confidence for pattern matching
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
        
        // Load move history
        if (data.moveHistory) {
          this.moveHistory = new Map(data.moveHistory);
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
        moveHistory: Array.from(this.moveHistory.entries())
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
        moveSequences: {}, // Now stores variable-length sequences
        statCorrelations: {},
        noobIdPatterns: {},
        // New: Pattern analysis results
        detectedPatterns: {
          cycleLength: null,
          sequencePatterns: {},
          turnBasedPatterns: {},
          adaptivePatterns: {}
        }
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

    // Update move history
    if (!this.moveHistory.has(enemyId)) {
      this.moveHistory.set(enemyId, []);
    }
    const history = this.moveHistory.get(enemyId);
    history.push({ turn, move: enemyAction, playerMove: playerAction });
    
    // Track variable-length sequences
    this.updateSequencePatterns(enemyId, enemyAction, history);

    // Track stat correlations
    if (playerStats && enemyStats) {
      const statKey = this.getStatKey(playerStats, enemyStats);
      if (!enemy.statCorrelations[statKey]) {
        enemy.statCorrelations[statKey] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.statCorrelations[statKey][enemyAction]++;
    }

    // Track noobId patterns
    if (noobId) {
      const noobIdRange = Math.floor(noobId / 100) * 100;
      if (!enemy.noobIdPatterns[noobIdRange]) {
        enemy.noobIdPatterns[noobIdRange] = { rock: 0, paper: 0, scissor: 0 };
      }
      enemy.noobIdPatterns[noobIdRange][enemyAction]++;
    }

    // Analyze patterns periodically
    if (enemy.totalBattles % 50 === 0) {
      this.analyzePatterns(enemyId);
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

  updateSequencePatterns(enemyId, newMove, history) {
    const enemy = this.enemyStats.get(enemyId);
    
    // Track sequences of different lengths
    for (let length = this.patternConfig.minSequenceLength; 
         length <= Math.min(history.length, this.patternConfig.maxSequenceLength); 
         length++) {
      
      if (history.length >= length) {
        // Get the last N-1 moves as the sequence key
        const sequenceMoves = history.slice(-(length)).slice(0, -1).map(h => h.move);
        const sequenceKey = `${length}:${sequenceMoves.join('-')}`;
        
        if (!enemy.moveSequences[sequenceKey]) {
          enemy.moveSequences[sequenceKey] = { rock: 0, paper: 0, scissor: 0 };
        }
        enemy.moveSequences[sequenceKey][newMove]++;
      }
    }
  }

  analyzePatterns(enemyId) {
    const enemy = this.enemyStats.get(enemyId);
    const history = this.moveHistory.get(enemyId) || [];
    
    if (history.length < 20) return; // Need enough data
    
    // 1. Detect cycle length (for repeating patterns)
    const cycleLength = this.detectCycleLength(history);
    if (cycleLength) {
      enemy.detectedPatterns.cycleLength = cycleLength;
    }
    
    // 2. Find strongest sequence patterns
    enemy.detectedPatterns.sequencePatterns = this.findStrongestSequences(enemy.moveSequences);
    
    // 3. Detect turn-based patterns
    enemy.detectedPatterns.turnBasedPatterns = this.analyzeTurnPatterns(enemy.movesByTurn);
    
    // 4. Detect adaptive patterns (responds to player moves)
    enemy.detectedPatterns.adaptivePatterns = this.detectAdaptivePatterns(history);
  }

  detectCycleLength(history) {
    const moves = history.map(h => h.move);
    
    // Try different cycle lengths
    for (let cycleLen = 2; cycleLen <= Math.min(20, Math.floor(moves.length / 3)); cycleLen++) {
      let matches = true;
      
      // Check if pattern repeats consistently
      for (let i = cycleLen; i < moves.length && i < cycleLen * 3; i++) {
        if (moves[i] !== moves[i % cycleLen]) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        // Verify with more cycles if possible
        let cycleCount = Math.floor(moves.length / cycleLen);
        let consistency = 0;
        
        for (let cycle = 1; cycle < cycleCount; cycle++) {
          let cycleMatches = 0;
          for (let i = 0; i < cycleLen; i++) {
            if (moves[cycle * cycleLen + i] === moves[i]) {
              cycleMatches++;
            }
          }
          consistency += cycleMatches / cycleLen;
        }
        
        if (consistency / (cycleCount - 1) > 0.8) {
          return cycleLen;
        }
      }
    }
    
    return null;
  }

  findStrongestSequences(moveSequences) {
    const sequences = [];
    
    for (const [seq, moves] of Object.entries(moveSequences)) {
      const total = moves.rock + moves.paper + moves.scissor;
      if (total >= this.patternConfig.minSamples) {
        const [length, pattern] = seq.split(':');
        const maxMove = this.getFavoriteMove(moves);
        const probability = moves[maxMove] / total;
        
        if (probability > this.patternConfig.confidenceThreshold) {
          sequences.push({
            length: parseInt(length),
            sequence: pattern,
            nextMove: maxMove,
            probability,
            samples: total,
            distribution: {
              rock: moves.rock / total,
              paper: moves.paper / total,
              scissor: moves.scissor / total
            }
          });
        }
      }
    }
    
    // Sort by length (prefer longer patterns) and probability
    return sequences.sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length;
      return b.probability - a.probability;
    }).slice(0, 10);
  }

  detectAdaptivePatterns(history) {
    const patterns = {
      countersLast: false,
      mirrorsLast: false,
      cyclesOnWin: false,
      cyclesOnLoss: false
    };
    
    if (history.length < 10) return patterns;
    
    let countersCount = 0;
    let mirrorsCount = 0;
    
    for (let i = 1; i < history.length; i++) {
      const lastPlayerMove = history[i-1].playerMove;
      const currentEnemyMove = history[i].move;
      
      // Check if enemy counters player's last move
      const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
      if (currentEnemyMove === counter[lastPlayerMove]) {
        countersCount++;
      }
      
      // Check if enemy mirrors player's last move
      if (currentEnemyMove === lastPlayerMove) {
        mirrorsCount++;
      }
    }
    
    const adaptiveRatio = 0.5; // 50% threshold
    patterns.countersLast = countersCount / (history.length - 1) > adaptiveRatio;
    patterns.mirrorsLast = mirrorsCount / (history.length - 1) > adaptiveRatio;
    
    return patterns;
  }

  getStatKey(playerStats, enemyStats) {
    const pHealth = Math.floor(playerStats.healthPercent / 20) * 20;
    const eHealth = Math.floor(enemyStats.healthPercent / 20) * 20;
    return `p${pHealth}_e${eHealth}`;
  }

  predictNextMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId) {
    const enemy = this.enemyStats.get(enemyId);
    if (!enemy || enemy.totalBattles < 5) {
      return null;
    }

    const predictions = {
      rock: 0,
      paper: 0,
      scissor: 0
    };

    // Enhanced weight factors
    const weights = {
      overall: 0.05,        // Reduced - overall distribution
      turnSpecific: 0.15,   // Turn-specific patterns
      sequence: 0.50,       // Increased - sequence patterns (most important)
      statCorrelation: 0.10,
      noobIdPattern: 0.10,
      cyclePattern: 0.10    // New - cycle-based prediction
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

    // 3. Enhanced sequence-based prediction
    const history = this.moveHistory.get(enemyId) || [];
    if (history.length >= 2) {
      let bestSequenceMatch = null;
      let bestSequenceScore = 0;
      
      // Try different sequence lengths, preferring longer matches
      for (let length = Math.min(history.length, this.patternConfig.maxSequenceLength); 
           length >= this.patternConfig.minSequenceLength; 
           length--) {
        
        const recentMoves = history.slice(-length).map(h => h.move);
        const sequenceKey = `${length}:${recentMoves.join('-')}`;
        
        if (enemy.moveSequences[sequenceKey]) {
          const seqMoves = enemy.moveSequences[sequenceKey];
          const seqTotal = seqMoves.rock + seqMoves.paper + seqMoves.scissor;
          
          if (seqTotal >= this.patternConfig.minSamples) {
            const score = length * Math.log(seqTotal + 1); // Prefer longer patterns with more samples
            if (score > bestSequenceScore) {
              bestSequenceScore = score;
              bestSequenceMatch = {
                moves: seqMoves,
                total: seqTotal,
                length: length
              };
            }
          }
        }
      }
      
      if (bestSequenceMatch) {
        const { moves, total } = bestSequenceMatch;
        predictions.rock += weights.sequence * (moves.rock / total);
        predictions.paper += weights.sequence * (moves.paper / total);
        predictions.scissor += weights.sequence * (moves.scissor / total);
      }
    }

    // 4. Cycle-based prediction
    if (enemy.detectedPatterns.cycleLength) {
      const cyclePos = (turn - 1) % enemy.detectedPatterns.cycleLength;
      const cycleTurn = cyclePos + 1;
      
      if (enemy.movesByTurn[cycleTurn]) {
        const cycleMoves = enemy.movesByTurn[cycleTurn];
        const cycleTotal = cycleMoves.rock + cycleMoves.paper + cycleMoves.scissor;
        if (cycleTotal > 0) {
          predictions.rock += weights.cyclePattern * (cycleMoves.rock / cycleTotal);
          predictions.paper += weights.cyclePattern * (cycleMoves.paper / cycleTotal);
          predictions.scissor += weights.cyclePattern * (cycleMoves.scissor / cycleTotal);
        }
      }
    }

    // 5. Stat correlation patterns
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

    // 6. NoobId patterns
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
      confidence: this.calculateEnhancedConfidence(enemy, history, turn),
      detectedPattern: this.getDetectedPatternDescription(enemy)
    };
  }

  calculateWeaponScores(predictions, weaponStats) {
    const scores = {
      rock: predictions.scissor - predictions.paper,
      paper: predictions.rock - predictions.scissor,
      scissor: predictions.paper - predictions.rock
    };

    if (weaponStats) {
      const attackWeight = 0.2;
      const maxAttack = Math.max(weaponStats.rock.attack, weaponStats.paper.attack, weaponStats.scissor.attack);
      
      if (maxAttack > 0) {
        scores.rock += attackWeight * (weaponStats.rock.attack / maxAttack);
        scores.paper += attackWeight * (weaponStats.paper.attack / maxAttack);
        scores.scissor += attackWeight * (weaponStats.scissor.attack / maxAttack);
      }
    }

    return scores;
  }

  calculateEnhancedConfidence(enemy, history, turn) {
    let confidence = 0;
    
    // Base confidence on data volume
    confidence += Math.min(enemy.totalBattles / 100, 0.2); // Up to 20% from battle count
    
    // Pattern detection confidence
    if (enemy.detectedPatterns.cycleLength) {
      confidence += 0.3; // 30% for detected cycle
    }
    
    // Sequence match confidence
    if (enemy.detectedPatterns.sequencePatterns.length > 0) {
      const bestPattern = enemy.detectedPatterns.sequencePatterns[0];
      confidence += 0.2 * bestPattern.probability; // Up to 20% for strong patterns
      
      // Bonus for longer patterns
      confidence += 0.1 * Math.min(bestPattern.length / 5, 1); // Up to 10% for long patterns
    }
    
    // Turn-based pattern confidence
    if (enemy.movesByTurn[turn]) {
      const turnMoves = enemy.movesByTurn[turn];
      const turnTotal = turnMoves.rock + turnMoves.paper + turnMoves.scissor;
      if (turnTotal >= 5) {
        const maxProb = Math.max(turnMoves.rock, turnMoves.paper, turnMoves.scissor) / turnTotal;
        if (maxProb > 0.8) {
          confidence += 0.2; // 20% for strong turn-based pattern
        }
      }
    }
    
    return Math.min(confidence, 0.95); // Cap at 95%
  }

  getDetectedPatternDescription(enemy) {
    const patterns = [];
    
    if (enemy.detectedPatterns.cycleLength) {
      patterns.push(`Cycle length: ${enemy.detectedPatterns.cycleLength}`);
    }
    
    if (enemy.detectedPatterns.sequencePatterns.length > 0) {
      const best = enemy.detectedPatterns.sequencePatterns[0];
      patterns.push(`Sequence: "${best.sequence}" → ${best.nextMove} (${(best.probability * 100).toFixed(0)}%)`);
    }
    
    if (enemy.detectedPatterns.adaptivePatterns) {
      if (enemy.detectedPatterns.adaptivePatterns.countersLast) {
        patterns.push('Counters player\'s last move');
      }
      if (enemy.detectedPatterns.adaptivePatterns.mirrorsLast) {
        patterns.push('Mirrors player\'s last move');
      }
    }
    
    return patterns.join(', ') || 'No clear pattern detected';
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
        strongestSequences: enemy.detectedPatterns.sequencePatterns || [],
        cycleLength: enemy.detectedPatterns.cycleLength,
        adaptivePatterns: enemy.detectedPatterns.adaptivePatterns,
        patternDescription: this.getDetectedPatternDescription(enemy)
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