#!/usr/bin/env node
/**
 * Final Comprehensive Pattern Evaluation
 * Tests all methods and identifies what works
 */

import { OptimizedDatabaseStatisticsEngine } from './src/database-statistics-engine-optimized.mjs';
import { RobustPatternDetector } from './src/robust-pattern-detector.mjs';
import { AdaptiveMarkovDetector } from './src/adaptive-markov-detector.mjs';
import { BattleChainAnalyzer } from './src/battle-chain-analyzer.mjs';

class FinalEvaluator {
    constructor() {
        this.engine = new OptimizedDatabaseStatisticsEngine('./data/battle-statistics.db');
    }
    
    async initialize() {
        await this.engine.initializeAsync();
    }
    
    /**
     * Test simple bias detection
     */
    testBiasDetection(battles) {
        const counts = { rock: 0, paper: 0, scissor: 0 };
        battles.forEach(b => counts[b.enemyMove]++);
        const total = battles.length;
        
        const probs = {
            rock: counts.rock / total,
            paper: counts.paper / total,
            scissor: counts.scissor / total
        };
        
        // Find dominant move
        let dominant = null;
        let maxProb = 0;
        
        for (const [move, prob] of Object.entries(probs)) {
            if (prob > maxProb) {
                maxProb = prob;
                dominant = move;
            }
        }
        
        // Is there a significant bias?
        const hasBias = maxProb > 0.4; // 40% or more
        
        return {
            method: 'simple_bias',
            dominant,
            probability: maxProb,
            hasBias,
            distribution: probs
        };
    }
    
    /**
     * Test simple sequence detection (e.g., rock->paper->scissor)
     */
    testSequenceDetection(battles) {
        if (battles.length < 3) return null;
        
        const sequences = {
            'rock,paper,scissor': 0,
            'rock,scissor,paper': 0,
            'paper,rock,scissor': 0,
            'paper,scissor,rock': 0,
            'scissor,rock,paper': 0,
            'scissor,paper,rock': 0
        };
        
        // Count 3-move sequences
        for (let i = 0; i < battles.length - 2; i++) {
            const seq = `${battles[i].enemyMove},${battles[i+1].enemyMove},${battles[i+2].enemyMove}`;
            if (sequences[seq] !== undefined) {
                sequences[seq]++;
            }
        }
        
        // Find dominant sequence
        let bestSeq = null;
        let maxCount = 0;
        
        for (const [seq, count] of Object.entries(sequences)) {
            if (count > maxCount) {
                maxCount = count;
                bestSeq = seq;
            }
        }
        
        const totalPossible = battles.length - 2;
        const seqRate = maxCount / Math.max(1, totalPossible);
        
        return {
            method: 'sequence',
            bestSequence: bestSeq,
            count: maxCount,
            rate: seqRate,
            hasPattern: seqRate > 0.2 // 20% or more
        };
    }
    
    /**
     * Test counter pattern (always counters our last move)
     */
    testCounterPattern(battles) {
        let counterCount = 0;
        let total = 0;
        
        const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        
        for (let i = 1; i < battles.length; i++) {
            const ourPrevious = battles[i-1].ourMove;
            const theirCurrent = battles[i].enemyMove;
            
            if (counters[ourPrevious] === theirCurrent) {
                counterCount++;
            }
            total++;
        }
        
        const counterRate = counterCount / Math.max(1, total);
        
        return {
            method: 'counter',
            rate: counterRate,
            hasPattern: counterRate > 0.5 // 50% or more
        };
    }
    
