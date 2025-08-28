#!/usr/bin/env node
/**
 * Comprehensive Pattern Detection Evaluation
 * Tests all pattern detection methods on historical data
 */

import { OptimizedDatabaseStatisticsEngine } from './src/database-statistics-engine-optimized.mjs';
import { RobustPatternDetector } from './src/robust-pattern-detector.mjs';
import { AdaptiveMarkovDetector } from './src/adaptive-markov-detector.mjs';
import { BattleChainAnalyzer } from './src/battle-chain-analyzer.mjs';
import { AdaptiveEnemyTracker } from './src/adaptive-enemy-tracker.mjs';

class PatternEvaluator {
    constructor() {
        this.engine = new OptimizedDatabaseStatisticsEngine('./data/battle-statistics.db');
        this.robustDetector = new RobustPatternDetector();
        this.markovDetector = new AdaptiveMarkovDetector();
        this.battleChainAnalyzer = new BattleChainAnalyzer();
        
        this.results = {
            byMethod: {},
            byEnemy: {},
            conflicts: [],
            overall: {}
        };
    }
    
    async initialize() {
        await this.engine.initializeAsync();
        console.log('✅ Evaluation system initialized\n');
    }
    
    async evaluateEnemy(enemyId, maxBattles = 100) {
        // Load all battles for this enemy
        const allBattles = await this.engine.getBattleHistory(enemyId, maxBattles);
        
        if (!allBattles || allBattles.length < 20) {
            return null;
        }
        
        const results = {
            enemyId,
            totalBattles: allBattles.length,
            evaluations: []
        };
        
        // Test at different points in history
        const testPoints = [
            { name: 'early', start: 10, window: 10 },
            { name: 'mid', start: Math.floor(allBattles.length / 2), window: 15 },
            { name: 'late', start: Math.max(20, allBattles.length - 20), window: 20 }
        ];
        
        for (const testPoint of testPoints) {
            if (testPoint.start + testPoint.window > allBattles.length) continue;
            
            const evaluation = await this.evaluateAtPoint(
                enemyId,
                allBattles,
                testPoint.start,
                testPoint.window
            );
            
            results.evaluations.push({
                point: testPoint.name,
                battlesUsed: testPoint.start,
                ...evaluation
            });
        }
        
        return results;
    }
    
