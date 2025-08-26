/**
 * Prediction Evaluation System
 * Tracks individual algorithm performance for analysis and feedback
 */

export class PredictionEvaluator {
    constructor(database) {
        this.db = database;
        this.currentPredictions = new Map(); // Store predictions before outcome
    }
    
    // Convert battle ID string to integer hash for database storage
    hashBattleId(battleIdString) {
        let hash = 0;
        const str = String(battleIdString);
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    
    // Store all individual algorithm predictions before battle
    async recordAlgorithmPredictions(battleId, enemyId, dungeonId, turn, predictions) {
        // Convert battle ID to integer hash for database storage
        const battleIdHash = this.hashBattleId(battleId);
        
        const predictionData = {
            battle_id: battleIdHash,
            enemy_id: enemyId,
            dungeon_id: dungeonId,
            turn: turn,
            
            // Individual algorithm results
            markov_1_prediction: predictions.markov1?.move || null,
            markov_1_confidence: predictions.markov1?.confidence || 0,
            markov_2_prediction: predictions.markov2?.move || null,
            markov_2_confidence: predictions.markov2?.confidence || 0,
            markov_3_prediction: predictions.markov3?.move || null,
            markov_3_confidence: predictions.markov3?.confidence || 0,
            
            frequency_prediction: predictions.frequency?.move || null,
            frequency_confidence: predictions.frequency?.confidence || 0,
            
            stats_prediction: predictions.stats?.move || null,
            stats_confidence: predictions.stats?.confidence || 0,
            
            thompson_prediction: predictions.thompson || null,
            
            // Final ensemble result
            ensemble_prediction: predictions.ensemble,
            ensemble_confidence: predictions.ensembleConfidence || 0,
            
            // Enemy characteristics
            enemy_entropy: predictions.entropy || 1.5,
            enemy_predictability: predictions.classification || 'unknown',
            
            timestamp: Date.now()
        };
        
        // Store for later evaluation
        this.currentPredictions.set(battleId, predictionData);
        
        return predictionData;
    }
    
    // Evaluate predictions after battle outcome is known
    async evaluatePredictions(battleId, actualEnemyMove) {
        const predictionData = this.currentPredictions.get(battleId);
        if (!predictionData) {
            console.log(`⚠️  No prediction data found for battle ${battleId}`);
            return;
        }
        
        // Add actual outcome
        predictionData.actual_enemy_move = actualEnemyMove;
        predictionData.prediction_correct = predictionData.ensemble_prediction === actualEnemyMove ? 1 : 0;
        
        // Store in database
        await this.storePredictionEvaluation(predictionData);
        
        // Analyze individual algorithm performance
        const analysis = this.analyzeAlgorithmPerformance(predictionData);
        
        // Update algorithm performance metrics
        await this.updateAlgorithmMetrics(predictionData, analysis);
        
        // Log significant failures/successes
        this.logNotableResults(predictionData, analysis);
        
        // Clean up
        this.currentPredictions.delete(battleId);
        
        return analysis;
    }
    
    async storePredictionEvaluation(data) {
        try {
            await this.db.run(`
                INSERT INTO prediction_details (
                    battle_id, enemy_id, dungeon_id, turn,
                    markov_1_prediction, markov_1_confidence,
                    markov_2_prediction, markov_2_confidence,
                    markov_3_prediction, markov_3_confidence,
                    frequency_prediction, frequency_confidence,
                    stats_prediction, stats_confidence,
                    thompson_prediction,
                    ensemble_prediction, ensemble_confidence,
                    actual_enemy_move, prediction_correct,
                    enemy_entropy, enemy_predictability, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.battle_id, data.enemy_id, data.dungeon_id, data.turn,
                data.markov_1_prediction, data.markov_1_confidence,
                data.markov_2_prediction, data.markov_2_confidence,
                data.markov_3_prediction, data.markov_3_confidence,
                data.frequency_prediction, data.frequency_confidence,
                data.stats_prediction, data.stats_confidence,
                data.thompson_prediction,
                data.ensemble_prediction, data.ensemble_confidence,
                data.actual_enemy_move, data.prediction_correct,
                data.enemy_entropy, data.enemy_predictability, data.timestamp
            ]);
        } catch (error) {
            console.error('❌ Failed to store prediction evaluation:', error);
        }
    }
    
    analyzeAlgorithmPerformance(data) {
        const algorithms = [
            { name: 'markov_1', prediction: data.markov_1_prediction, confidence: data.markov_1_confidence },
            { name: 'markov_2', prediction: data.markov_2_prediction, confidence: data.markov_2_confidence },
            { name: 'markov_3', prediction: data.markov_3_prediction, confidence: data.markov_3_confidence },
            { name: 'frequency', prediction: data.frequency_prediction, confidence: data.frequency_confidence },
            { name: 'stats_enhanced', prediction: data.stats_prediction, confidence: data.stats_confidence },
            { name: 'thompson_sampling', prediction: data.thompson_prediction, confidence: 0.5 }, // Default confidence
        ];
        
        const analysis = {
            correct: [],
            incorrect: [],
            overconfident: [], // High confidence but wrong
            missed_opportunities: [], // Low confidence but would have been right
            ensemble_analysis: {
                correct: data.prediction_correct === 1,
                confidence: data.ensemble_confidence,
                actual_move: data.actual_enemy_move
            }
        };
        
        algorithms.forEach(alg => {
            if (!alg.prediction) return;
            
            const wasCorrect = alg.prediction === data.actual_enemy_move;
            const result = {
                algorithm: alg.name,
                prediction: alg.prediction,
                confidence: alg.confidence,
                correct: wasCorrect
            };
            
            if (wasCorrect) {
                analysis.correct.push(result);
            } else {
                analysis.incorrect.push(result);
                
                // Flag overconfident failures (>70% confidence but wrong)
                if (alg.confidence > 0.7) {
                    analysis.overconfident.push(result);
                }
            }
            
            // Check if algorithm would have been right but had low confidence
            if (wasCorrect && alg.confidence < 0.4) {
                analysis.missed_opportunities.push(result);
            }
        });
        
        return analysis;
    }
    
    async updateAlgorithmMetrics(data, analysis) {
        // Update strategy performance for feedback loop
        for (const alg of [...analysis.correct, ...analysis.incorrect]) {
            const success = alg.correct ? 1 : 0;
            const failure = alg.correct ? 0 : 1;
            
            await this.db.run(`
                INSERT OR REPLACE INTO strategy_performance (
                    enemy_id, dungeon_id, strategy_name, 
                    successes, failures, total_predictions,
                    alpha_param, beta_param, confidence_level, last_updated
                ) VALUES (
                    ?, ?, ?, 
                    COALESCE((SELECT successes FROM strategy_performance 
                             WHERE enemy_id = ? AND dungeon_id = ? AND strategy_name = ?), 0) + ?,
                    COALESCE((SELECT failures FROM strategy_performance 
                             WHERE enemy_id = ? AND dungeon_id = ? AND strategy_name = ?), 0) + ?,
                    COALESCE((SELECT total_predictions FROM strategy_performance 
                             WHERE enemy_id = ? AND dungeon_id = ? AND strategy_name = ?), 0) + 1,
                    COALESCE((SELECT successes FROM strategy_performance 
                             WHERE enemy_id = ? AND dungeon_id = ? AND strategy_name = ?), 0) + ? + 1,
                    COALESCE((SELECT failures FROM strategy_performance 
                             WHERE enemy_id = ? AND dungeon_id = ? AND strategy_name = ?), 0) + ? + 1,
                    ?, ?
                )
            `, [
                data.enemy_id, data.dungeon_id, alg.algorithm,
                data.enemy_id, data.dungeon_id, alg.algorithm, success,
                data.enemy_id, data.dungeon_id, alg.algorithm, failure,
                data.enemy_id, data.dungeon_id, alg.algorithm,
                data.enemy_id, data.dungeon_id, alg.algorithm, success,
                data.enemy_id, data.dungeon_id, alg.algorithm, failure,
                alg.confidence, Date.now()
            ]);
        }
    }
    
    logNotableResults(data, analysis) {
        const enemyId = data.enemy_id;
        const turn = data.turn;
        const ensemble = analysis.ensemble_analysis;
        
        // Log overconfident failures (high confidence but wrong)
        if (analysis.overconfident.length > 0) {
            console.log(`⚠️  OVERCONFIDENT FAILURE - Enemy ${enemyId} T${turn}:`);
            analysis.overconfident.forEach(fail => {
                console.log(`   ${fail.algorithm}: predicted ${fail.prediction} (${(fail.confidence*100).toFixed(0)}% confident) - WRONG! Actual: ${data.actual_enemy_move}`);
            });
        }
        
        // Log when ensemble was very confident but wrong
        if (!ensemble.correct && ensemble.confidence > 0.8) {
            console.log(`🚨 HIGH-CONFIDENCE ENSEMBLE FAILURE - Enemy ${enemyId} T${turn}: predicted ${data.ensemble_prediction} (${(ensemble.confidence*100).toFixed(0)}% confident), actual: ${ensemble.actual_move}`);
        }
        
        // Log missed opportunities (algorithm was right but had low confidence)
        if (analysis.missed_opportunities.length > 0) {
            console.log(`💡 MISSED OPPORTUNITY - Enemy ${enemyId} T${turn}:`);
            analysis.missed_opportunities.forEach(miss => {
                console.log(`   ${miss.algorithm}: correctly predicted ${miss.prediction} but only ${(miss.confidence*100).toFixed(0)}% confident`);
            });
        }
        
        // Log perfect predictions (multiple algorithms agree and correct)
        if (ensemble.correct && analysis.correct.length >= 3) {
            console.log(`🎯 STRONG CONSENSUS - Enemy ${enemyId} T${turn}: ${analysis.correct.length} algorithms agreed on ${data.ensemble_prediction} - CORRECT!`);
        }
    }
    
    // Analysis tools for post-battle review
    async getAlgorithmPerformanceReport(enemyId = null, dungeonId = null) {
        let whereClause = '';
        let params = [];
        
        if (enemyId && dungeonId) {
            whereClause = 'WHERE enemy_id = ? AND dungeon_id = ?';
            params = [enemyId, dungeonId];
        }
        
        const report = await this.db.all(`
            SELECT 
                -- Markov performance
                COUNT(CASE WHEN markov_1_prediction = actual_enemy_move THEN 1 END) as markov_1_correct,
                COUNT(CASE WHEN markov_1_prediction IS NOT NULL THEN 1 END) as markov_1_total,
                AVG(CASE WHEN markov_1_prediction IS NOT NULL THEN markov_1_confidence END) as markov_1_avg_confidence,
                
                COUNT(CASE WHEN markov_2_prediction = actual_enemy_move THEN 1 END) as markov_2_correct,
                COUNT(CASE WHEN markov_2_prediction IS NOT NULL THEN 1 END) as markov_2_total,
                
                COUNT(CASE WHEN markov_3_prediction = actual_enemy_move THEN 1 END) as markov_3_correct,
                COUNT(CASE WHEN markov_3_prediction IS NOT NULL THEN 1 END) as markov_3_total,
                
                -- Frequency performance
                COUNT(CASE WHEN frequency_prediction = actual_enemy_move THEN 1 END) as frequency_correct,
                COUNT(CASE WHEN frequency_prediction IS NOT NULL THEN 1 END) as frequency_total,
                AVG(CASE WHEN frequency_prediction IS NOT NULL THEN frequency_confidence END) as frequency_avg_confidence,
                
                -- Stats performance
                COUNT(CASE WHEN stats_prediction = actual_enemy_move THEN 1 END) as stats_correct,
                COUNT(CASE WHEN stats_prediction IS NOT NULL THEN 1 END) as stats_total,
                
                -- Ensemble performance
                COUNT(CASE WHEN prediction_correct = 1 THEN 1 END) as ensemble_correct,
                COUNT(*) as ensemble_total,
                AVG(ensemble_confidence) as ensemble_avg_confidence,
                
                -- Overconfidence analysis
                COUNT(CASE WHEN ensemble_confidence > 0.8 AND prediction_correct = 0 THEN 1 END) as high_conf_failures
                
            FROM prediction_details
            ${whereClause}
        `, params);
        
        return report[0] || {};
    }
    
    async getWorstPredictions(limit = 10) {
        return await this.db.all(`
            SELECT enemy_id, turn, ensemble_prediction, actual_enemy_move,
                   ensemble_confidence, enemy_entropy
            FROM prediction_details
            WHERE prediction_correct = 0 AND ensemble_confidence > 0.7
            ORDER BY ensemble_confidence DESC
            LIMIT ?
        `, [limit]);
    }
}

export default PredictionEvaluator;