    /**
     * Test all methods on a dataset and return results
     */
    async testAllMethods(enemyId, battles, trainSize, testSize) {
        const trainData = battles.slice(0, trainSize);
        const testData = battles.slice(trainSize, trainSize + testSize);
        
        const results = {
            enemyId,
            trainSize,
            testSize,
            methods: {}
        };
        
        // 1. Test simple bias
        const biasResult = this.testBiasDetection(trainData);
        if (biasResult.hasBias) {
            let correct = 0;
            for (const battle of testData) {
                if (battle.enemyMove === biasResult.dominant) {
                    correct++;
                }
            }
            results.methods.bias = {
                accuracy: correct / testSize,
                confidence: biasResult.probability,
                description: `Biased toward ${biasResult.dominant} (${(biasResult.probability * 100).toFixed(0)}%)`
            };
        }
        
        // 2. Test sequence pattern
        const seqResult = this.testSequenceDetection(trainData);
        if (seqResult && seqResult.hasPattern) {
            const seqParts = seqResult.bestSequence.split(',');
            let correct = 0;
            let predictions = 0;
            
            for (let i = 2; i < testData.length; i++) {
                const prev2 = testData[i-2].enemyMove;
                const prev1 = testData[i-1].enemyMove;
                
                // Find if this matches the start of our sequence
                for (let j = 0; j < seqParts.length - 1; j++) {
                    if (seqParts[j] === prev2 && seqParts[j+1] === prev1) {
                        predictions++;
                        const predicted = seqParts[(j+2) % seqParts.length];
                        if (testData[i].enemyMove === predicted) {
                            correct++;
                        }
                        break;
                    }
                }
            }
            
            if (predictions > 0) {
                results.methods.sequence = {
                    accuracy: correct / predictions,
                    coverage: predictions / testSize,
                    description: `Sequence pattern: ${seqResult.bestSequence}`
                };
            }
        }
        
        // 3. Test counter pattern
        const counterResult = this.testCounterPattern(trainData);
        if (counterResult.hasPattern) {
            const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            let correct = 0;
            let predictions = 0;
            
            for (let i = 1; i < testData.length; i++) {
                const ourPrevious = testData[i-1].ourMove;
                const predicted = counters[ourPrevious];
                predictions++;
                if (testData[i].enemyMove === predicted) {
                    correct++;
                }
            }
            
            if (predictions > 0) {
                results.methods.counter = {
                    accuracy: correct / predictions,
                    confidence: counterResult.rate,
                    description: `Counters our moves ${(counterResult.rate * 100).toFixed(0)}% of the time`
                };
            }
        }
        
        // 4. Test Markov chains (simplified)
        const markovDetector = new AdaptiveMarkovDetector();
        const markovPattern = markovDetector.detectPattern(trainData);
        
        if (markovPattern && markovPattern.pattern) {
            // Extract the actual prediction
            const prediction = markovPattern.pattern.prediction;
            const context = markovPattern.pattern.context;
            
            let correct = 0;
            let predictions = 0;
            
            // Test on data
            for (let i = context.length; i < testData.length; i++) {
                // Check if context matches
                let contextMatch = true;
                for (let j = 0; j < context.length; j++) {
                    if (testData[i - context.length + j].enemyMove !== context[j]) {
                        contextMatch = false;
                        break;
                    }
                }
                
                if (contextMatch) {
                    predictions++;
                    if (testData[i].enemyMove === prediction) {
                        correct++;
                    }
                }
            }
            
            if (predictions > 0) {
                results.methods.markov = {
                    accuracy: correct / predictions,
                    coverage: predictions / testSize,
                    confidence: markovPattern.pattern.confidence,
                    description: markovPattern.description
                };
            }
        }
        
        // 5. Test RobustPatternDetector
        const robustDetector = new RobustPatternDetector();
        const profile = robustDetector.analyzeEnemy(enemyId, trainData);
        
        if (profile.type !== 'unknown' && profile.confidence > 0.3) {
            let correct = 0;
            let predictions = testSize;
            
            if (profile.type === 'fixed' || profile.type === 'biased') {
                // Predict dominant move
                for (const battle of testData) {
                    if (battle.enemyMove === profile.dominantMove) {
                        correct++;
                    }
                }
            }
            
            results.methods.robust = {
                accuracy: correct / predictions,
                confidence: profile.confidence,
                description: profile.description || `${profile.type} pattern`
            };
        }
        
        return results;
    }
    