    async evaluateAtPoint(enemyId, allBattles, historyEnd, testWindow) {
        // Split data: history for training, future for testing
        const history = allBattles.slice(0, historyEnd);
        const testBattles = allBattles.slice(historyEnd, historyEnd + testWindow);
        
        const predictions = {
            robust: [],
            markov: [],
            battleChain: [],
            adaptive: [],
            combined: []
        };
        
        const actual = testBattles.map(b => b.enemyMove);
        
        // 1. Robust Pattern Detector
        const robustProfile = this.robustDetector.analyzeEnemy(enemyId, history);
        for (let i = 0; i < testWindow; i++) {
            if (robustProfile.type !== 'unknown' && robustProfile.confidence > 0.5) {
                // Predict based on pattern type
                if (robustProfile.type === 'fixed') {
                    predictions.robust.push(robustProfile.dominantMove);
                } else if (robustProfile.type === 'counter') {
                    // Predict they'll counter our last move
                    const ourLast = history[history.length - 1]?.ourMove || 'rock';
                    const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                    predictions.robust.push(counters[ourLast]);
                } else {
                    predictions.robust.push(null);
                }
            } else {
                predictions.robust.push(null);
            }
        }
        
        // 2. Adaptive Markov Detector
        for (let i = 0; i < testWindow; i++) {
            const currentHistory = [...history, ...testBattles.slice(0, i)];
            const markovResult = this.markovDetector.detectPattern(
                currentHistory.slice(-20).map(b => ({ 
                    move: b.enemyMove,
                    previous: currentHistory[currentHistory.indexOf(b) - 1]?.enemyMove 
                }))
            );
            
            if (markovResult && markovResult.prediction) {
                predictions.markov.push(markovResult.prediction);
            } else {
                predictions.markov.push(null);
            }
        }
        
        // 3. Battle Chain Analyzer (only for battle starts)
        // Group battles into series
        const battleSeries = this.groupIntoBattleSeries(history);
        if (battleSeries.length >= 2) {
            // Summarize each battle for the analyzer
            battleSeries.forEach(series => {
                this.battleChainAnalyzer.summarizeBattle(enemyId, series);
            });
            
            const chainPrediction = this.battleChainAnalyzer.predictNextBattle(enemyId);
            if (chainPrediction) {
                // Apply to first few moves of test window
                for (let i = 0; i < testWindow; i++) {
                    if (i < 3) { // Battle chain mostly affects early moves
                        predictions.battleChain.push(chainPrediction.predictedDominant);
                    } else {
                        predictions.battleChain.push(null);
                    }
                }
            } else {
                predictions.battleChain.push(...Array(testWindow).fill(null));
            }
        } else {
            predictions.battleChain.push(...Array(testWindow).fill(null));
        }
        
        // 4. Adaptive Enemy Tracker
        const recentMoves = history.slice(-20).map(b => ({
            move: b.enemyMove,
            turn: b.turn,
            result: b.result,
            ourMove: b.ourMove
        }));
        const historicalMoves = history.slice(0, -20).map(b => ({
            move: b.enemyMove,
            turn: b.turn,
            result: b.result,
            ourMove: b.ourMove
        }));
        
        const adaptiveAnalysis = AdaptiveEnemyTracker.analyzeAdaptation(recentMoves, historicalMoves);
        if (adaptiveAnalysis.adaptationSpeed > 0.3) {
            const adaptivePred = AdaptiveEnemyTracker.getAdaptiveCounter(adaptiveAnalysis);
            for (let i = 0; i < testWindow; i++) {
                if (adaptivePred && adaptivePred.rock) {
                    // Pick highest probability
                    const bestMove = Object.entries(adaptivePred)
                        .reduce((a, b) => a[1] > b[1] ? a : b)[0];
                    predictions.adaptive.push(bestMove);
                } else {
                    predictions.adaptive.push(null);
                }
            }
        } else {
            predictions.adaptive.push(...Array(testWindow).fill(null));
        }
        
        // 5. Combined prediction (voting)
        for (let i = 0; i < testWindow; i++) {
            const votes = {};
            const methods = [
                predictions.robust[i],
                predictions.markov[i],
                predictions.battleChain[i],
                predictions.adaptive[i]
            ];
            
            methods.forEach(pred => {
                if (pred) {
                    votes[pred] = (votes[pred] || 0) + 1;
                }
            });
            
            // Get move with most votes
            const bestPred = Object.entries(votes).reduce((best, [move, count]) => 
                count > (best.count || 0) ? { move, count } : best,
                { move: null, count: 0 }
            );
            
            predictions.combined.push(bestPred.count > 0 ? bestPred.move : null);
        }
        
        // Calculate accuracies
        const accuracies = {};
        const conflicts = [];
        
        for (const [method, preds] of Object.entries(predictions)) {
            let correct = 0;
            let attempts = 0;
            
            preds.forEach((pred, i) => {
                if (pred !== null) {
                    attempts++;
                    if (pred === actual[i]) {
                        correct++;
                    }
                    
                    // Check for conflicts with other methods
                    for (const [otherMethod, otherPreds] of Object.entries(predictions)) {
                        if (method !== otherMethod && otherPreds[i] !== null && otherPreds[i] !== pred) {
                            conflicts.push({
                                turn: i,
                                methods: [method, otherMethod],
                                predictions: { [method]: pred, [otherMethod]: otherPreds[i] },
                                actual: actual[i]
                            });
                        }
                    }
                }
            });
            
            accuracies[method] = {
                accuracy: attempts > 0 ? correct / attempts : 0,
                coverage: attempts / testWindow,
                correct,
                attempts,
                total: testWindow
            };
        }
        
        return {
            accuracies,
            conflicts: this.deduplicateConflicts(conflicts),
            actualDistribution: this.getDistribution(actual)
        };
    }
    
    groupIntoBattleSeries(battles) {
        const series = [];
        let currentSeries = [];
        
        for (const battle of battles) {
            if (currentSeries.length > 0 && battle.turn <= currentSeries[currentSeries.length - 1].turn) {
                // New battle series detected
                series.push(currentSeries);
                currentSeries = [battle];
            } else {
                currentSeries.push(battle);
            }
        }
        
        if (currentSeries.length > 0) {
            series.push(currentSeries);
        }
        
        return series;
    }
    
