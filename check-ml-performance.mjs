#!/usr/bin/env node
/**
 * Check ML Performance with New Engine
 */

import { LearningEvaluationServer } from './src/learning-evaluation-endpoints.mjs';

async function checkPerformance() {
    console.log('🎯 ML PERFORMANCE CHECK\n');
    
    const server = new LearningEvaluationServer();
    await server.initialize();
    
    // Force initialization of prediction evaluator
    if (!server.engine.predictionEvaluator) {
        const { PredictionEvaluator } = await import('./src/prediction-evaluator.mjs');
        server.engine.predictionEvaluator = new PredictionEvaluator(server.engine.db);
    }
    
    // Get overall performance
    const overall = await server.getOverallPerformance();
    console.log('📊 OVERALL PERFORMANCE');
    console.log(`System Status: ${overall.summary.systemStatus}`);
    console.log(`Total Predictions: ${overall.summary.totalPredictions}`);
    console.log(`Ensemble Accuracy: ${overall.summary.ensembleAccuracy}`);
    console.log();
    
    // Get algorithm comparison
    const algorithms = await server.getAlgorithmComparison();
    console.log('🔬 ALGORITHM COMPARISON');
    algorithms.algorithms.forEach(alg => {
        if (alg.totalPredictions > 0) {
            console.log(`${alg.algorithm}: ${alg.accuracy} (${alg.totalPredictions} predictions)`);
        }
    });
    
    await server.stop();
}

checkPerformance().catch(console.error);