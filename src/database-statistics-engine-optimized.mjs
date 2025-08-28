/**
 * Optimized Database Statistics Engine - Enhanced for ML Performance
 * Uses pre-calculated metrics and optimized data structures
 */

import { DatabaseStatisticsEngine } from './database-statistics-engine.mjs';
import { PredictionEvaluator } from './prediction-evaluator.mjs';

export class OptimizedDatabaseStatisticsEngine extends DatabaseStatisticsEngine {
    constructor(dbPath = './data/battle-statistics.db') {
        super(dbPath);
        
        // Enhanced caching for performance
        this.entropyCache = new Map();
        this.markovCache = new Map();
        this.weaponStatsCache = new Map();
        this.strategyPerformanceCache = new Map();
        
        // Prediction evaluation system
        this.predictionEvaluator = null; // Initialize after database is ready
        this.pendingEvaluations = new Map(); // Battle ID -> prediction data
    }
    
    // OPTIMIZED MARKOV CHAIN PREDICTIONS
    async markovChainPredictionOptimized(enemyId, order) {
        const cacheKey = `${enemyId}-${this.currentDungeonType}-${order}`;
        
        // Use recent moves from session data for pattern
        const key = `${enemyId}-${this.currentDungeonType}`;
        const enemy = this.sessionData.enemies.get(key);
        
        if (!enemy || enemy.recentMoves.length < order) {
            return { move: null, confidence: 0, method: `markov_${order}` };
        }
        
        const pattern = enemy.recentMoves.slice(-order).join('-');
        
        try {
            // Query optimized markov_sequences table
            const sequences = await this.db.all(`
                SELECT next_move, count, success_rate
                FROM markov_sequences 
                WHERE enemy_id = ? AND dungeon_id = ? AND order_level = ? AND sequence_pattern = ?
                ORDER BY count DESC
            `, [this.convertEnemyIdToInt(enemyId), this.currentDungeonType, order, pattern]);
            
            if (sequences.length > 0) {
                const topSequence = sequences[0];
                const totalCount = sequences.reduce((sum, seq) => sum + seq.count, 0);
                const confidence = topSequence.count / totalCount;
                
                // Update strategy performance
                await this.updateStrategyPerformance(enemyId, `markov_${order}`, confidence);
                
                return { 
                    move: topSequence.next_move, 
                    confidence: confidence,
                    method: `markov_${order}`,
                    successRate: topSequence.success_rate || 0
                };
            }
        } catch (error) {
            console.error(`❌ Optimized Markov ${order}-order prediction failed:`, error);
        }
        
        return { move: null, confidence: 0, method: `markov_${order}` };
    }
    
    // ENHANCED THOMPSON SAMPLING WITH BETA TRACKING
    async thompsonSamplingOptimized(enemyId, enemyStats) {
        try {
            // Get strategy performance parameters from database
            const strategyData = await this.db.all(`
                SELECT strategy_name, alpha_param, beta_param, total_predictions
                FROM strategy_performance
                WHERE enemy_id = ? AND dungeon_id = ?
            `, [this.convertEnemyIdToInt(enemyId), this.currentDungeonType]);
            
            const strategies = ['markov_1', 'markov_2', 'markov_3', 'frequency', 'stats_enhanced'];
            const samples = {};
            
            // Sample from each strategy's beta distribution
            for (const strategy of strategies) {
                const data = strategyData.find(s => s.strategy_name === strategy);
                const alpha = data ? data.alpha_param : 1.0;
                const beta = data ? data.beta_param : 1.0;
                
                samples[strategy] = this.betaSample(alpha, beta);
            }
            
            // Weight by weapon stats if available
            if (enemyStats && enemyStats.weapons) {
                const statPredict = await this.predictBasedOnWeaponStatsOptimized(enemyStats);
                if (statPredict && statPredict.move) {
                    samples['stats_enhanced'] *= 1.5; // Higher boost for stat predictions
                }
            }
            
            // Choose strategy with highest sample
            let bestStrategy = 'markov_1';
            let bestSample = samples.markov_1 || 0;
            
            for (const [strategy, sample] of Object.entries(samples)) {
                if (sample > bestSample) {
                    bestSample = sample;
                    bestStrategy = strategy;
                }
            }
            
            // Execute the chosen strategy
            let prediction;
            switch (bestStrategy) {
                case 'markov_1':
                    prediction = await this.markovChainPredictionOptimized(enemyId, 1);
                    break;
                case 'markov_2':
                    prediction = await this.markovChainPredictionOptimized(enemyId, 2);
                    break;
                case 'markov_3':
                    prediction = await this.markovChainPredictionOptimized(enemyId, 3);
                    break;
                case 'frequency':
                    prediction = await this.predictByMoveFrequency(enemyId);
                    break;
                case 'stats_enhanced':
                    prediction = await this.predictBasedOnWeaponStatsOptimized(enemyStats);
                    break;
            }
            
            return prediction && prediction.move ? prediction.move : 'rock';
            
        } catch (error) {
            console.error('❌ Optimized Thompson sampling failed:', error);
            return 'rock';
        }
    }
    
