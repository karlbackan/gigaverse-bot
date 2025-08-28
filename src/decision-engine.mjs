import { initializeFireballApi } from './api.mjs';
import { config } from './config.mjs';
import { OptimizedDatabaseStatisticsEngine } from './database-statistics-engine-optimized.mjs';
import { MLDecisionEngine } from './ml-decision-engine.mjs';
import { MLStatePersistence } from './ml-state-persistence.mjs';
import { UnifiedScoring } from './unified-scoring.mjs';
import { DefensiveMLStrategy } from './defensive-ml-strategy.mjs';
import { AdaptiveEnemyTracker } from './adaptive-enemy-tracker.mjs';
import { RobustPatternDetector } from './robust-pattern-detector.mjs';

// Game actions enum replacement
const GameAction = {
  rock: 'rock',
  paper: 'paper',
  scissor: 'scissor'
};

// Action counters (rock beats scissor, scissor beats paper, paper beats rock)
const actionWins = {
  rock: 'scissor',
  paper: 'rock',
  scissor: 'paper'
};

const actionLosses = {
  rock: 'paper',
  paper: 'scissor', 
  scissor: 'rock'
};

// Decision engine class
export class DecisionEngine {
  constructor() {
    this.enemyPatterns = new Map();
    this.turnHistory = [];
    this.dungeonHistory = [];
    this.statisticsEngine = new OptimizedDatabaseStatisticsEngine();
    this.mlEngine = new MLDecisionEngine();
    this.mlPersistence = new MLStatePersistence();
    this.currentEnemyId = null;
    this.currentNoobId = null;
    this.currentDungeonType = 1; // Default to Dungetron 5000
    
    // Performance monitoring
    this.performanceHistory = [];
    this.maxPerformanceHistory = 100;
    this.autoCorrectEnabled = true;
    this.lastPerformanceCheck = 0;
    this.performanceCheckInterval = 20; // Check every 20 battles
    
    // Load ML state asynchronously
    this.initializeMLState();
    
    // Hybrid decision mode settings
    this.hybridMode = {
      enabled: true,
      mlWeight: 0.6,        // 60% ML, 40% rule-based initially
      adaptiveWeighting: true, // adjust weights based on performance
      mlMinBattles: 5,      // minimum battles before using ML heavily
      fallbackToRules: true // fallback to rules when ML confidence is low
    };
    
    // Robustness parameters (optimized for wins > losses)
    this.params = {
      explorationRate: 0.02,       // 2% random exploration (further reduced for better performance)
      minBattlesForConfidence: 12, // Need 12 battles for full confidence (faster learning)
      lossStreakThreshold: 0.35,   // Trigger fallback if win rate < 35%
      recentWindowSize: 20,        // Look at last 20 battles for win rate
      winStreakThreshold: 0.70,    // Reduce exploration if win rate > 70% (more aggressive)
      mixedStrategyWeight: 0.5     // For game theory optimal play
    };
    
    // Track recent performance by enemy
    this.enemyRecentPerformance = new Map();
    
    // Track immediate loss streaks for tactical adaptation
    this.enemyLossStreaks = new Map(); // Track consecutive losses by enemy
    this.enemyLastMoves = new Map();   // Track what we played recently
    
    // Track battle history for adaptive enemy tracking
    this.battleHistory = new Map(); // Store battle history by enemy for adaptation analysis
    
    // Robust pattern detection system (statistically validated, not overfitted)
    this.patternDetector = new RobustPatternDetector();
    
    // Track last prediction made for recording battle results
    this.lastPrediction = null;
    this.lastPredictionEnemy = null;
    this.lastPredictionTurn = null;
    
    console.log('🎯 Decision Engine initialized with optimized parameters');
  }

  // Set current noobId for tracking time-based patterns
  setNoobId(noobId) {
    this.currentNoobId = noobId;
  }

  // Set current dungeon type for separate tracking
  setDungeonType(dungeonType) {
    this.currentDungeonType = dungeonType;
    this.statisticsEngine.setDungeonType(dungeonType);
  }

  // Initialize ML state persistence
  async initializeMLState() {
    try {
      await this.mlPersistence.loadMLState(this.mlEngine);
      console.log('🧠 ML continuity established - learning from previous sessions');
    } catch (error) {
      console.error('⚠️ Failed to load ML state, starting fresh:', error);
    }
  }
  
  // Save ML state (call this periodically and on shutdown)
  async saveMLState() {
    try {
      await this.mlPersistence.saveMLState(this.mlEngine);
    } catch (error) {
      console.error('⚠️ Failed to save ML state:', error);
    }
  }
  
  // Performance monitoring and auto-correction
  checkPerformanceAndCorrect() {
    if (this.performanceHistory.length < this.performanceCheckInterval) {
      return;
    }
    
    const recentResults = this.performanceHistory.slice(-this.performanceCheckInterval);
    const wins = recentResults.filter(r => r.result === 'win').length;
    const winRate = wins / recentResults.length;
    
    // Performance thresholds
    const criticalThreshold = 0.25;  // 25%
    const poorThreshold = 0.35;      // 35%
    const targetThreshold = 0.42;    // 42%
    
    if (winRate <= criticalThreshold && this.autoCorrectEnabled) {
      console.log(`🚨 CRITICAL PERFORMANCE: ${(winRate * 100).toFixed(1)}% win rate - applying emergency corrections`);
      
      // Emergency corrections
      this.params.explorationRate = Math.min(this.params.explorationRate + 0.05, 0.2);
      this.hybridMode.mlWeight = Math.max(this.hybridMode.mlWeight - 0.15, 0.2);
      
      console.log(`  🔧 Exploration: ${(this.params.explorationRate * 100).toFixed(1)}%`);
      console.log(`  🔧 ML Weight: ${(this.hybridMode.mlWeight * 100).toFixed(0)}%`);
      
    } else if (winRate <= poorThreshold && this.autoCorrectEnabled) {
      console.log(`⚠️ POOR PERFORMANCE: ${(winRate * 100).toFixed(1)}% win rate - applying corrections`);
      
      // Moderate corrections
      this.params.explorationRate = Math.min(this.params.explorationRate + 0.02, 0.15);
      console.log(`  🔧 Increased exploration to ${(this.params.explorationRate * 100).toFixed(1)}%`);
      
    } else if (winRate >= targetThreshold) {
      console.log(`✅ GOOD PERFORMANCE: ${(winRate * 100).toFixed(1)}% win rate - optimizing`);
      
      // Optimize by reducing exploration
      this.params.explorationRate = Math.max(this.params.explorationRate - 0.01, 0.005);
      console.log(`  🔧 Reduced exploration to ${(this.params.explorationRate * 100).toFixed(1)}%`);
    }
  }
  
