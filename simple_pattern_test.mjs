#!/usr/bin/env node
/**
 * Simple Pattern Detection Test
 * Tests each method's predictions against actual outcomes
 */

import { OptimizedDatabaseStatisticsEngine } from './src/database-statistics-engine-optimized.mjs';
import { RobustPatternDetector } from './src/robust-pattern-detector.mjs';
import { AdaptiveMarkovDetector } from './src/adaptive-markov-detector.mjs';
import { BattleChainAnalyzer } from './src/battle-chain-analyzer.mjs';

async function testPatternDetection() {
    console.log('=' .repeat(70));
    console.log('SIMPLE PATTERN DETECTION TEST');
    console.log('=' .repeat(70));
    
    const engine = new OptimizedDatabaseStatisticsEngine('./data/battle-statistics.db');
    
    try {
        await engine.initializeAsync();
        console.log('✅ Database initialized\n');
        
        // Test with Enemy 23 (known to have patterns)
        const enemyId = 23;
        const battles = await engine.getBattleHistory(enemyId, 200);
        
        if (!battles || battles.length < 50) {
            console.log('Insufficient data for testing');
            return;
        }
        
        console.log(`Testing with Enemy ${enemyId}: ${battles.length} battles loaded\n`);
        
        // Test 1: Robust Pattern Detector
        console.log('1. ROBUST PATTERN DETECTOR:');
        console.log('-'.repeat(40));
        
        const robustDetector = new RobustPatternDetector();
        const trainingSize = 100;
        const testSize = 20;
        
        // Use first 100 battles for pattern detection
        const trainingData = battles.slice(0, trainingSize);
        const testData = battles.slice(trainingSize, trainingSize + testSize);
        
        const enemyProfile = robustDetector.analyzeEnemy(enemyId, trainingData);
        console.log(`Pattern type: ${enemyProfile.type}`);
        console.log(`Confidence: ${(enemyProfile.confidence * 100).toFixed(1)}%`);
        
        if (enemyProfile.type !== 'unknown') {
            console.log(`Description: ${enemyProfile.description}`);
            
            // Test predictions
            let correct = 0;
            let predictions = 0;
            
            if (enemyProfile.type === 'fixed') {
                // Fixed pattern - always plays same move
                for (const battle of testData) {
                    predictions++;
                    if (battle.enemyMove === enemyProfile.dominantMove) {
                        correct++;
                    }
                }
            } else if (enemyProfile.type === 'biased') {
                // Biased pattern - mostly plays one move
                for (const battle of testData) {
                    predictions++;
                    if (battle.enemyMove === enemyProfile.dominantMove) {
                        correct++;
                    }
                }
            }
            
            if (predictions > 0) {
                console.log(`Accuracy: ${correct}/${predictions} = ${(correct/predictions * 100).toFixed(1)}%`);
            }
        }
        
        // Test 2: Adaptive Markov Detector
        console.log('\n2. ADAPTIVE MARKOV DETECTOR:');
        console.log('-'.repeat(40));
        
        const markovDetector = new AdaptiveMarkovDetector();
        
        // Test Markov predictions move by move
        let markovCorrect = 0;
        let markovPredictions = 0;
        
        for (let i = trainingSize; i < trainingSize + testSize - 1; i++) {
            // Use all history up to this point
            const history = battles.slice(0, i);
            const nextActual = battles[i].enemyMove;
            
            // Detect pattern and make prediction
            const markovResult = markovDetector.detectPattern(history);
            
            if (markovResult && markovResult.prediction) {
                markovPredictions++;
                if (markovResult.prediction === nextActual) {
                    markovCorrect++;
                }
                
                if (markovPredictions === 1) {
                    console.log(`Pattern: ${markovResult.pattern}`);
                    console.log(`Confidence: ${(markovResult.confidence * 100).toFixed(1)}%`);
                }
            }
        }
        
        if (markovPredictions > 0) {
            console.log(`Accuracy: ${markovCorrect}/${markovPredictions} = ${(markovCorrect/markovPredictions * 100).toFixed(1)}%`);
        } else {
            console.log('No predictions made');
        }
        
        // Test 3: Battle Chain Analyzer
        console.log('\n3. BATTLE CHAIN ANALYZER:');
        console.log('-'.repeat(40));
        
        const chainAnalyzer = new BattleChainAnalyzer();
        
        // Group battles into series
        const battleSeries = [];
        let currentSeries = [];
        
        for (const battle of trainingData) {
            if (currentSeries.length > 0 && battle.turn <= currentSeries[currentSeries.length - 1].turn) {
                // New battle series
                if (currentSeries.length > 0) {
                    battleSeries.push(currentSeries);
                }
                currentSeries = [battle];
            } else {
                currentSeries.push(battle);
            }
        }
        if (currentSeries.length > 0) {
            battleSeries.push(currentSeries);
        }
        
        console.log(`Found ${battleSeries.length} battle series`);
        
        if (battleSeries.length >= 3) {
            // Analyze first few battle series
            for (let i = 0; i < Math.min(5, battleSeries.length); i++) {
                const summary = chainAnalyzer.summarizeBattle(enemyId, battleSeries[i]);
                if (summary) {
                    console.log(`Battle ${i+1}: ${summary.outcome} (dominant: ${summary.dominantMove} ${(summary.dominantRate*100).toFixed(0)}%)`);
                }
            }
            
            // Make prediction
            const chainPrediction = chainAnalyzer.analyzeBattleChain(enemyId);
            if (chainPrediction.pattern !== 'insufficient_history' && chainPrediction.pattern !== 'no_battle_chain_pattern') {
                console.log(`\nPattern: ${chainPrediction.pattern}`);
                console.log(`Confidence: ${(chainPrediction.confidence * 100).toFixed(1)}%`);
                if (chainPrediction.prediction) {
                    console.log(`Next battle prediction: ${chainPrediction.prediction}`);
                    
                    // Test the prediction against the next battle series
                    const testSeries = [];
                    currentSeries = [];
                    for (const battle of testData) {
                        if (currentSeries.length > 0 && battle.turn <= currentSeries[currentSeries.length - 1].turn) {
                            if (currentSeries.length > 0) {
                                testSeries.push(currentSeries);
                            }
                            currentSeries = [battle];
                        } else {
                            currentSeries.push(battle);
                        }
                    }
                    if (currentSeries.length > 0) {
                        testSeries.push(currentSeries);
                    }
                    
                    if (testSeries.length > 0) {
                        const nextSummary = chainAnalyzer.summarizeBattle(enemyId, testSeries[0]);
                        if (nextSummary) {
                            console.log(`Actual next battle dominant: ${nextSummary.dominantMove}`);
                            if (nextSummary.dominantMove === chainPrediction.prediction) {
                                console.log('✅ Prediction correct!');
                            } else {
                                console.log('❌ Prediction incorrect');
                            }
                        }
                    }
                }
            } else {
                console.log('No battle chain pattern detected');
            }
        }
        
        // Test 4: Combined accuracy on sliding window
        console.log('\n4. COMBINED SLIDING WINDOW TEST:');
        console.log('-'.repeat(40));
        
        const windowSize = 30;
        const testWindows = 5;
        const results = {
            robust: { correct: 0, total: 0 },
            markov: { correct: 0, total: 0 },
            actual: { rock: 0, paper: 0, scissor: 0 }
        };
        
        for (let w = 0; w < testWindows; w++) {
            const startIdx = 50 + w * 20;
            const windowHistory = battles.slice(startIdx, startIdx + windowSize);
            const nextMove = battles[startIdx + windowSize]?.enemyMove;
            
            if (!nextMove) continue;
            
            // Count actual distribution
            results.actual[nextMove]++;
            
            // Test robust detector
            const profile = robustDetector.analyzeEnemy(enemyId, windowHistory);
            if (profile.dominantMove) {
                results.robust.total++;
                if (profile.dominantMove === nextMove) {
                    results.robust.correct++;
                }
            }
            
            // Test markov detector
            const markov = markovDetector.detectPattern(windowHistory);
            if (markov && markov.prediction) {
                results.markov.total++;
                if (markov.prediction === nextMove) {
                    results.markov.correct++;
                }
            }
        }
        
        console.log(`Tested ${testWindows} windows of ${windowSize} battles each\n`);
        
        console.log('Results:');
        if (results.robust.total > 0) {
            console.log(`Robust: ${results.robust.correct}/${results.robust.total} = ${(results.robust.correct/results.robust.total * 100).toFixed(1)}%`);
        }
        if (results.markov.total > 0) {
            console.log(`Markov: ${results.markov.correct}/${results.markov.total} = ${(results.markov.correct/results.markov.total * 100).toFixed(1)}%`);
        }
        
        const totalActual = Object.values(results.actual).reduce((a,b) => a+b, 0);
        console.log('\nActual distribution in test windows:');
        console.log(`Rock: ${(results.actual.rock/totalActual * 100).toFixed(1)}%`);
        console.log(`Paper: ${(results.actual.paper/totalActual * 100).toFixed(1)}%`);
        console.log(`Scissor: ${(results.actual.scissor/totalActual * 100).toFixed(1)}%`);
        
        await engine.close();
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        await engine.close();
    }
}

testPatternDetection().catch(console.error);