    deduplicateConflicts(conflicts) {
        const unique = [];
        const seen = new Set();
        
        for (const conflict of conflicts) {
            const key = `${conflict.turn}-${conflict.methods.sort().join('-')}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(conflict);
            }
        }
        
        return unique;
    }
    
    getDistribution(moves) {
        const counts = { rock: 0, paper: 0, scissor: 0 };
        moves.forEach(m => counts[m]++);
        const total = moves.length;
        
        return {
            rock: (counts.rock / total * 100).toFixed(1) + '%',
            paper: (counts.paper / total * 100).toFixed(1) + '%',
            scissor: (counts.scissor / total * 100).toFixed(1) + '%'
        };
    }
    
    async runComprehensiveEvaluation() {
        console.log('=' .repeat(70));
        console.log('COMPREHENSIVE PATTERN DETECTION EVALUATION');
        console.log('=' .repeat(70));
        
        // Get list of enemies with sufficient data
        const enemies = await this.engine.getEnemiesWithMinBattles(50);
        
        if (!enemies || enemies.length === 0) {
            console.log('No enemies with sufficient battle history found');
            return;
        }
        
        console.log(`\nEvaluating ${enemies.length} enemies with 50+ battles each...\n`);
        
        const methodTotals = {
            robust: { correct: 0, attempts: 0 },
            markov: { correct: 0, attempts: 0 },
            battleChain: { correct: 0, attempts: 0 },
            adaptive: { correct: 0, attempts: 0 },
            combined: { correct: 0, attempts: 0 }
        };
        
        let totalConflicts = 0;
        let conflictOutcomes = { bothWrong: 0, oneRight: 0, bothRight: 0 };
        
        // Evaluate each enemy
        for (const enemy of enemies.slice(0, 10)) { // Limit to 10 enemies for speed
            console.log(`\nEvaluating Enemy ${enemy.enemy_id} (${enemy.battle_count} battles)...`);
            
            const evaluation = await this.evaluateEnemy(enemy.enemy_id, 200);
            
            if (!evaluation) {
                console.log(`  ⚠️ Insufficient data for Enemy ${enemy.enemy_id}`);
                continue;
            }
            
            // Aggregate results
            evaluation.evaluations.forEach(evalResult => {
                for (const [method, stats] of Object.entries(evalResult.accuracies)) {
                    methodTotals[method].correct += stats.correct;
                    methodTotals[method].attempts += stats.attempts;
                }
                
                // Analyze conflicts
                evalResult.conflicts.forEach(conflict => {
                    totalConflicts++;
                    const predictions = Object.values(conflict.predictions);
                    const correctCount = predictions.filter(p => p === conflict.actual).length;
                    
                    if (correctCount === 0) conflictOutcomes.bothWrong++;
                    else if (correctCount === 1) conflictOutcomes.oneRight++;
                    else conflictOutcomes.bothRight++;
                });
            });
            
            // Show enemy-specific results
            console.log(`  Results for Enemy ${enemy.enemy_id}:`);
            evaluation.evaluations.forEach(evalResult => {
                console.log(`    ${evalResult.point.toUpperCase()} (after ${evalResult.battlesUsed} battles):`);
                for (const [method, stats] of Object.entries(evalResult.accuracies)) {
                    if (stats.attempts > 0) {
                        console.log(`      ${method}: ${(stats.accuracy * 100).toFixed(1)}% accurate (${stats.coverage * 100}% coverage)`);
                    }
                }
            });
        }
        
        // Overall summary
        console.log('\n' + '=' .repeat(70));
        console.log('OVERALL RESULTS');
        console.log('=' .repeat(70));
        
        console.log('\nMethod Performance:');
        console.log('-'.repeat(40));
        
        const sortedMethods = Object.entries(methodTotals)
            .map(([method, totals]) => ({
                method,
                accuracy: totals.attempts > 0 ? totals.correct / totals.attempts : 0,
                attempts: totals.attempts,
                correct: totals.correct
            }))
            .sort((a, b) => b.accuracy - a.accuracy);
        
        sortedMethods.forEach(({ method, accuracy, attempts, correct }) => {
            const stars = '⭐'.repeat(Math.round(accuracy * 5));
            console.log(`${method.padEnd(15)} ${(accuracy * 100).toFixed(1)}% ${stars} (${correct}/${attempts})`);
        });
        
        console.log('\nConflict Analysis:');
        console.log('-'.repeat(40));
        console.log(`Total conflicts: ${totalConflicts}`);
        if (totalConflicts > 0) {
            console.log(`  Both wrong: ${(conflictOutcomes.bothWrong / totalConflicts * 100).toFixed(1)}%`);
            console.log(`  One right:  ${(conflictOutcomes.oneRight / totalConflicts * 100).toFixed(1)}%`);
            console.log(`  Both right: ${(conflictOutcomes.bothRight / totalConflicts * 100).toFixed(1)}% (different valid patterns)`);
        }
        
        console.log('\n' + '=' .repeat(70));
        console.log('RECOMMENDATIONS');
        console.log('=' .repeat(70));
        
        // Generate recommendations
        this.generateRecommendations(sortedMethods, conflictOutcomes, totalConflicts);
    }
    
    generateRecommendations(sortedMethods, conflictOutcomes, totalConflicts) {
        const best = sortedMethods[0];
        const worst = sortedMethods[sortedMethods.length - 1];
        
        console.log('\n✅ BEST PERFORMING:');
        console.log(`   ${best.method} with ${(best.accuracy * 100).toFixed(1)}% accuracy`);
        
        console.log('\n❌ NEEDS IMPROVEMENT:');
        console.log(`   ${worst.method} with ${(worst.accuracy * 100).toFixed(1)}% accuracy`);
        
        // Check if combined is better than individual
        const combined = sortedMethods.find(m => m.method === 'combined');
        const bestIndividual = sortedMethods.find(m => m.method !== 'combined');
        
        if (combined && bestIndividual) {
            if (combined.accuracy > bestIndividual.accuracy) {
                console.log('\n🎯 ENSEMBLE BENEFIT:');
                console.log(`   Combined voting (${(combined.accuracy * 100).toFixed(1)}%) beats best individual (${(bestIndividual.accuracy * 100).toFixed(1)}%)`);
                console.log('   ➜ Keep using ensemble approach');
            } else {
                console.log('\n⚠️ ENSEMBLE UNDERPERFORMING:');
                console.log(`   Combined voting (${(combined.accuracy * 100).toFixed(1)}%) worse than ${bestIndividual.method} (${(bestIndividual.accuracy * 100).toFixed(1)}%)`);
                console.log(`   ➜ Consider weighted voting favoring ${bestIndividual.method}`);
            }
        }
        
        // Conflict recommendations
        if (totalConflicts > 0) {
            const conflictErrorRate = conflictOutcomes.bothWrong / totalConflicts;
            if (conflictErrorRate > 0.5) {
                console.log('\n⚠️ HIGH CONFLICT ERROR RATE:');
                console.log(`   ${(conflictErrorRate * 100).toFixed(1)}% of conflicts result in both methods being wrong`);
                console.log('   ➜ Methods may be overfitting to different patterns');
                console.log('   ➜ Consider adding conflict resolution logic');
            }
        }
        
        // Method-specific recommendations
        console.log('\n📊 METHOD-SPECIFIC INSIGHTS:');
        sortedMethods.forEach(({ method, accuracy, attempts }) => {
            if (method === 'battleChain' && accuracy < 0.3 && attempts > 10) {
                console.log(`   Battle Chain: Low accuracy suggests enemies don't have strong meta-patterns`);
            }
            if (method === 'markov' && accuracy > 0.4) {
                console.log(`   Markov: Good performance indicates predictable sequences exist`);
            }
            if (method === 'robust' && accuracy > 0.35) {
                console.log(`   Robust: Enemies have exploitable biases or fixed patterns`);
            }
            if (method === 'adaptive' && accuracy < 0.25) {
                console.log(`   Adaptive: Enemies may not be adapting as expected`);
            }
        });
    }
    
    async close() {
        await this.engine.close();
    }
}

// Add method to database engine to get enemies with min battles
OptimizedDatabaseStatisticsEngine.prototype.getEnemiesWithMinBattles = async function(minBattles = 50) {
    try {
        const enemies = await this.db.all(`
            SELECT enemy_id, COUNT(*) as battle_count
            FROM battles
            GROUP BY enemy_id
            HAVING battle_count >= ?
            ORDER BY battle_count DESC
        `, [minBattles]);
        
        return enemies || [];
    } catch (error) {
        console.error('Failed to get enemies:', error.message);
        return [];
    }
};

// Run evaluation
async function main() {
    const evaluator = new PatternEvaluator();
    
    try {
        await evaluator.initialize();
        await evaluator.runComprehensiveEvaluation();
        await evaluator.close();
        
        console.log('\n✅ Evaluation complete!');
    } catch (error) {
        console.error('❌ Evaluation failed:', error.message);
        console.error(error.stack);
        await evaluator.close();
        process.exit(1);
    }
}

main().catch(console.error);