    async runFinalEvaluation() {
        console.log('=' .repeat(70));
        console.log('FINAL PATTERN DETECTION EVALUATION');
        console.log('=' .repeat(70));
        
        // Get enemies with sufficient data
        const enemies = await this.engine.getEnemiesWithMinBattles(50);
        
        if (!enemies || enemies.length === 0) {
            console.log('No enemies with sufficient data');
            return;
        }
        
        console.log(`\nEvaluating ${Math.min(5, enemies.length)} enemies...\n`);
        
        const allResults = [];
        const methodStats = {};
        
        // Test each enemy
        for (const enemy of enemies.slice(0, 5)) {
            console.log(`\nEnemy ${enemy.enemy_id} (${enemy.battle_count} battles):`);
            console.log('-'.repeat(50));
            
            const battles = await this.engine.getBattleHistory(enemy.enemy_id, 150);
            
            if (!battles || battles.length < 50) continue;
            
            // Test at different points
            const testConfigs = [
                { name: 'early', train: 30, test: 10 },
                { name: 'mid', train: 60, test: 15 },
                { name: 'late', train: 100, test: 20 }
            ];
            
            for (const config of testConfigs) {
                if (config.train + config.test > battles.length) continue;
                
                const result = await this.testAllMethods(
                    enemy.enemy_id,
                    battles,
                    config.train,
                    config.test
                );
                
                console.log(`\n  ${config.name.toUpperCase()} (${config.train} train, ${config.test} test):`);
                
                for (const [method, stats] of Object.entries(result.methods)) {
                    console.log(`    ${method}: ${(stats.accuracy * 100).toFixed(1)}% accuracy`);
                    
                    // Aggregate stats
                    if (!methodStats[method]) {
                        methodStats[method] = { correct: 0, total: 0, samples: 0 };
                    }
                    methodStats[method].correct += stats.accuracy * config.test;
                    methodStats[method].total += config.test;
                    methodStats[method].samples++;
                }
                
                allResults.push(result);
            }
        }
        
        // Final summary
        console.log('\n' + '=' .repeat(70));
        console.log('OVERALL RESULTS');
        console.log('=' .repeat(70));
        
        const sortedMethods = Object.entries(methodStats)
            .map(([method, stats]) => ({
                method,
                accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
                samples: stats.samples
            }))
            .sort((a, b) => b.accuracy - a.accuracy);
        
        console.log('\n🏆 METHOD RANKINGS:');
        console.log('-'.repeat(40));
        
        sortedMethods.forEach((stats, i) => {
            const stars = '⭐'.repeat(Math.max(1, Math.round(stats.accuracy * 5)));
            console.log(`${i+1}. ${stats.method.padEnd(10)} ${(stats.accuracy * 100).toFixed(1)}% ${stars} (${stats.samples} tests)`);
        });
        
        // Recommendations
        console.log('\n📊 RECOMMENDATIONS:');
        console.log('-'.repeat(40));
        
        if (sortedMethods.length > 0) {
            const best = sortedMethods[0];
            const worst = sortedMethods[sortedMethods.length - 1];
            
            if (best.accuracy > 0.35) {
                console.log(`✅ Use ${best.method} - achieves ${(best.accuracy * 100).toFixed(1)}% accuracy`);
            }
            
            if (worst.accuracy < 0.25) {
                console.log(`❌ Avoid ${worst.method} - only ${(worst.accuracy * 100).toFixed(1)}% accuracy`);
            }
            
            // Check for ensemble opportunity
            const goodMethods = sortedMethods.filter(m => m.accuracy > 0.3);
            if (goodMethods.length > 1) {
                console.log(`🎯 Consider ensemble of: ${goodMethods.map(m => m.method).join(', ')}`);
            }
        }
        
        await this.engine.close();
        console.log('\n✅ Evaluation complete!');
    }
    
    async close() {
        await this.engine.close();
    }
}

// Add helper method to database engine
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

// Run the evaluation
async function main() {
    const evaluator = new FinalEvaluator();
    
    try {
        await evaluator.initialize();
        await evaluator.runFinalEvaluation();
    } catch (error) {
        console.error('❌ Evaluation failed:', error);
        await evaluator.close();
    }
}

main().catch(console.error);