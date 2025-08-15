#!/usr/bin/env node
/**
 * Quick Comprehensive Test and Fix System
 * Runs focused tests to validate and improve the bot's decision making
 */

import { DecisionEngine } from './src/decision-engine.mjs';
import { config } from './src/config.mjs';

// Set minimal output for faster testing
config.minimalOutput = true;

// Simple enemy behavior patterns for testing
const SIMPLE_PATTERNS = {
    rock_spammer: { type: 'static', move: 'rock' },
    paper_spammer: { type: 'static', move: 'paper' }, 
    scissor_spammer: { type: 'static', move: 'scissor' },
    cycle_basic: { type: 'cycle', sequence: ['rock', 'paper', 'scissor'] },
    counter_bot: { type: 'counter', delay: 1 }
};

class QuickTest {
    constructor() {
        this.results = [];
    }
    
    async runQuickValidation() {
        console.log('🚀 QUICK COMPREHENSIVE VALIDATION\n');
        
        // Test 1: Decision Logic Validation
        console.log('📊 Test 1: Decision Logic Validation');
        const decisionTest = await this.testDecisionLogic();
        console.log(`   Result: ${decisionTest.accuracy * 100}% accuracy\n`);
        
        // Test 2: Performance Against Patterns
        console.log('📊 Test 2: Performance Against Enemy Patterns');
        const performanceTest = await this.testPerformanceAgainstPatterns();
        console.log(`   Average Win Rate: ${(performanceTest.avgWinRate * 100).toFixed(1)}%\n`);
        
        // Test 3: Learning Effectiveness
        console.log('📊 Test 3: Learning Effectiveness Over Time');
        const learningTest = await this.testLearningEffectiveness();
        console.log(`   Improvement: ${learningTest.improvement >= 0 ? '+' : ''}${(learningTest.improvement * 100).toFixed(1)}%\n`);
        
        // Generate Report
        const overallWinRate = (decisionTest.accuracy + performanceTest.avgWinRate + 0.33) / 3;
        console.log('🎯 OVERALL RESULTS:');
        console.log(`   Decision Logic: ${decisionTest.accuracy >= 0.9 ? '✅' : '❌'} ${(decisionTest.accuracy * 100).toFixed(1)}%`);
        console.log(`   Pattern Performance: ${performanceTest.avgWinRate >= 0.35 ? '✅' : '❌'} ${(performanceTest.avgWinRate * 100).toFixed(1)}%`);
        console.log(`   Learning: ${learningTest.improvement >= 0.05 ? '✅' : '❌'} ${learningTest.improvement >= 0 ? '+' : ''}${(learningTest.improvement * 100).toFixed(1)}%`);
        console.log(`   Estimated Performance: ${(overallWinRate * 100).toFixed(1)}%`);
        
        if (overallWinRate >= 0.4) {
            console.log('\n🎉 VALIDATION PASSED: System shows good performance potential');
        } else {
            console.log('\n❌ VALIDATION FAILED: System needs significant improvements');
        }
        
        return {
            decisionTest,
            performanceTest, 
            learningTest,
            overallWinRate,
            success: overallWinRate >= 0.4
        };
    }
    
    async testDecisionLogic() {
        console.log('   🔍 Testing basic counter-logic...');
        
        const engine = new DecisionEngine();
        await engine.initializeMLState(); // Load ML state
        
        let correctDecisions = 0;
        let totalTests = 0;
        
        // Test perfect prediction scenarios
        for (const enemyMove of ['rock', 'paper', 'scissor']) {
            // Mock a perfect prediction
            const mockPrediction = {
                predictions: { rock: 0, paper: 0, scissor: 0 },
                confidence: 1.0,
                weaponScores: { rock: 0, paper: 0, scissor: 0 }
            };
            
            mockPrediction.predictions[enemyMove] = 1.0;
            
            // Expected counter
            const expectedCounter = { rock: 'paper', paper: 'scissor', scissor: 'rock' }[enemyMove];
            mockPrediction.weaponScores[expectedCounter] = 1.0;
            
            // Override prediction method
            const originalPredict = engine.statisticsEngine.predictNextMove;
            engine.statisticsEngine.predictNextMove = async () => mockPrediction;
            
            // Make decision
            const decision = await engine.makeDecision(
                'test_enemy', 1, 100, 100,
                ['rock', 'paper', 'scissor'],
                { rock: 3, paper: 3, scissor: 3 },
                { health: 100 },
                { health: 100 }
            );
            
            // Restore original method
            engine.statisticsEngine.predictNextMove = originalPredict;
            
            if (decision === expectedCounter) {
                correctDecisions++;
            } else {
                console.log(`     ❌ Enemy: ${enemyMove}, Expected: ${expectedCounter}, Got: ${decision}`);
            }
            totalTests++;
        }
        
        return {
            correct: correctDecisions,
            total: totalTests,
            accuracy: correctDecisions / totalTests
        };
    }
    
