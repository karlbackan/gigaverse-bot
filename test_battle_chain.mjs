#!/usr/bin/env node
/**
 * Test Battle Chain Analyzer with Enemy 23 data
 */

import { OptimizedDatabaseStatisticsEngine } from './src/database-statistics-engine-optimized.mjs';
import { BattleChainAnalyzer } from './src/battle-chain-analyzer.mjs';

async function testBattleChainAnalyzer() {
    console.log('\n' + '='.repeat(70));
    console.log('TESTING BATTLE CHAIN ANALYZER WITH ENEMY 23');
    console.log('='.repeat(70));
    
    const engine = new OptimizedDatabaseStatisticsEngine('./data/battle-statistics.db');
    const analyzer = new BattleChainAnalyzer();
    
    try {
        // Initialize the engine
        await engine.initializeAsync();
        console.log('✅ Database engine initialized');
        
        // Load battle history for Enemy 23
        console.log('\nLoading battle history for Enemy 23...');
        const battles = await engine.getBattleHistory(23, 200);
        
        if (!battles || battles.length === 0) {
            console.log('❌ No battles found for Enemy 23');
            await engine.close();
            return;
        }
        
        console.log(`✅ Loaded ${battles.length} battles`);
        
        // Group battles by battle series (detecting turn resets)
        const battleSeries = [];
        let currentSeries = [];
        
        for (let i = 0; i < battles.length; i++) {
            const battle = battles[i];
            
            // Check if this is a new battle (turn reset)
            if (currentSeries.length > 0 && battle.turn <= currentSeries[currentSeries.length - 1].turn) {
                // New battle detected, save current series
                if (currentSeries.length > 0) {
                    battleSeries.push([...currentSeries]);
                }
                currentSeries = [battle];
            } else {
                currentSeries.push(battle);
            }
        }
        
        // Don't forget the last series
        if (currentSeries.length > 0) {
            battleSeries.push(currentSeries);
        }
        
        console.log(`\n📊 Found ${battleSeries.length} distinct battle series`);
        
        // Summarize each battle
        console.log('\nBattle Summaries:');
        console.log('-'.repeat(50));
        
        for (let i = 0; i < Math.min(10, battleSeries.length); i++) {
            const series = battleSeries[i];
            const summary = analyzer.summarizeBattle(23, series);
            
            if (summary) {
                console.log(`Battle ${i + 1}: ${summary.outcome.toUpperCase()} ` +
                           `(${(summary.winRate * 100).toFixed(0)}% win rate) ` +
                           `Dominant: ${summary.dominantMove} (${(summary.dominantRate * 100).toFixed(0)}%) ` +
                           `[${summary.totalMoves} moves]`);
                
                // Add to analyzer's history
                if (!analyzer.battleSummaries.has(23)) {
                    analyzer.battleSummaries.set(23, []);
                }
                analyzer.battleSummaries.get(23).push(summary);
            }
        }
        
        // Test pattern detection
        console.log('\n' + '='.repeat(50));
        console.log('BATTLE CHAIN PATTERN ANALYSIS:');
        console.log('='.repeat(50));
        
        const chainAnalysis = analyzer.analyzeBattleChain(23);
        
        if (chainAnalysis.pattern === 'no_battle_chain_pattern') {
            console.log('❌ No battle chain pattern detected');
        } else if (chainAnalysis.pattern === 'insufficient_history') {
            console.log('⚠️ Insufficient battle history for chain analysis');
        } else {
            console.log(`\n✅ PATTERN DETECTED: ${chainAnalysis.pattern}`);
            console.log(`📊 Confidence: ${(chainAnalysis.confidence * 100).toFixed(0)}%`);
            console.log(`📝 Description: ${chainAnalysis.description}`);
            
            if (chainAnalysis.prediction) {
                console.log(`\n🎯 PREDICTION FOR NEXT BATTLE:`);
                console.log(`   Enemy likely to favor: ${chainAnalysis.prediction}`);
                console.log(`   Recommended counter: ${analyzer.getCounterMove(chainAnalysis.prediction)}`);
            }
        }
        
        // Test prediction for next battle
        console.log('\n' + '-'.repeat(50));
        const nextPrediction = analyzer.predictNextBattle(23);
        
        if (nextPrediction) {
            console.log('\n🔮 Next Battle Prediction:');
            console.log(`   Pattern: ${nextPrediction.pattern}`);
            console.log(`   Confidence: ${(nextPrediction.confidence * 100).toFixed(0)}%`);
            console.log(`   Enemy will likely play: ${nextPrediction.predictedDominant}`);
            console.log(`   You should play: ${nextPrediction.recommendation}`);
            console.log(`   ${nextPrediction.description}`);
        } else {
            console.log('\n⚠️ Unable to predict next battle strategy');
        }
        
        await engine.close();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        await engine.close();
        process.exit(1);
    }
}

// Run the test
testBattleChainAnalyzer().catch(console.error);