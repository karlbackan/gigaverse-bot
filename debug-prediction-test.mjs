#!/usr/bin/env node
/**
 * Debug Prediction Test
 * Test what the prediction system is actually returning
 */

import { DecisionEngine } from './src/decision-engine.mjs';
import { config } from './src/config.mjs';

config.minimalOutput = false; // Enable full logging

async function testPredictionSystem() {
    console.log('🔍 DEBUGGING PREDICTION SYSTEM\n');
    
    const engine = new DecisionEngine();
    await engine.initializeMLState();
    
    // Test 1: What does predictNextMove actually return?
    console.log('📊 Test 1: Direct predictNextMove call');
    const prediction = await engine.statisticsEngine.predictNextMove(
        'test_enemy', 1, 100, 100,
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 },
        { health: 100 },
        { health: 100 }
    );
    
    console.log('Prediction object:', JSON.stringify(prediction, null, 2));
    
    // Test 2: What happens when we mock the prediction?
    console.log('\n📊 Test 2: Mocked prediction test');
    const mockPrediction = {
        predictions: { rock: 1.0, paper: 0, scissor: 0 }, // Enemy will play rock
        confidence: 1.0,
        weaponScores: { rock: 0, paper: 1.0, scissor: 0 } // Paper should win
    };
    
    const originalPredict = engine.statisticsEngine.predictNextMove;
    engine.statisticsEngine.predictNextMove = async () => mockPrediction;
    
    console.log('Mock prediction:', JSON.stringify(mockPrediction, null, 2));
    
    const decision = await engine.makeDecision(
        'test_enemy', 1, 100, 100,
        ['rock', 'paper', 'scissor'],
        { rock: 3, paper: 3, scissor: 3 },
        { health: 100 },
        { health: 100 }
    );
    
    console.log(`Decision: ${decision}`);
    console.log(`Expected: paper (to beat rock)`);
    console.log(`Correct: ${decision === 'paper' ? '✅' : '❌'}`);
    
    // Restore original method
    engine.statisticsEngine.predictNextMove = originalPredict;
}

testPredictionSystem().catch(console.error);