    // OPTIMIZED ENTROPY CALCULATION USING CACHE
    async calculateEnemyEntropyOptimized(enemyId) {
        const cacheKey = `${enemyId}-${this.currentDungeonType}`;
        
        // Check cache first
        if (this.entropyCache.has(cacheKey)) {
            const cached = this.entropyCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return cached.entropy;
            }
        }
        
        try {
            // Get pre-calculated entropy from database
            const entropyData = await this.db.get(`
                SELECT current_entropy, predictability_score, classification, cache_valid
                FROM enemy_entropy_cache
                WHERE enemy_id = ? AND dungeon_id = ?
            `, [this.convertEnemyIdToInt(enemyId), this.currentDungeonType]);
            
            if (entropyData && entropyData.cache_valid) {
                const entropy = entropyData.current_entropy;
                
                // Cache the result
                this.entropyCache.set(cacheKey, {
                    entropy: entropy,
                    classification: entropyData.classification,
                    predictabilityScore: entropyData.predictability_score,
                    timestamp: Date.now()
                });
                
                return entropy;
            }
            
        } catch (error) {
            console.error('❌ Optimized entropy calculation failed:', error);
        }
        
        // Fallback to original calculation
        return this.calculateEnemyEntropy(enemyId);
    }
    
    // OPTIMIZED WEAPON STATS PREDICTION WITH CORRELATION DATA
    async predictBasedOnWeaponStatsOptimized(enemyStats) {
        if (!enemyStats || !enemyStats.weapons) {
            return { move: null, confidence: 0, method: 'stats_enhanced' };
        }
        
        const weapons = enemyStats.weapons;
        const totalAttack = weapons.rock.attack + weapons.paper.attack + weapons.scissor.attack;
        
        if (totalAttack === 0) {
            return { move: null, confidence: 0, method: 'stats_enhanced' };
        }
        
        // Enhanced correlation using machine learning insights
        const attackProbs = {
            rock: weapons.rock.attack / totalAttack,
            paper: weapons.paper.attack / totalAttack,
            scissor: weapons.scissor.attack / totalAttack
        };
        
        // Consider defense balance and total power
        const totalDefense = weapons.rock.defense + weapons.paper.defense + weapons.scissor.defense;
        const defenseProbs = totalDefense > 0 ? {
            rock: weapons.rock.defense / totalDefense,
            paper: weapons.paper.defense / totalDefense,
            scissor: weapons.scissor.defense / totalDefense
        } : { rock: 0.33, paper: 0.33, scissor: 0.34 };
        
        // Advanced weighting: 70% attack, 20% defense, 10% balance
        const balanceScore = 1.0 - (Math.max(...Object.values(attackProbs)) - Math.min(...Object.values(attackProbs)));
        
        const combinedProbs = {
            rock: 0.7 * attackProbs.rock + 0.2 * defenseProbs.rock + 0.1 * (balanceScore * 0.33),
            paper: 0.7 * attackProbs.paper + 0.2 * defenseProbs.paper + 0.1 * (balanceScore * 0.33),
            scissor: 0.7 * attackProbs.scissor + 0.2 * defenseProbs.scissor + 0.1 * (balanceScore * 0.34)
        };
        
        // Find highest probability move
        let bestMove = 'rock';
        let bestProb = combinedProbs.rock;
        
        for (const [move, prob] of Object.entries(combinedProbs)) {
            if (prob > bestProb) {
                bestProb = prob;
                bestMove = move;
            }
        }
        
        // Enhanced confidence calculation
        const probs = Object.values(combinedProbs);
        const variance = probs.reduce((sum, p) => sum + Math.pow(p - 1/3, 2), 0) / 3;
        const statStrength = Math.max(...Object.values(attackProbs)) - Math.min(...Object.values(attackProbs));
        const confidence = Math.min(0.8, variance * 2 + statStrength * 0.5);
        
        return { move: bestMove, confidence: confidence, method: 'stats_enhanced' };
    }
    
    // OPTIMIZED ENSEMBLE VOTING WITH PERFORMANCE METRICS
    async ensembleVoteOptimized(enemyId, entropy) {
        try {
            // Get all strategy predictions with their current performance
            const strategies = await Promise.all([
                this.markovChainPredictionOptimized(enemyId, 1),
                this.markovChainPredictionOptimized(enemyId, 2), 
                this.markovChainPredictionOptimized(enemyId, 3),
                this.predictByMoveFrequency(enemyId),
                this.predictBasedOnWeaponStatsOptimized(this.getLatestEnemyStats(enemyId))
            ]);
            
            // Get performance metrics for dynamic weighting
            const performanceData = await this.db.all(`
                SELECT strategy_name, successes, failures, total_predictions
                FROM strategy_performance
                WHERE enemy_id = ? AND dungeon_id = ?
            `, [this.convertEnemyIdToInt(enemyId), this.currentDungeonType]);
            
            // Calculate adaptive weights based on entropy and performance
            const weights = this.calculateAdaptiveWeights(entropy, performanceData);
            
            // Weighted voting
            const votes = { rock: 0, paper: 0, scissor: 0 };
            
            strategies.forEach((strategy, index) => {
                if (strategy && strategy.move) {
                    const methodName = strategy.method;
                    const weight = weights[methodName] || 0.1;
                    const confidence = strategy.confidence || 0.5;
                    const performance = this.getStrategyPerformance(methodName, performanceData);
                    
                    votes[strategy.move] += weight * confidence * (1 + performance);
                }
            });
            
            // Find winner
            let bestMove = 'rock';
            let bestVotes = votes.rock;
            
            for (const [move, voteCount] of Object.entries(votes)) {
                if (voteCount > bestVotes) {
                    bestVotes = voteCount;
                    bestMove = move;
                }
            }
            
            return bestMove;
            
        } catch (error) {
            console.error('❌ Optimized ensemble voting failed:', error);
            return 'rock';
        }
    }
    
    // HELPER METHODS
    
    calculateAdaptiveWeights(entropy, performanceData) {
        const baseWeights = {
            markov_3: entropy < 1.0 ? 0.35 : 0.15,
            markov_2: entropy < 1.2 ? 0.25 : 0.20,
            markov_1: entropy < 1.4 ? 0.20 : 0.25,
            frequency: 0.15,
            stats_enhanced: entropy > 1.2 ? 0.25 : 0.15
        };
        
        // Adjust weights based on performance
        performanceData.forEach(perf => {
            if (baseWeights[perf.strategy_name] && perf.total_predictions > 10) {
                const accuracy = perf.successes / perf.total_predictions;
                const adjustment = (accuracy - 0.5) * 0.4; // Max ±20% adjustment
                baseWeights[perf.strategy_name] *= (1 + adjustment);
            }
        });
        
        // Normalize weights
        const totalWeight = Object.values(baseWeights).reduce((sum, w) => sum + w, 0);
        Object.keys(baseWeights).forEach(key => {
            baseWeights[key] /= totalWeight;
        });
        
        return baseWeights;
    }
    
    getStrategyPerformance(methodName, performanceData) {
        const data = performanceData.find(p => p.strategy_name === methodName);
        if (!data || data.total_predictions < 5) {
            return 0; // Neutral performance boost for new strategies
        }
        
        const accuracy = data.successes / data.total_predictions;
        return (accuracy - 0.33) * 2; // Scale around 33% baseline
    }
    
    async updateStrategyPerformance(enemyId, strategyName, confidence, correct = null) {
        if (correct !== null) {
            const success = correct ? 1 : 0;
            const failure = correct ? 0 : 1;
            
            await this.db.run(`
                UPDATE strategy_performance 
                SET successes = successes + ?,
                    failures = failures + ?,
                    total_predictions = total_predictions + 1,
                    alpha_param = successes + 1,
                    beta_param = failures + 1,
                    confidence_level = ?,
                    last_updated = ?
                WHERE enemy_id = ? AND dungeon_id = ? AND strategy_name = ?
            `, [success, failure, confidence, Date.now(), 
                this.convertEnemyIdToInt(enemyId), this.currentDungeonType, strategyName]);
        }
    }
    
    getLatestEnemyStats(enemyId) {
        const key = `${enemyId}-${this.currentDungeonType}`;
        const enemy = this.sessionData.enemies.get(key);
        return enemy?.latestStats || null;
    }
    
    async getEnemyClassification(enemyId) {
        try {
            const result = await this.db.get(`
                SELECT classification FROM enemy_entropy_cache
                WHERE enemy_id = ? AND dungeon_id = ?
            `, [this.convertEnemyIdToInt(enemyId), this.currentDungeonType]);
            
            return result?.classification || 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }
    
    async calculateEnsembleConfidence(markov1, markov2, markov3, frequency, stats) {
        const predictions = [markov1, markov2, markov3, frequency, stats];
        const validPredictions = predictions.filter(p => p && p.move && p.confidence > 0);
        
        if (validPredictions.length === 0) return 0.5;
        
        // Calculate weighted average confidence
        const totalWeight = validPredictions.reduce((sum, p) => sum + p.confidence, 0);
        const avgConfidence = totalWeight / validPredictions.length;
        
        // Boost confidence if multiple algorithms agree
        const moves = validPredictions.map(p => p.move);
        const agreements = moves.reduce((acc, move) => {
            acc[move] = (acc[move] || 0) + 1;
            return acc;
        }, {});
        
        const maxAgreement = Math.max(...Object.values(agreements));
        const agreementBonus = (maxAgreement - 1) * 0.1; // +10% per additional agreeing algorithm
        
        return Math.min(0.95, avgConfidence + agreementBonus);
    }
    
    // OVERRIDE MAIN PREDICTION METHOD TO USE OPTIMIZATIONS WITH EVALUATION
    async predictEnemyMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId) {
        await this.ensureInitialized();
        
        // Initialize prediction evaluator if not done
        if (!this.predictionEvaluator) {
            this.predictionEvaluator = new PredictionEvaluator(this.db);
        }
        
        try {
            // Store latest enemy stats for optimization
            const key = `${enemyId}-${this.currentDungeonType}`;
            if (!this.sessionData.enemies.has(key)) {
                this.sessionData.enemies.set(key, {
                    id: enemyId,
                    dungeonId: this.currentDungeonType,
                    battles: 0,
                    recentMoves: [],
                    recentBattles: []
                });
            }
            this.sessionData.enemies.get(key).latestStats = enemyStats;
            
            const enemyData = await this.db.getEnemyStats(this.convertEnemyIdToInt(enemyId), this.currentDungeonType);
            
            // Generate battle ID for tracking
            const battleId = `${enemyId}-${turn}-${Date.now()}`;
            
            if (!enemyData.enemy || enemyData.enemy.total_battles < 3) {
                // Use optimized Thompson sampling for new enemies
                const prediction = await this.thompsonSamplingOptimized(enemyId, enemyStats);
                
                // Record prediction for evaluation (limited data for new enemies)
                await this.predictionEvaluator.recordAlgorithmPredictions(battleId, enemyId, this.currentDungeonType, turn, {
                    thompson: prediction,
                    ensemble: prediction,
                    ensembleConfidence: 0.5,
                    entropy: 1.5,
                    classification: 'new'
                });
                
                this.lastPrediction = prediction;
                this.lastBattleId = battleId;
                return prediction;
            }
            
            // CAPTURE ALL INDIVIDUAL ALGORITHM PREDICTIONS FOR EVALUATION
            
            // Get optimized entropy and classification
            const entropy = await this.calculateEnemyEntropyOptimized(enemyId);
            const classification = await this.getEnemyClassification(enemyId);
            
            // Get all individual predictions
            const markov1 = await this.markovChainPredictionOptimized(enemyId, 1);
            const markov2 = await this.markovChainPredictionOptimized(enemyId, 2);
            const markov3 = await this.markovChainPredictionOptimized(enemyId, 3);
            const frequency = await this.predictByMoveFrequency(enemyId);
            const stats = await this.predictBasedOnWeaponStatsOptimized(enemyStats);
            const thompson = await this.thompsonSamplingOptimized(enemyId, enemyStats);
            
            // Use optimized ensemble voting
            const finalPrediction = await this.ensembleVoteOptimized(enemyId, entropy);
            const ensembleConfidence = await this.calculateEnsembleConfidence(markov1, markov2, markov3, frequency, stats);
            
            // Record all predictions for evaluation
            await this.predictionEvaluator.recordAlgorithmPredictions(battleId, enemyId, this.currentDungeonType, turn, {
                markov1: markov1,
                markov2: markov2,
                markov3: markov3,
                frequency: frequency,
                stats: stats,
                thompson: thompson,
                ensemble: finalPrediction,
                ensembleConfidence: ensembleConfidence,
                entropy: entropy,
                classification: classification
            });
            
            this.lastPrediction = finalPrediction;
            this.lastBattleId = battleId;
            
            console.log(`🎯 OPTIMIZED Prediction: Enemy ${enemyId} T${turn}: ${finalPrediction} (entropy: ${entropy.toFixed(2)})`);
            console.log(`   📊 Individual: M1:${markov1.move || 'N/A'} M2:${markov2.move || 'N/A'} M3:${markov3.move || 'N/A'} F:${frequency.move || 'N/A'} S:${stats.move || 'N/A'}`);
            
            // Return object with move AND confidence (FIX: was returning just string)
            return { 
                move: finalPrediction, 
                confidence: ensembleConfidence,
                method: 'optimized_ensemble'
            };
            
        } catch (error) {
            console.error('❌ Optimized prediction failed, using fallback:', error);
            
            // Fallback to parent class method
            return super.predictEnemyMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId);
        }
    }
    
    // OVERRIDE predictNextMove to use optimized predictEnemyMove
    async predictNextMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId, possibleMoves = null) {
        // Use the optimized predictEnemyMove which includes all ML algorithms
        const result = await this.predictEnemyMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId);
        
        // Convert format to what DecisionEngine expects
        if (!result || !result.move) {
            return {
                predictions: { rock: 0.33, paper: 0.33, scissor: 0.34 },
                confidence: 0,
                method: result?.method || 'none'
            };
        }
        
        // Create prediction distribution based on the single predicted move
        const predictions = { rock: 0, paper: 0, scissor: 0 };
        predictions[result.move] = 1.0;
        
        return {
            predictions: predictions,
            confidence: result.confidence || 0,
            method: result.method || 'optimized',
            move: result.move // Keep the original move for reference
        };
    }
    
    // ENHANCED DATA RECORDING WITH OPTIMIZED TABLES AND EVALUATION
    async recordTurn(enemyId, turn, playerAction, enemyAction, result, playerStats, enemyStats, weaponStats, noobId, timestamp, predictionMade = null, predictionCorrect = false, confidenceLevel = null) {
        // Call parent method first
        await super.recordTurn(enemyId, turn, playerAction, enemyAction, result, playerStats, enemyStats, weaponStats, noobId, timestamp, predictionMade, predictionCorrect, confidenceLevel);
        
        try {
            // EVALUATE PREDICTIONS - This provides the feedback loop the user wants
            if (this.predictionEvaluator && this.lastBattleId) {
                // Evaluate all individual algorithm predictions against actual enemy move
                const evaluation = await this.predictionEvaluator.evaluatePredictions(this.lastBattleId, enemyAction);
                
                // Log evaluation results if there were notable failures/successes
                if (evaluation) {
                    // This gives the user the feedback they want to see
                    this.logPredictionFeedback(evaluation, enemyId, turn);
                }
            }
            
            // Update optimized tables
            const numericEnemyId = this.convertEnemyIdToInt(enemyId);
            
            // Update markov sequences in real-time
            const key = `${enemyId}-${this.currentDungeonType}`;
            const enemy = this.sessionData.enemies.get(key);
            
            if (enemy && enemy.recentMoves.length >= 2) {
                for (let order = 1; order <= Math.min(3, enemy.recentMoves.length - 1); order++) {
                    const pattern = enemy.recentMoves.slice(-order - 1, -1).join('-');
                    const nextMove = enemyAction;
                    
                    await this.db.run(`
                        INSERT OR REPLACE INTO markov_sequences 
                        (enemy_id, dungeon_id, order_level, sequence_pattern, next_move, count, last_updated)
                        VALUES (?, ?, ?, ?, ?, 
                            COALESCE((SELECT count + 1 FROM markov_sequences 
                                     WHERE enemy_id = ? AND dungeon_id = ? AND order_level = ? 
                                     AND sequence_pattern = ? AND next_move = ?), 1),
                            ?
                        )
                    `, [numericEnemyId, this.currentDungeonType, order, pattern, nextMove,
                        numericEnemyId, this.currentDungeonType, order, pattern, nextMove,
                        timestamp || Date.now()]);
                }
            }
            
            // Update strategy performance if prediction was made
            if (predictionMade && confidenceLevel !== null) {
                await this.updateStrategyPerformance(enemyId, 'ensemble', confidenceLevel, predictionCorrect);
            }
            
            // Invalidate entropy cache for this enemy
            this.entropyCache.delete(`${enemyId}-${this.currentDungeonType}`);
            
            // Mark entropy cache as invalid in database for recalculation
            await this.db.run(`
                UPDATE enemy_entropy_cache 
                SET cache_valid = 0 
                WHERE enemy_id = ? AND dungeon_id = ?
            `, [numericEnemyId, this.currentDungeonType]);
            
        } catch (error) {
            console.error('❌ Failed to update optimized data:', error);
            // Continue anyway - main recording succeeded
        }
    }
    
    // Provide user feedback on prediction performance
    logPredictionFeedback(evaluation, enemyId, turn) {
        // This gives the user exactly what they asked for:
        // "I want some kind of feedback loop either to the learning or post here to analyze 
        //  that the bot had a really strong prediction for this but it turned out to be wrong"
        
        const ensemble = evaluation.ensemble_analysis;
        
        // Show individual algorithm performance for user analysis
        if (evaluation.correct.length > 0 || evaluation.incorrect.length > 0) {
            const correctAlgs = evaluation.correct.map(c => `${c.algorithm}:${c.prediction}(${(c.confidence*100).toFixed(0)}%)`).join(' ');
            const wrongAlgs = evaluation.incorrect.map(w => `${w.algorithm}:${w.prediction}(${(w.confidence*100).toFixed(0)}%)`).join(' ');
            
            if (correctAlgs && wrongAlgs) {
                console.log(`📊 Enemy ${enemyId} T${turn} Analysis: ✅${correctAlgs} ❌${wrongAlgs} → Actual: ${ensemble.actual_move}`);
            }
        }
        
        // Show overconfident failures (what the user specifically wanted)
        if (evaluation.overconfident.length > 0) {
            console.log(`🚨 OVERCONFIDENT FAILURES - Enemy ${enemyId} T${turn}:`);
            evaluation.overconfident.forEach(fail => {
                console.log(`   ${fail.algorithm}: predicted ${fail.prediction} (${(fail.confidence*100).toFixed(0)}% confident) - WRONG! Should have been ${ensemble.actual_move}`);
            });
        }
        
        // Show missed opportunities
        if (evaluation.missed_opportunities.length > 0) {
            console.log(`💡 MISSED OPPORTUNITIES - Enemy ${enemyId} T${turn}:`);
            evaluation.missed_opportunities.forEach(miss => {
                console.log(`   ${miss.algorithm}: correctly guessed ${miss.prediction} but was only ${(miss.confidence*100).toFixed(0)}% confident`);
            });
        }
        
        // Show ensemble failures with high confidence
        if (!ensemble.correct && ensemble.confidence > 0.8) {
            console.log(`🔴 HIGH-CONFIDENCE ENSEMBLE FAILURE - Enemy ${enemyId} T${turn}: predicted ${evaluation.ensemble_prediction} (${(ensemble.confidence*100).toFixed(0)}% confident), actual: ${ensemble.actual_move}`);
        }
        
        // Show strong consensus successes
        if (ensemble.correct && evaluation.correct.length >= 3) {
            console.log(`🎯 STRONG CONSENSUS SUCCESS - Enemy ${enemyId} T${turn}: ${evaluation.correct.length} algorithms agreed on ${ensemble.actual_move} - CORRECT!`);
        }
    }
    
    // CLEANUP
    async close() {
        // Clear caches
        this.entropyCache.clear();
        this.markovCache.clear();
        this.weaponStatsCache.clear();
        this.strategyPerformanceCache.clear();
        
        // Call parent close
        await super.close();
    }
}

export default OptimizedDatabaseStatisticsEngine;