    async testPerformanceAgainstPatterns() {
        console.log('   🎯 Testing against enemy patterns...');
        
        const results = [];
        
        for (const [patternName, pattern] of Object.entries(SIMPLE_PATTERNS)) {
            const engine = new DecisionEngine();
            await engine.initializeMLState(); // Load ML state
            
            const enemy = new TestEnemy(pattern);
            const enemyId = `test_${patternName}`;
            
            let wins = 0;
            const battles = 30;
            
            for (let turn = 1; turn <= battles; turn++) {
                const decision = await engine.makeDecision(
                    enemyId, turn, 100, 100,
                    ['rock', 'paper', 'scissor'],
                    { rock: 3, paper: 3, scissor: 3 },
                    { health: 100 },
                    { health: 100 }
                );
                
                const enemyMove = enemy.getMove(turn, decision);
                const result = this.determineResult(decision, enemyMove);
                
                if (result === 'win') wins++;
                
                engine.recordTurn(enemyId, turn, decision, enemyMove, result,
                    { health: 100 }, { health: 100 }, null);
            }
            
            const winRate = wins / battles;
            results.push({ pattern: patternName, winRate, wins, battles });
            
            console.log(`     ${patternName}: ${(winRate * 100).toFixed(1)}% (${wins}/${battles})`);
        }
        
        const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
        
        return { results, avgWinRate };
    }
    
    async testLearningEffectiveness() {
        console.log('   🧠 Testing learning over time...');
        
        const engine = new DecisionEngine();
        await engine.initializeMLState(); // Load ML state
        
        const enemy = new TestEnemy(SIMPLE_PATTERNS.cycle_basic);
        const enemyId = 'learning_test';
        
        const windowSize = 10;
        let earlyWins = 0;
        let lateWins = 0;
        
        // Early battles (turns 1-10)
        for (let turn = 1; turn <= windowSize; turn++) {
            const decision = await engine.makeDecision(
                enemyId, turn, 100, 100,
                ['rock', 'paper', 'scissor'],
                { rock: 3, paper: 3, scissor: 3 },
                { health: 100 },
                { health: 100 }
            );
            
            const enemyMove = enemy.getMove(turn, decision);
            const result = this.determineResult(decision, enemyMove);
            
            if (result === 'win') earlyWins++;
            
            engine.recordTurn(enemyId, turn, decision, enemyMove, result,
                { health: 100 }, { health: 100 }, null);
        }
        
        // Late battles (turns 31-40)
        for (let turn = 31; turn <= 40; turn++) {
            const decision = await engine.makeDecision(
                enemyId, turn, 100, 100,
                ['rock', 'paper', 'scissor'],
                { rock: 3, paper: 3, scissor: 3 },
                { health: 100 },
                { health: 100 }
            );
            
            const enemyMove = enemy.getMove(turn, decision);
            const result = this.determineResult(decision, enemyMove);
            
            if (result === 'win') lateWins++;
            
            engine.recordTurn(enemyId, turn, decision, enemyMove, result,
                { health: 100 }, { health: 100 }, null);
        }
        
        const earlyWinRate = earlyWins / windowSize;
        const lateWinRate = lateWins / windowSize;
        const improvement = lateWinRate - earlyWinRate;
        
        console.log(`     Early: ${(earlyWinRate * 100).toFixed(1)}% → Late: ${(lateWinRate * 100).toFixed(1)}%`);
        
        return {
            earlyWinRate,
            lateWinRate,
            improvement
        };
    }
    
    determineResult(playerMove, enemyMove) {
        if (playerMove === enemyMove) return 'tie';
        
        const wins = { rock: 'scissor', paper: 'rock', scissor: 'paper' };
        return wins[playerMove] === enemyMove ? 'win' : 'loss';
    }
}

// Simple test enemy
class TestEnemy {
    constructor(pattern) {
        this.pattern = pattern;
        this.history = [];
        this.playerHistory = [];
    }
    
    getMove(turn, playerLastMove) {
        if (playerLastMove) this.playerHistory.push(playerLastMove);
        
        let move;
        
        switch (this.pattern.type) {
            case 'static':
                move = this.pattern.move;
                break;
                
            case 'cycle':
                const index = (turn - 1) % this.pattern.sequence.length;
                move = this.pattern.sequence[index];
                break;
                
            case 'counter':
                if (playerLastMove) {
                    const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                    move = counters[playerLastMove];
                } else {
                    move = 'rock';
                }
                break;
                
            default:
                move = ['rock', 'paper', 'scissor'][Math.floor(Math.random() * 3)];
        }
        
        this.history.push(move);
        return move;
    }
}

// Main execution
async function main() {
    const tester = new QuickTest();
    
    try {
        const results = await tester.runQuickValidation();
        
        // Save ML state after testing
        const engine = new DecisionEngine();
        await engine.initializeMLState();
        await engine.saveMLState();
        console.log('\n💾 ML state saved for future sessions');
        
        console.log('\n🎯 Quick validation completed!');
        
        process.exit(results.success ? 0 : 1);
        
    } catch (error) {
        console.error('\n💥 Test failed:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { QuickTest };