  // Record performance for monitoring
  recordPerformance(result, enemyId, turn) {
    this.performanceHistory.push({
      result,
      enemyId,
      turn,
      timestamp: Date.now()
    });
    
    // Trim history
    if (this.performanceHistory.length > this.maxPerformanceHistory) {
      this.performanceHistory.shift();
    }
    
    // Check performance periodically
    if (this.performanceHistory.length % this.performanceCheckInterval === 0) {
      this.checkPerformanceAndCorrect();
      
      // Save ML state periodically
      if (this.performanceHistory.length % 50 === 0) {
        this.saveMLState();
      }
    }
  }

  // Make decision based on all available data
  async makeDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons = null, weaponCharges = null, playerStats = null, enemyStats = null) {
    if (config.debug) {
      console.log(`Making decision for enemy ${enemyId}, turn ${turn}`);
    }

    this.currentEnemyId = enemyId;
    
    // HYBRID DECISION SYSTEM: Try ML first, fallback to rule-based
    if (this.hybridMode.enabled) {
      const mlDecision = await this.tryMLDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons, weaponCharges, playerStats, enemyStats);
      
      if (mlDecision) {
        // ML made a confident decision
        return mlDecision.action;
      }
      
      // ML not confident or not enough data, use rule-based system
      if (!config.minimalOutput) {
        console.log('🔄 ML not confident, falling back to rule-based system');
      }
    }

    // Prepare player and enemy stats for analysis
    const processedPlayerStats = {
      health: playerHealth,
      healthPercent: playerStats?.healthPercent || (playerHealth / (playerStats?.maxHealth || 100)) * 100,
      shield: playerStats?.shield || 0,
      shieldPercent: playerStats?.shieldPercent || 0
    };

    const processedEnemyStats = {
      health: enemyHealth,
      healthPercent: enemyStats?.healthPercent || (enemyHealth / (enemyStats?.maxHealth || 100)) * 100,
      shield: enemyStats?.shield || 0,
      shieldPercent: enemyStats?.shieldPercent || 0,
      charges: enemyStats?.charges || null  // Include charge data!
    };

    // Prepare weapon stats
    const weaponStats = {
      rock: { attack: 0, defense: 0, charges: weaponCharges?.rock || 0 },
      paper: { attack: 0, defense: 0, charges: weaponCharges?.paper || 0 },
      scissor: { attack: 0, defense: 0, charges: weaponCharges?.scissor || 0 }
    };

    // Get weapon stats from player data if available
    if (playerStats?.weapons) {
      weaponStats.rock.attack = playerStats.weapons.rock?.attack || 0;
      weaponStats.rock.defense = playerStats.weapons.rock?.defense || 0;
      weaponStats.paper.attack = playerStats.weapons.paper?.attack || 0;
      weaponStats.paper.defense = playerStats.weapons.paper?.defense || 0;
      weaponStats.scissor.attack = playerStats.weapons.scissor?.attack || 0;
      weaponStats.scissor.defense = playerStats.weapons.scissor?.defense || 0;
    }

    // CRITICAL: Track enemy charges to eliminate impossible moves
    let enemyPossibleMoves = ['rock', 'paper', 'scissor'];
    if (processedEnemyStats.charges) {
      enemyPossibleMoves = [];
      // In Underhaul, negative charges mean recharging (cannot use)
      // 0 or positive means can use
      if (processedEnemyStats.charges.rock >= 0) enemyPossibleMoves.push('rock');
      if (processedEnemyStats.charges.paper >= 0) enemyPossibleMoves.push('paper');
      if (processedEnemyStats.charges.scissor >= 0) enemyPossibleMoves.push('scissor');
      
      // Log when enemy options are limited
      if (enemyPossibleMoves.length < 3) {
        if (!config.minimalOutput) {
          // Show charges with recharging state
          const formatCharge = (c) => c < 0 ? `${c}/3 (recharging)` : `${c}/3`;
          console.log(`🎯 Enemy limited to: ${enemyPossibleMoves.join(', ')} (charges: R${formatCharge(processedEnemyStats.charges.rock)}, P${formatCharge(processedEnemyStats.charges.paper)}, S${formatCharge(processedEnemyStats.charges.scissor)})`);
        }
        
        // Force high confidence when only 1-2 options
        if (enemyPossibleMoves.length === 1) {
          console.log(`💯 Enemy can ONLY play ${enemyPossibleMoves[0]}!`);
        }
      }
    }

    // Get prediction from statistics engine
    const prediction = await this.statisticsEngine.predictNextMove(
      enemyId,
      turn,
      processedPlayerStats,
      processedEnemyStats,
      weaponStats,
      this.currentNoobId,
      enemyPossibleMoves  // Pass possible moves to filter predictions
    );
    
    // ADAPTIVE TRACKING: Analyze if enemy is adapting/changing strategy
    const battleHistory = this.battleHistory.get(enemyId) || [];
    if (battleHistory.length >= 10) {
      const recentMoves = battleHistory.slice(-20).map(b => ({
        move: b.enemyMove,
        turn: b.turn,
        result: b.result,
        ourMove: b.ourMove
      }));
      const historicalMoves = battleHistory.slice(0, -20).map(b => ({
        move: b.enemyMove,
        turn: b.turn,
        result: b.result,
        ourMove: b.ourMove
      }));
      
      const adaptationAnalysis = AdaptiveEnemyTracker.analyzeAdaptation(recentMoves, historicalMoves);
      
      // If enemy is adapting quickly, use trend prediction instead of historical ML
      if (adaptationAnalysis.adaptationSpeed > 0.5 && adaptationAnalysis.confidence > 0.6) {
        const trendPrediction = AdaptiveEnemyTracker.getAdaptiveCounter(adaptationAnalysis);
        
        // Override ML prediction with trend-based prediction
        prediction.predictions = trendPrediction;
        prediction.method = `adaptive_${adaptationAnalysis.adaptationType}`;
        prediction.confidence = adaptationAnalysis.confidence;
        
        console.log(`🔄 Enemy adapting ${adaptationAnalysis.adaptationType} (speed: ${(adaptationAnalysis.adaptationSpeed*100).toFixed(0)}%) - using trend prediction`);
        console.log(`📈 Momentum: ${adaptationAnalysis.evolving.direction}`);
      }
    }
    
    // PATTERN DETECTION: Use enhanced pattern detector for enemy classification
    const enemyProfile = this.patternDetector.analyzeEnemy(enemyId, battleHistory);
    
    // Check for exploitable patterns (fixed, counter, copier)
    if (enemyProfile.type !== 'unknown' && enemyProfile.confidence > 0.7) {
      console.log(`🎯 Enemy pattern detected: ${enemyProfile.type} - ${enemyProfile.description}`);
      
      // Get optimal counter move
      const lastBattle = battleHistory.length > 0 ? battleHistory[battleHistory.length - 1] : null;
      const optimalMove = this.patternDetector.getOptimalMove(
        enemyId,
        lastBattle?.ourMove,
        lastBattle?.enemyMove,
        lastBattle?.result,
        availableWeapons || ['rock', 'paper', 'scissor']
      );
      
      // If we have a high-confidence exploit, use it
      if (enemyProfile.type === 'fixed' && enemyProfile.confidence === 1.0) {
        console.log(`💯 GUARANTEED WIN! Enemy only plays ${enemyProfile.dominantMove || 'one move'}!`);
        if (availableWeapons.includes(optimalMove)) {
          return optimalMove;
        }
      } else if (enemyProfile.confidence > 0.8 && availableWeapons.includes(optimalMove)) {
        console.log(`🎯 High confidence exploit: Playing ${optimalMove}`);
        return optimalMove;
      }
    }
    
    // Store prediction for later recording in battle results
    this.lastPrediction = prediction;
    this.lastPredictionEnemy = enemyId;
    this.lastPredictionTurn = turn;
    
    // Check recent performance for this enemy
    const recentPerformance = this.getRecentPerformance(enemyId);
    const isLosingStreak = recentPerformance.winRate < this.params.lossStreakThreshold;
    
    // DEBUG: Log available weapons when prediction is made
    if (!config.minimalOutput && enemyPossibleMoves.length < 3) {
      const availableList = availableWeapons || ['rock', 'paper', 'scissor'];
      const chargedWeapons = availableList.filter(w => !weaponCharges || weaponCharges[w] > 0);
      console.log(`🎮 Available weapons: ${chargedWeapons.join(', ')} (charges: R:${weaponCharges?.rock||'?'} P:${weaponCharges?.paper||'?'} S:${weaponCharges?.scissor||'?'})`);
    }
    const isWinningStreak = recentPerformance.winRate > this.params.winStreakThreshold;
    
    // CRITICAL: Check for immediate consecutive losses (being actively countered)
    const consecutiveLosses = this.getConsecutiveLosses(enemyId);
    const isBeingCountered = consecutiveLosses >= 2; // 2+ losses = likely being countered
    const isHardCountered = consecutiveLosses >= 3;  // 3+ losses = definitely being countered
    
    // Apply confidence scaling based on battle count
    const battleCount = await this.statisticsEngine.getBattleCount(enemyId);
    const confidenceMultiplier = Math.min(1, battleCount / this.params.minBattlesForConfidence);
    
    // CRITICAL: Check if enemy has only one possible move - NEVER explore in this case!
    if (enemyPossibleMoves && enemyPossibleMoves.length === 1) {
      const onlyMove = enemyPossibleMoves[0];
      const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
      const guaranteed = counters[onlyMove];
      
      if (availableWeapons.includes(guaranteed)) {
        if (!config.minimalOutput) {
          console.log(`💯 Guaranteed win! Enemy can only play ${onlyMove}, countering with ${guaranteed}`);
        }
        return guaranteed;
      }
    }
    
    // CRITICAL: Anti-Counter Strategy - React to consecutive losses immediately!
    if (isHardCountered) {
      // 3+ losses in a row = enemy has figured us out completely
      console.log(`🚨 HARD COUNTERED! ${consecutiveLosses} losses in a row - switching to chaos mode`);
      
      // Abandon all patterns, go pure random for unpredictability
      const availableWeaponList = availableWeapons || ['rock', 'paper', 'scissor'];
      const randomChoice = availableWeaponList[Math.floor(Math.random() * availableWeaponList.length)];
      
      if (!config.minimalOutput) {
        console.log(`💀 Enemy cracked our code - going random: ${randomChoice}`);
      } else {
        console.log(`Counter-Counter: Random ${randomChoice}`);
      }
      
      return randomChoice;
      
    } else if (isBeingCountered) {
      // 2 losses in a row = likely being countered, try reverse psychology
      console.log(`⚠️ BEING COUNTERED! ${consecutiveLosses} losses in a row - trying reverse psychology`);
      
      const ourRecentMoves = this.getRecentMoves(enemyId, 3); // Our last 3 moves
      if (ourRecentMoves && ourRecentMoves.length > 0) {
        // What would they expect us to do? (continue our pattern)
        // Let's do something different
        const allMoves = ['rock', 'paper', 'scissor'];
        const unexpectedMoves = allMoves.filter(move => 
          !ourRecentMoves.includes(move) && (!availableWeapons || availableWeapons.includes(move))
        );
        
        if (unexpectedMoves.length > 0) {
          const surpriseMove = unexpectedMoves[Math.floor(Math.random() * unexpectedMoves.length)];
          
          if (!config.minimalOutput) {
            console.log(`🎭 Reverse psychology: they expect ${ourRecentMoves.join('/')} pattern, playing ${surpriseMove}`);
          } else {
            console.log(`Reverse: ${surpriseMove} (vs ${ourRecentMoves.join('/')})`);
          }
          
          return surpriseMove;
        }
      }
      
      // Fallback: increase randomization heavily
      if (Math.random() < 0.7) { // 70% random when being countered
        const availableWeaponList = availableWeapons || ['rock', 'paper', 'scissor'];
        const randomChoice = availableWeaponList[Math.floor(Math.random() * availableWeaponList.length)];
        
        if (!config.minimalOutput) {
          console.log(`🎲 Counter-strategy: going 70% random - ${randomChoice}`);
        } else {
          console.log(`Counter: Random ${randomChoice}`);
        }
        
        return randomChoice;
      }
    }
    
    // Determine exploration rate based on performance and battle count  
    let effectiveExplorationRate = this.params.explorationRate;
    
    // Adaptive exploration: reduce as we learn more about this enemy
    if (battleCount > 30) {
      effectiveExplorationRate *= 0.3; // Very low exploration for well-known enemies
    } else if (battleCount > this.params.minBattlesForConfidence) {
      effectiveExplorationRate *= 0.5; // Reduced exploration for known enemies
    }
    
    if (isWinningStreak && battleCount > this.params.minBattlesForConfidence) {
      effectiveExplorationRate *= 0.2; // Much less exploration when winning
    } else if (isLosingStreak) {
      effectiveExplorationRate *= 1.5; // Increase exploration when losing
    }
    
    // Reduce exploration when enemy has limited options
    if (enemyPossibleMoves && enemyPossibleMoves.length === 2) {
      effectiveExplorationRate *= 0.5; // Half exploration rate for 50/50 situations
    }
    
    // Apply epsilon-greedy exploration
    if (Math.random() < effectiveExplorationRate) {
      if (!config.minimalOutput) {
        console.log(`Exploring (${(effectiveExplorationRate * 100).toFixed(0)}% rate)`);
      } else {
        console.log('Explore');
      }
      // Smart exploration: only explore moves that counter possible enemy moves
      return this.getSmartExplorationMove(availableWeapons, enemyPossibleMoves);
    }

    // Check if predictions are meaningful (not all zeros after filtering)
    const hasValidPredictions = prediction && 
      (prediction.predictions.rock > 0 || prediction.predictions.paper > 0 || prediction.predictions.scissor > 0);
    
    // UNIFIED SCORING SYSTEM - Always considers both winning and surviving
    if (hasValidPredictions) {
      const scaledConfidence = prediction.confidence * confidenceMultiplier;
      const healthRatio = playerHealth / (playerHealth + enemyHealth);
      
      // Get adaptive weights based on game state
      let weights;
      if (processedEnemyStats?.weapons && processedPlayerStats) {
        // Use threat-based weights when we have enemy weapon stats
        weights = UnifiedScoring.getThreatBasedWeights(
          processedPlayerStats,
          processedEnemyStats,
          prediction.predictions
        );
      } else {
        // Fallback to simple health-based weights
        weights = UnifiedScoring.getAdaptiveWeights(healthRatio, turn, scaledConfidence);
      }
      
      // DEFENSIVE STRATEGY: When ML confidence is low, play defensively
      let scoringResult;
      const defensiveCheck = DefensiveMLStrategy.calculateDefensiveMove(
        prediction.predictions, 
        weights,
        availableWeapons,
        scaledConfidence
      );
      
      if (defensiveCheck) {
        // Use defensive play when confidence is too low
        scoringResult = defensiveCheck;
        console.log(`🛡️ ${defensiveCheck.reasoning}`);
      } else {
        // Normal unified scoring when confidence is acceptable
        scoringResult = UnifiedScoring.calculateUnifiedScores(
          prediction.predictions, 
          weights,
          availableWeapons,
          weaponCharges
        );
      }
      
      // Best move is now guaranteed to be available
      if (scoringResult.bestMove) {
        
        if (config.minimalOutput) {
          console.log(`U:${scoringResult.bestMove} EV:${scoringResult.expectedValue.toFixed(2)}`);
        } else {
          console.log(scoringResult.reasoning);
        }
        return scoringResult.bestMove;
      }
    }
    
    // If we have a prediction with scaled confidence and valid predictions (fallback to old logic)
    if (hasValidPredictions && prediction.confidence * confidenceMultiplier > 0.3) {
      const scaledConfidence = prediction.confidence * confidenceMultiplier;
      
      if (config.minimalOutput) {
        // Minimal output: Conf% R/P/S probabilities
        const r = (prediction.predictions.rock * 100).toFixed(0);
        const p = (prediction.predictions.paper * 100).toFixed(0);
        const s = (prediction.predictions.scissor * 100).toFixed(0);
        console.log(`Conf:${(scaledConfidence * 100).toFixed(0)}% R${r}/P${p}/S${s}`);
      } else {
        console.log('Using statistical prediction');
        console.log(`  Raw confidence: ${prediction.confidence.toFixed(2)}, Scaled: ${scaledConfidence.toFixed(2)}`);
        console.log(`  Battle count: ${battleCount}, Win rate: ${(recentPerformance.winRate * 100).toFixed(0)}%`);
        console.log('Enemy move predictions:', {
          rock: prediction.predictions.rock.toFixed(3),
          paper: prediction.predictions.paper.toFixed(3),
          scissor: prediction.predictions.scissor.toFixed(3)
        });
        if (prediction.possibleMoves && prediction.possibleMoves.length < 3) {
          console.log(`  (Filtered to possible moves: ${prediction.possibleMoves.join(', ')})`);
        }
        console.log('Weapon scores:', {
          rock: prediction.weaponScores.rock.toFixed(3),
          paper: prediction.weaponScores.paper.toFixed(3),
          scissor: prediction.weaponScores.scissor.toFixed(3)
        });
      }
      
      // Handle losing streak - use fallback strategy
      if (isLosingStreak) {
        if (!config.minimalOutput) {
          console.log('Losing streak detected - using counter to favorite move');
        }
        const favoriteMove = this.getFavoriteEnemyMove(enemyId);
        if (favoriteMove) {
          const counter = actionLosses[favoriteMove]; // What beats their favorite
          if ((!availableWeapons || availableWeapons.includes(counter)) && weaponCharges[counter] > 0) {
            return counter;
          }
        }
      }

      // AGGRESSIVE OPTIMAL DECISION LOGIC (optimized for wins > losses)
      // Find the highest scoring available weapon
      let bestWeapon = null;
      let bestScore = -1;
      
      for (const [weapon, score] of Object.entries(prediction.weaponScores)) {
        if ((!availableWeapons || availableWeapons.includes(weapon)) && weaponCharges[weapon] > 0) {
          if (score > bestScore) {
            bestScore = score;
            bestWeapon = weapon;
          }
        }
      }
      
      if (bestWeapon && bestScore > 0) {
        // Aggressive confidence thresholds for better performance
        const highConfidenceThreshold = 0.5;  // Lowered from 0.7
        const mediumConfidenceThreshold = 0.25; // New threshold
        
        if (scaledConfidence > highConfidenceThreshold) {
          // High confidence: always pick the best weapon
          if (!config.minimalOutput) {
            console.log(`High confidence (${(scaledConfidence * 100).toFixed(0)}%): choosing best weapon ${bestWeapon} (score: ${bestScore.toFixed(3)})`);
          }
          return bestWeapon;
        } else if (scaledConfidence > mediumConfidenceThreshold) {
          // Medium confidence: 95% best weapon, 5% random (much more aggressive)
          if (Math.random() < 0.95) {
            if (!config.minimalOutput) {
              console.log(`Medium confidence (${(scaledConfidence * 100).toFixed(0)}%): choosing best weapon ${bestWeapon} (score: ${bestScore.toFixed(3)})`);
            }
            return bestWeapon;
          } else {
            // 5% chance of selecting second-best weapon for unpredictability
            const sortedWeapons = Object.entries(prediction.weaponScores)
              .filter(([weapon, score]) => 
                (!availableWeapons || availableWeapons.includes(weapon)) && weaponCharges[weapon] > 0
              )
              .sort(([,a], [,b]) => b - a);
            
            const secondBest = sortedWeapons.length > 1 ? sortedWeapons[1][0] : bestWeapon;
            if (!config.minimalOutput) {
              console.log(`Medium confidence (${(scaledConfidence * 100).toFixed(0)}%): tactical variation chose ${secondBest}`);
            }
            return secondBest;
          }
        } else {
          // Low confidence: still favor best weapon 70% of the time
          if (Math.random() < 0.7) {
            if (!config.minimalOutput) {
              console.log(`Low confidence (${(scaledConfidence * 100).toFixed(0)}%): cautiously choosing best weapon ${bestWeapon}`);
            }
            return bestWeapon;
          }
          // 30% fallback to enhanced random strategy below
        }
      }
    } else if (prediction && config.minimalOutput) {
      console.log(`Conf:${(prediction.confidence * 100).toFixed(0)}% (low)`);
    } else if (prediction && !config.minimalOutput) {
      console.log('Low confidence prediction:', prediction.confidence.toFixed(2));
    }

    // Fallback to enhanced random strategy with statistical hints
    if (!config.minimalOutput) {
      console.log('Using enhanced random strategy with statistical hints');
    } else if (!prediction) {
      console.log('No data');
    }
    
    // Create weights based on weapon stats, charges, and any statistical hints
    let weights = { rock: 1, paper: 1, scissor: 1 };
    
    // If we have a weak prediction, still use it as a hint (even if confidence is low)
    if (prediction && prediction.weaponScores) {
      const maxScore = Math.max(...Object.values(prediction.weaponScores));
      if (maxScore > 0) {
        // Check if we have a clear best choice (deterministic selection)
        const bestWeapons = [];
        for (const [weapon, score] of Object.entries(prediction.weaponScores)) {
          if (score === maxScore && maxScore > 0.5) { // Clear preference
            bestWeapons.push(weapon);
          }
        }
        
        // If we have a single clear best choice, use it deterministically
        if (bestWeapons.length === 1 && maxScore > 0.7) {
          const bestWeapon = bestWeapons[0];
          if ((!availableWeapons || availableWeapons.includes(bestWeapon)) && 
              (!weaponCharges || weaponCharges[bestWeapon] > 0)) {
            if (!config.minimalOutput) {
              console.log(`🎯 Clear weapon preference: ${bestWeapon} (score: ${maxScore.toFixed(2)})`);
            }
            return bestWeapon;
          }
        }
        
        // Otherwise apply statistical hints as weight multipliers
        weights.rock *= (1 + 1.5 * (prediction.weaponScores.rock / maxScore)); // Increased from 0.5
        weights.paper *= (1 + 1.5 * (prediction.weaponScores.paper / maxScore));
        weights.scissor *= (1 + 1.5 * (prediction.weaponScores.scissor / maxScore));
      }
    }
    
    // Apply charge-based adjustments
    if (weaponCharges) {
      const maxCharges = Math.max(weaponCharges.rock || 0, weaponCharges.paper || 0, weaponCharges.scissor || 0);
      if (maxCharges > 0) {
        // Prefer weapons with more charges
        if (weaponCharges.rock > 0) {
          weights.rock *= (1 + 0.2 * (weaponCharges.rock / maxCharges));
        }
        if (weaponCharges.paper > 0) {
          weights.paper *= (1 + 0.2 * (weaponCharges.paper / maxCharges));
        }
        if (weaponCharges.scissor > 0) {
          weights.scissor *= (1 + 0.2 * (weaponCharges.scissor / maxCharges));
        }
      }
    }

    // Apply attack stat weighting
    if (weaponStats) {
      const maxAttack = Math.max(
        weaponStats.rock.attack,
        weaponStats.paper.attack,
        weaponStats.scissor.attack
      );
      
      if (maxAttack > 0) {
        // Give up to 30% bonus for attack stats
        weights.rock *= (1 + 0.3 * (weaponStats.rock.attack / maxAttack));
        weights.paper *= (1 + 0.3 * (weaponStats.paper.attack / maxAttack));
        weights.scissor *= (1 + 0.3 * (weaponStats.scissor.attack / maxAttack));
      }
    }

    // Apply health-based strategy adjustments
    const healthRatio = playerHealth / (playerHealth + enemyHealth);
    if (healthRatio < 0.3) {
      // Low health - slightly prefer defensive play (paper)
      weights.paper *= 1.2;
    } else if (healthRatio > 0.7) {
      // High health - slightly prefer aggressive play
      weights.rock *= 1.1;
      weights.scissor *= 1.1;
    }
    
    // CRITICAL: Apply smart weighting based on what enemy CAN play
    if (enemyPossibleMoves && enemyPossibleMoves.length < 3) {
      // Reduce weight of moves that only counter what enemy CAN'T play
      const enemyImpossible = ['rock', 'paper', 'scissor'].filter(m => !enemyPossibleMoves.includes(m));
      
      for (const impossible of enemyImpossible) {
        // What counters this impossible move?
        const uselessCounter = actionLosses[impossible];
        // Reduce its weight significantly
        weights[uselessCounter] *= 0.1;
        
        if (!config.minimalOutput) {
          console.log(`  Reducing ${uselessCounter} weight (only counters ${impossible} which enemy can't play)`);
        }
      }
    }

    if (config.debug) {
      console.log('Fallback weights:', weights);
    }

    return this.getWeightedRandomAction(weights, availableWeapons);
  }
  
  // Try ML decision first in hybrid mode
  async tryMLDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons, weaponCharges, playerStats, enemyStats) {
    try {
      // Check if we have enough data for ML to be effective
      const battleCount = await this.statisticsEngine.getBattleCount(enemyId);
      
      if (battleCount < this.hybridMode.mlMinBattles && this.hybridMode.fallbackToRules) {
        if (!config.minimalOutput) {
          console.log(`🤖 ML needs more data (${battleCount}/${this.hybridMode.mlMinBattles} battles)`);
        }
        return null; // Not enough data, use rule-based
      }
      
      // Get recent game history for ML context
      const gameHistory = this.getRecentGameHistory(enemyId);
      
      // Get ML decision
      const mlResult = await this.mlEngine.makeMLDecision(
        enemyId, turn, playerHealth, enemyHealth, 
        availableWeapons, weaponCharges, playerStats, enemyStats,
        gameHistory
      );
      
      if (!mlResult) return null;
      
      // Check confidence threshold
      const minConfidence = this.getMLConfidenceThreshold(enemyId, battleCount);
      
      if (mlResult.confidence < minConfidence) {
        if (!config.minimalOutput) {
          console.log(`🤖 ML confidence too low: ${(mlResult.confidence * 100).toFixed(0)}% < ${(minConfidence * 100).toFixed(0)}%`);
        }
        return null; // Low confidence, use rule-based
      }
      
      // ML is confident, use its decision
      this.lastMLDecision = mlResult;
      return mlResult;
      
    } catch (error) {
      console.error('❌ ML Decision Error:', error.message);
      return null; // Error, fallback to rule-based
    }
  }
  
  // Get confidence threshold based on enemy and battle count
  getMLConfidenceThreshold(enemyId, battleCount) {
    // Start with high threshold, lower it as we have more data
    let baseThreshold = 0.6;
    
    // Reduce threshold as we learn more about this enemy
    const dataFactor = Math.min(1, battleCount / 30); // max reduction after 30 battles
    baseThreshold *= (1 - dataFactor * 0.3); // can reduce by up to 30%
    
    return Math.max(0.3, baseThreshold); // minimum 30% confidence required
  }
  
  // Get recent game history for ML context
  getRecentGameHistory(enemyId) {
    return this.turnHistory
      .filter(turn => turn.enemyId === enemyId)
      .slice(-20) // last 20 turns with this enemy
      .map(turn => ({
        playerAction: turn.playerAction,
        enemyAction: turn.enemyAction,
        result: turn.result,
        turn: turn.turn
      }));
  }

  // Get random action
  getRandomAction(availableWeapons = null) {
    const actions = availableWeapons || Object.values(GameAction);
    return actions[Math.floor(Math.random() * actions.length)];
  }

  // Get weighted random action
  getWeightedRandomAction(weights, availableWeapons = null) {
    // Filter weights to only include available weapons
    let filteredWeights = weights;
    if (availableWeapons) {
      filteredWeights = {};
      for (const weapon of availableWeapons) {
        if (weights[weapon] !== undefined) {
          filteredWeights[weapon] = weights[weapon];
        }
      }
      
      // If no weights match available weapons, use equal weights
      if (Object.keys(filteredWeights).length === 0) {
        for (const weapon of availableWeapons) {
          filteredWeights[weapon] = 1;
        }
      }
    }
    
    const total = Object.values(filteredWeights).reduce((sum, weight) => sum + weight, 0);
    
    if (total === 0) {
      return this.getRandomAction(availableWeapons);
    }
    
    let random = Math.random() * total;

    for (const [action, weight] of Object.entries(filteredWeights)) {
      random -= weight;
      if (random <= 0) {
        return action;
      }
    }

    return this.getRandomAction(availableWeapons);
  }

  // Record turn result for learning
  async recordTurn(enemyId, turn, playerAction, enemyAction, result, playerStats = null, enemyStats = null, weaponStats = null) {
    // Record performance for monitoring and auto-correction
    this.recordPerformance(result, enemyId, turn);
    
    this.turnHistory.push({
      enemyId,
      turn,
      playerAction,
      enemyAction,
      result,
      timestamp: Date.now()
    });

    // Keep only last 1000 turns
    if (this.turnHistory.length > 1000) {
      this.turnHistory.shift();
    }
    
    // Update recent performance tracking
    this.updateRecentPerformance(enemyId, result);
    
    // Update battle history for adaptive enemy tracking
    if (!this.battleHistory.has(enemyId)) {
      this.battleHistory.set(enemyId, []);
    }
    this.battleHistory.get(enemyId).push({
      turn,
      enemyMove: enemyAction,
      ourMove: playerAction,
      result,
      timestamp: Date.now()
    });
    
    // Keep only last 100 battles per enemy for memory efficiency
    const history = this.battleHistory.get(enemyId);
    if (history.length > 100) {
      history.shift();
    }
    
    // Update loss streak tracking for anti-counter strategy
    this.updateLossStreak(enemyId, result, playerAction);
    
    // Update ML engine with battle outcome
    if (this.lastMLDecision && this.hybridMode.enabled) {
      try {
        const gameHistory = this.getRecentGameHistory(enemyId);
        const features = this.extractMLFeatures(enemyId, turn, playerStats, enemyStats, gameHistory);
        
        this.mlEngine.learnFromOutcome(
          enemyId, 
          playerAction, 
          enemyAction, 
          result, 
          this.lastMLDecision.strategy, 
          features, 
          turn
        );
        
        // Clear the stored ML decision
        this.lastMLDecision = null;
        
      } catch (error) {
        console.error('❌ ML Learning Error:', error.message);
      }
    }

    // Determine if prediction was correct and extract confidence
    let predictionMade = null;
    let predictionCorrect = false;
    let confidenceLevel = null;
    
    if (this.lastPrediction && 
        this.lastPredictionEnemy === enemyId && 
        this.lastPredictionTurn === turn) {
      
      // Find the predicted move (highest probability)
      const predictions = this.lastPrediction.predictions;
      let bestMove = null;
      let bestProb = 0;
      
      for (const [move, prob] of Object.entries(predictions)) {
        if (prob > bestProb) {
          bestProb = prob;
          bestMove = move;
        }
      }
      
      predictionMade = bestMove;
      predictionCorrect = bestMove === enemyAction;
      confidenceLevel = this.lastPrediction.confidence;
      
      // Clear the stored prediction
      this.lastPrediction = null;
      this.lastPredictionEnemy = null;
      this.lastPredictionTurn = null;
    }

    // Record to statistics engine
    await this.statisticsEngine.recordBattle({
      enemyId,
      turn,
      playerAction,
      enemyAction,
      result,
      playerStats,
      enemyStats,
      weaponStats,
      noobId: this.currentNoobId,
      dungeonType: this.currentDungeonType,
      timestamp: Date.now(),
      predictionMade,
      predictionCorrect,
      confidenceLevel
    });
  }

  // Smart exploration: only explore moves that counter possible enemy moves
  getSmartExplorationMove(availableWeapons, enemyPossibleMoves) {
    if (!enemyPossibleMoves || enemyPossibleMoves.length === 3) {
      // All moves possible, use normal random
      return this.getRandomAction(availableWeapons);
    }
    
    // Determine which of our moves are useful (counter what enemy CAN play)
    const usefulMoves = new Set();
    
    // For each possible enemy move, add the counter to useful moves
    for (const enemyMove of enemyPossibleMoves) {
      const counter = actionLosses[enemyMove]; // What beats this enemy move
      if (availableWeapons.includes(counter)) {
        usefulMoves.add(counter);
      }
    }
    
    // Convert to array
    const usefulArray = Array.from(usefulMoves);
    
    if (config.debug || !config.minimalOutput) {
      console.log(`  Smart exploration: Enemy can play ${enemyPossibleMoves.join('/')}, useful moves: ${usefulArray.join('/')}`);
      
      // Show what we're excluding
      const excluded = availableWeapons.filter(w => !usefulArray.includes(w));
      if (excluded.length > 0) {
        const enemyCantPlay = ['rock', 'paper', 'scissor'].filter(m => !enemyPossibleMoves.includes(m));
        console.log(`  Excluding ${excluded.join('/')} (only counters ${enemyCantPlay.join('/')} which enemy can't play)`);
      }
    }
    
    // Pick randomly from useful moves
    return usefulArray[Math.floor(Math.random() * usefulArray.length)] || this.getRandomAction(availableWeapons);
  }

  // Get statistics summary
  getStatsSummary() {
    const summary = {
      enemiesAnalyzed: this.enemyPatterns.size,
      turnsRecorded: this.turnHistory.length,
      recentWinRate: 0,
      statisticsReport: null
    };

    if (this.turnHistory.length > 0) {
      const recentTurns = this.turnHistory.slice(-100);
      const wins = recentTurns.filter(turn => turn.result === 'win').length;
      summary.recentWinRate = wins / recentTurns.length;
    }

    // Get report from statistics engine
    if (this.currentEnemyId) {
      summary.statisticsReport = this.statisticsEngine.getAnalysisReport(this.currentEnemyId);
    }

    return summary;
  }

  // Get full analysis report
  getFullAnalysisReport() {
    return this.statisticsEngine.getAnalysisReport();
  }

  // Export statistics data
  exportStatistics() {
    this.statisticsEngine.saveData();
    console.log('Statistics data exported');
  }
  
  // Get recent performance for an enemy
  getRecentPerformance(enemyId) {
    const recent = this.enemyRecentPerformance.get(enemyId) || { wins: 0, total: 0 };
    return {
      winRate: recent.total > 0 ? recent.wins / recent.total : 0.5,
      battleCount: recent.total
    };
  }
  
  // Get favorite enemy move
  getFavoriteEnemyMove(enemyId) {
    const dungeonStats = this.statisticsEngine.enemyStats[this.currentDungeonType];
    if (!dungeonStats) return null;
    
    const enemy = dungeonStats.get(enemyId);
    if (!enemy) return null;
    
    const moves = enemy.moves;
    let favorite = null;
    let maxCount = 0;
    
    for (const [move, count] of Object.entries(moves)) {
      if (count > maxCount) {
        maxCount = count;
        favorite = move;
      }
    }
    
    return favorite;
  }
  
  // Select from probability distribution
  selectFromProbabilities(probabilities) {
    const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
    if (total === 0) return null;
    
    let random = Math.random() * total;
    for (const [option, probability] of Object.entries(probabilities)) {
      random -= probability;
      if (random <= 0) {
        return option;
      }
    }
    
    // Fallback (shouldn't reach here)
    return Object.keys(probabilities)[0];
  }
  
  // Update recent performance tracking
  updateRecentPerformance(enemyId, result) {
    if (!this.enemyRecentPerformance.has(enemyId)) {
      this.enemyRecentPerformance.set(enemyId, { wins: 0, total: 0, history: [] });
    }
    
    const perf = this.enemyRecentPerformance.get(enemyId);
    perf.history.push(result === 'win' ? 1 : 0);
    
    // Keep only recent window
    if (perf.history.length > this.params.recentWindowSize) {
      perf.history.shift();
    }
    
    // Recalculate stats
    perf.total = perf.history.length;
    perf.wins = perf.history.filter(r => r === 1).length;
  }
  
  // Track consecutive losses for anti-counter strategy
  updateLossStreak(enemyId, result, playerMove) {
    if (!this.enemyLossStreaks.has(enemyId)) {
      this.enemyLossStreaks.set(enemyId, { consecutiveLosses: 0, lastResults: [] });
    }
    
    if (!this.enemyLastMoves.has(enemyId)) {
      this.enemyLastMoves.set(enemyId, []);
    }
    
    const streak = this.enemyLossStreaks.get(enemyId);
    const moves = this.enemyLastMoves.get(enemyId);
    
    // Track our move
    moves.push(playerMove);
    if (moves.length > 5) moves.shift(); // Keep last 5 moves
    
    // Track result streak
    streak.lastResults.push(result);
    if (streak.lastResults.length > 10) streak.lastResults.shift(); // Keep last 10 results
    
    if (result === 'loss') {
      streak.consecutiveLosses++;
    } else {
      streak.consecutiveLosses = 0; // Reset on non-loss
    }
  }
  
  // Get consecutive losses against specific enemy
  getConsecutiveLosses(enemyId) {
    const streak = this.enemyLossStreaks.get(enemyId);
    return streak ? streak.consecutiveLosses : 0;
  }
  
  // Get our recent moves against specific enemy
  getRecentMoves(enemyId, count = 3) {
    const moves = this.enemyLastMoves.get(enemyId);
    if (!moves || moves.length === 0) return null;
    return moves.slice(-count);
  }
  
  // Extract features for ML engine
  extractMLFeatures(enemyId, turn, playerStats, enemyStats, gameHistory) {
    // Create comprehensive feature set for ML
    const recentPerformance = this.getRecentPerformance(enemyId);
    const consecutiveLosses = this.getConsecutiveLosses(enemyId);
    const recentMoves = this.getRecentMoves(enemyId, 5) || [];
    
    return [
      turn / 100,                                    // normalized turn number
      (playerStats?.health || 50) / 100,            // normalized player health
      (enemyStats?.health || 50) / 100,             // normalized enemy health
      recentPerformance.winRate,                     // recent win rate vs this enemy
      recentPerformance.battleCount / 50,           // battle count (normalized)
      consecutiveLosses / 10,                       // consecutive losses (normalized)
      this.countMoveInRecent(recentMoves, 'rock') / Math.max(1, recentMoves.length),
      this.countMoveInRecent(recentMoves, 'paper') / Math.max(1, recentMoves.length),
      this.countMoveInRecent(recentMoves, 'scissor') / Math.max(1, recentMoves.length),
      gameHistory.length / 20,                      // game history length
      gameHistory.length > 0 ? gameHistory.filter(g => g.result === 'win').length / gameHistory.length : 0.5,
      (playerStats?.shield || 0) / 100,            // normalized shield
      Math.sin(turn / 10),                          // cyclic pattern 1
      Math.cos(turn / 10),                          // cyclic pattern 2
      Math.random() * 0.1                          // small random noise for exploration
    ];
  }
  
  // Count occurrences of specific move in recent moves
  countMoveInRecent(moves, targetMove) {
    return moves.filter(move => move === targetMove).length;
  }
  
  // Enhanced statistics that include ML performance
  getEnhancedStats() {
    const baseStats = this.getStatsSummary();
    
    if (this.hybridMode.enabled) {
      const mlStats = this.mlEngine.getMLStats();
      
      return {
        ...baseStats,
        mlEnabled: true,
        mlStats: mlStats,
        hybridMode: this.hybridMode,
        decisionMethods: {
          ml: mlStats.totalBattles,
          ruleBased: this.turnHistory.length - mlStats.totalBattles,
          total: this.turnHistory.length
        }
      };
    }
    
    return {
      ...baseStats,
      mlEnabled: false
    };
  }
  
  // Adaptive ML weight adjustment based on performance
  adjustMLWeights() {
    if (!this.hybridMode.adaptiveWeighting || this.turnHistory.length < 20) return;
    
    const recent = this.turnHistory.slice(-20);
    const mlTurns = recent.filter(turn => turn.mlGenerated);
    const ruleTurns = recent.filter(turn => !turn.mlGenerated);
    
    if (mlTurns.length > 0 && ruleTurns.length > 0) {
      const mlWinRate = mlTurns.filter(turn => turn.result === 'win').length / mlTurns.length;
      const ruleWinRate = ruleTurns.filter(turn => turn.result === 'win').length / ruleTurns.length;
      
      // Adjust weights based on relative performance
      if (mlWinRate > ruleWinRate + 0.1) {
        this.hybridMode.mlWeight = Math.min(0.8, this.hybridMode.mlWeight + 0.05);
      } else if (ruleWinRate > mlWinRate + 0.1) {
        this.hybridMode.mlWeight = Math.max(0.2, this.hybridMode.mlWeight - 0.05);
      }
      
      if (!config.minimalOutput && Math.random() < 0.1) { // Log occasionally
        console.log(`🔧 ML weight adjusted to ${(this.hybridMode.mlWeight * 100).toFixed(0)}% (ML: ${(mlWinRate * 100).toFixed(0)}% vs Rules: ${(ruleWinRate * 100).toFixed(0)}%)`);
      }
    }
  }
}