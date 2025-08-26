/**
 * Learning Evaluation Endpoints
 * Provides HTTP endpoints to monitor ML algorithm performance
 */

import { OptimizedDatabaseStatisticsEngine } from './database-statistics-engine-optimized.mjs';
import { createServer } from 'http';
import { parse } from 'url';

export class LearningEvaluationServer {
    constructor(port = 3001) {
        this.port = port;
        this.engine = new OptimizedDatabaseStatisticsEngine('./data/battle-statistics.db');
        this.server = null;
    }
    
    async initialize() {
        await this.engine.ensureInitialized();
        console.log('📊 Learning evaluation engine initialized');
    }
    
    async start() {
        await this.initialize();
        
        this.server = createServer(async (req, res) => {
            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Content-Type', 'application/json');
            
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            
            try {
                const urlParts = parse(req.url, true);
                const path = urlParts.pathname;
                const query = urlParts.query;
                
                let response;
                
                switch (path) {
                    case '/':
                        response = this.getEndpointList();
                        break;
                    case '/overall-performance':
                        response = await this.getOverallPerformance();
                        break;
                    case '/algorithm-comparison':
                        response = await this.getAlgorithmComparison();
                        break;
                    case '/enemy-performance':
                        response = await this.getEnemyPerformance(query.enemyId, query.dungeonId);
                        break;
                    case '/worst-predictions':
                        response = await this.getWorstPredictions(parseInt(query.limit) || 10);
                        break;
                    case '/learning-trends':
                        response = await this.getLearningTrends();
                        break;
                    case '/thompson-parameters':
                        response = await this.getThompsonParameters();
                        break;
                    case '/confidence-calibration':
                        response = await this.getConfidenceCalibration();
                        break;
                    case '/entropy-analysis':
                        response = await this.getEntropyAnalysis();
                        break;
                    default:
                        response = { error: 'Endpoint not found', available: this.getEndpointList() };
                        res.writeHead(404);
                }
                
                res.writeHead(200);
                res.end(JSON.stringify(response, null, 2));
                
            } catch (error) {
                console.error('❌ Endpoint error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ 
                    error: error.message,
                    timestamp: new Date().toISOString()
                }));
            }
        });
        
        this.server.listen(this.port, () => {
            console.log(`🌐 Learning Evaluation Server running at http://localhost:${this.port}`);
            console.log('📊 Available endpoints:');
            this.getEndpointList().endpoints.forEach(endpoint => {
                console.log(`   ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
            });
        });
    }
    
    getEndpointList() {
        return {
            title: 'Learning Evaluation API',
            version: '1.0',
            description: 'Monitor ML algorithm performance and learning effectiveness',
            endpoints: [
                { method: 'GET', path: '/', description: 'This endpoint list' },
                { method: 'GET', path: '/overall-performance', description: 'Overall system performance metrics' },
                { method: 'GET', path: '/algorithm-comparison', description: 'Compare individual algorithm accuracy rates' },
                { method: 'GET', path: '/enemy-performance?enemyId=24&dungeonId=1', description: 'Performance against specific enemy' },
                { method: 'GET', path: '/worst-predictions?limit=10', description: 'Most overconfident prediction failures' },
                { method: 'GET', path: '/learning-trends', description: 'Performance trends over time' },
                { method: 'GET', path: '/thompson-parameters', description: 'Thompson sampling beta distribution parameters' },
                { method: 'GET', path: '/confidence-calibration', description: 'How well confidence predicts success' },
                { method: 'GET', path: '/entropy-analysis', description: 'Enemy predictability classification analysis' }
            ]
        };
    }
    
    async getOverallPerformance() {
        const report = await this.engine.predictionEvaluator.getAlgorithmPerformanceReport();
        
        const totalPredictions = report.ensemble_total || 0;
        const ensembleAccuracy = totalPredictions > 0 ? (report.ensemble_correct / totalPredictions) : 0;
        
        return {
            title: 'Overall Learning Performance',
            timestamp: new Date().toISOString(),
            summary: {
                totalPredictions: totalPredictions,
                ensembleAccuracy: Math.round(ensembleAccuracy * 100) + '%',
                winRateImprovement: this.calculateWinRateImprovement(ensembleAccuracy),
                highConfidenceFailures: report.high_conf_failures || 0,
                systemStatus: this.getSystemHealthStatus(ensembleAccuracy, report.high_conf_failures)
            },
            algorithms: {
                markov1: {
                    accuracy: this.calculateAccuracy(report.markov_1_correct, report.markov_1_total),
                    avgConfidence: Math.round((report.markov_1_avg_confidence || 0) * 100) + '%',
                    totalPredictions: report.markov_1_total || 0
                },
                markov2: {
                    accuracy: this.calculateAccuracy(report.markov_2_correct, report.markov_2_total),
                    totalPredictions: report.markov_2_total || 0
                },
                markov3: {
                    accuracy: this.calculateAccuracy(report.markov_3_correct, report.markov_3_total),
                    totalPredictions: report.markov_3_total || 0
                },
                frequency: {
                    accuracy: this.calculateAccuracy(report.frequency_correct, report.frequency_total),
                    avgConfidence: Math.round((report.frequency_avg_confidence || 0) * 100) + '%',
                    totalPredictions: report.frequency_total || 0
                },
                weaponStats: {
                    accuracy: this.calculateAccuracy(report.stats_correct, report.stats_total),
                    totalPredictions: report.stats_total || 0
                }
            }
        };
    }
    
    async getAlgorithmComparison() {
        const algorithms = ['markov_1', 'markov_2', 'markov_3', 'frequency', 'stats', 'thompson'];
        const comparison = [];
        
        for (const algorithm of algorithms) {
            const performance = await this.engine.db.all(`
                SELECT 
                    COUNT(CASE WHEN prediction_correct = 1 THEN 1 END) as correct,
                    COUNT(*) as total,
                    AVG(ensemble_confidence) as avg_confidence
                FROM prediction_details pd
                WHERE pd.${algorithm}_prediction IS NOT NULL
            `);
            
            const data = performance[0] || { correct: 0, total: 0, avg_confidence: 0 };
            const accuracy = data.total > 0 ? data.correct / data.total : 0;
            
            comparison.push({
                algorithm: algorithm,
                accuracy: Math.round(accuracy * 100) + '%',
                correctPredictions: data.correct,
                totalPredictions: data.total,
                avgConfidence: Math.round((data.avg_confidence || 0) * 100) + '%',
                performance: this.getPerformanceRating(accuracy)
            });
        }
        
        // Sort by accuracy
        comparison.sort((a, b) => parseFloat(b.accuracy) - parseFloat(a.accuracy));
        
        return {
            title: 'Algorithm Performance Comparison',
            timestamp: new Date().toISOString(),
            topPerformer: comparison[0]?.algorithm || 'none',
            algorithms: comparison,
            insights: this.generateAlgorithmInsights(comparison)
        };
    }
    
    async getEnemyPerformance(enemyId, dungeonId) {
        if (!enemyId || !dungeonId) {
            return { error: 'Missing enemyId or dungeonId parameters' };
        }
        
        const report = await this.engine.predictionEvaluator.getAlgorithmPerformanceReport(enemyId, dungeonId);
        const entropy = await this.engine.calculateEnemyEntropyOptimized(enemyId);
        const classification = await this.engine.getEnemyClassification(enemyId);
        
        return {
            title: `Performance Against Enemy ${enemyId}`,
            enemy: {
                id: enemyId,
                dungeonId: dungeonId,
                entropy: Math.round(entropy * 1000) / 1000,
                classification: classification,
                predictability: this.getReadablePredictability(entropy)
            },
            performance: {
                ensembleAccuracy: this.calculateAccuracy(report.ensemble_correct, report.ensemble_total),
                totalBattles: report.ensemble_total || 0,
                avgConfidence: Math.round((report.ensemble_avg_confidence || 0) * 100) + '%',
                highConfFailures: report.high_conf_failures || 0
            },
            bestAlgorithm: this.findBestAlgorithmForEnemy(report),
            recommendations: this.getEnemyRecommendations(classification, entropy)
        };
    }
    
    async getWorstPredictions(limit = 10) {
        const worst = await this.engine.predictionEvaluator.getWorstPredictions(limit);
        
        return {
            title: `Top ${limit} Overconfident Failures`,
            timestamp: new Date().toISOString(),
            description: 'Predictions with highest confidence that were completely wrong',
            failures: worst.map(pred => ({
                enemy: pred.enemy_id,
                turn: pred.turn,
                predicted: pred.ensemble_prediction,
                actual: pred.actual_enemy_move,
                confidence: Math.round(pred.ensemble_confidence * 100) + '%',
                entropy: Math.round(pred.enemy_entropy * 1000) / 1000,
                analysis: this.analyzeFailure(pred)
            })),
            patterns: this.identifyFailurePatterns(worst)
        };
    }
    
    async getLearningTrends() {
        // Get performance over time by analyzing recent battles
        const recentBattles = await this.engine.db.all(`
            SELECT 
                DATE(timestamp/1000, 'unixepoch') as date,
                COUNT(CASE WHEN prediction_correct = 1 THEN 1 END) as correct,
                COUNT(*) as total,
                AVG(ensemble_confidence) as avg_confidence
            FROM prediction_details
            WHERE timestamp > ?
            GROUP BY DATE(timestamp/1000, 'unixepoch')
            ORDER BY date DESC
            LIMIT 30
        `, [Date.now() - (30 * 24 * 60 * 60 * 1000)]); // Last 30 days
        
        const trends = recentBattles.map(day => ({
            date: day.date,
            accuracy: Math.round((day.correct / day.total) * 100) + '%',
            battles: day.total,
            avgConfidence: Math.round(day.avg_confidence * 100) + '%'
        }));
        
        return {
            title: 'Learning Trends (Last 30 Days)',
            timestamp: new Date().toISOString(),
            trends: trends,
            analysis: this.analyzeTrends(trends),
            recommendations: this.getTrendRecommendations(trends)
        };
    }
    
    async getThompsonParameters() {
        const parameters = await this.engine.db.all(`
            SELECT 
                enemy_id,
                strategy_name,
                alpha_param,
                beta_param,
                total_predictions,
                (alpha_param / (alpha_param + beta_param)) as expected_accuracy
            FROM strategy_performance
            WHERE total_predictions > 5
            ORDER BY total_predictions DESC
            LIMIT 50
        `);
        
        return {
            title: 'Thompson Sampling Parameters',
            description: 'Beta distribution parameters for strategy selection',
            timestamp: new Date().toISOString(),
            parameters: parameters.map(p => ({
                enemy: p.enemy_id,
                strategy: p.strategy_name,
                alpha: Math.round(p.alpha_param * 100) / 100,
                beta: Math.round(p.beta_param * 100) / 100,
                expectedAccuracy: Math.round(p.expected_accuracy * 100) + '%',
                totalPredictions: p.total_predictions,
                confidence: this.getParameterConfidence(p.alpha_param, p.beta_param)
            })),
            insights: this.generateThompsonInsights(parameters)
        };
    }
    
    async getConfidenceCalibration() {
        // Analyze how well confidence predicts actual success
        const calibration = await this.engine.db.all(`
            SELECT 
                ROUND(ensemble_confidence * 10) / 10 as confidence_bucket,
                COUNT(CASE WHEN prediction_correct = 1 THEN 1 END) as correct,
                COUNT(*) as total
            FROM prediction_details
            WHERE ensemble_confidence IS NOT NULL
            GROUP BY confidence_bucket
            ORDER BY confidence_bucket
        `);
        
        const calibrationData = calibration.map(bucket => {
            const actualAccuracy = bucket.total > 0 ? bucket.correct / bucket.total : 0;
            const expectedAccuracy = bucket.confidence_bucket;
            const calibrationError = Math.abs(actualAccuracy - expectedAccuracy);
            
            return {
                confidenceBucket: Math.round(bucket.confidence_bucket * 100) + '%',
                expectedAccuracy: Math.round(expectedAccuracy * 100) + '%',
                actualAccuracy: Math.round(actualAccuracy * 100) + '%',
                calibrationError: Math.round(calibrationError * 100) + '%',
                sampleSize: bucket.total,
                isWellCalibrated: calibrationError < 0.1 // Within 10%
            };
        });
        
        return {
            title: 'Confidence Calibration Analysis',
            description: 'How well confidence levels predict actual success rates',
            timestamp: new Date().toISOString(),
            calibration: calibrationData,
            overallCalibration: this.assessOverallCalibration(calibrationData),
            recommendations: this.getCalibrationRecommendations(calibrationData)
        };
    }
    
    async getEntropyAnalysis() {
        const entropyData = await this.engine.db.all(`
            SELECT 
                classification,
                COUNT(*) as count,
                AVG(current_entropy) as avg_entropy,
                AVG(predictability_score) as avg_predictability
            FROM enemy_entropy_cache
            GROUP BY classification
        `);
        
        return {
            title: 'Enemy Entropy & Predictability Analysis',
            timestamp: new Date().toISOString(),
            classifications: entropyData.map(data => ({
                type: data.classification,
                enemyCount: data.count,
                avgEntropy: Math.round(data.avg_entropy * 1000) / 1000,
                avgPredictability: Math.round(data.avg_predictability * 100) + '%',
                description: this.getClassificationDescription(data.classification)
            })),
            insights: this.generateEntropyInsights(entropyData)
        };
    }
    
    // HELPER METHODS
    
    calculateAccuracy(correct, total) {
        return total > 0 ? Math.round((correct / total) * 100) + '%' : '0%';
    }
    
    calculateWinRateImprovement(currentAccuracy) {
        const baseline = 0.364; // 36.4% baseline
        const improvement = ((currentAccuracy - baseline) / baseline) * 100;
        return improvement > 0 ? `+${Math.round(improvement)}%` : `${Math.round(improvement)}%`;
    }
    
    getSystemHealthStatus(accuracy, highConfFailures) {
        if (accuracy > 0.55) return '🟢 Excellent';
        if (accuracy > 0.45) return '🟡 Good';
        if (accuracy > 0.35) return '🟠 Fair';
        return '🔴 Needs Improvement';
    }
    
    getPerformanceRating(accuracy) {
        if (accuracy > 0.6) return 'Excellent';
        if (accuracy > 0.5) return 'Good';
        if (accuracy > 0.4) return 'Fair';
        return 'Poor';
    }
    
    getReadablePredictability(entropy) {
        if (entropy < 1.0) return 'Highly Predictable';
        if (entropy < 1.3) return 'Moderately Predictable';  
        if (entropy < 1.5) return 'Somewhat Random';
        return 'Highly Random';
    }
    
    generateAlgorithmInsights(comparison) {
        const insights = [];
        const best = comparison[0];
        const worst = comparison[comparison.length - 1];
        
        insights.push(`${best.algorithm} is the top performer with ${best.accuracy} accuracy`);
        
        if (parseFloat(worst.accuracy) < 40) {
            insights.push(`${worst.algorithm} needs improvement - consider reducing its weight`);
        }
        
        return insights;
    }
    
    findBestAlgorithmForEnemy(report) {
        const algorithms = [
            { name: 'markov_1', correct: report.markov_1_correct, total: report.markov_1_total },
            { name: 'markov_2', correct: report.markov_2_correct, total: report.markov_2_total },
            { name: 'markov_3', correct: report.markov_3_correct, total: report.markov_3_total },
            { name: 'frequency', correct: report.frequency_correct, total: report.frequency_total },
            { name: 'stats', correct: report.stats_correct, total: report.stats_total }
        ];
        
        let bestAlgorithm = null;
        let bestAccuracy = 0;
        
        algorithms.forEach(alg => {
            if (alg.total > 3) { // Need minimum samples
                const accuracy = alg.correct / alg.total;
                if (accuracy > bestAccuracy) {
                    bestAccuracy = accuracy;
                    bestAlgorithm = alg.name;
                }
            }
        });
        
        return bestAlgorithm ? {
            algorithm: bestAlgorithm,
            accuracy: Math.round(bestAccuracy * 100) + '%'
        } : null;
    }
    
    getEnemyRecommendations(classification, entropy) {
        const recommendations = [];
        
        if (classification === 'predictable') {
            recommendations.push('Use Markov chains - this enemy has clear patterns');
            recommendations.push('Increase Markov chain weights in ensemble voting');
        } else if (classification === 'random') {
            recommendations.push('Focus on weapon stat correlations');
            recommendations.push('Reduce Markov chain influence');
        }
        
        return recommendations;
    }
    
    analyzeFailure(pred) {
        const analysis = [];
        
        if (pred.ensemble_confidence > 0.9) {
            analysis.push('Extremely overconfident prediction');
        }
        
        if (pred.enemy_entropy > 1.4) {
            analysis.push('Enemy is highly random - consider reducing confidence');
        }
        
        return analysis.join('. ');
    }
    
    identifyFailurePatterns(worst) {
        // Analyze patterns in worst predictions
        const patterns = {
            highEntropyFailures: worst.filter(w => w.enemy_entropy > 1.4).length,
            repeatOffenders: new Set(worst.map(w => w.enemy_id)).size,
            commonMistakes: {}
        };
        
        worst.forEach(pred => {
            const mistake = `${pred.ensemble_prediction}→${pred.actual_enemy_move}`;
            patterns.commonMistakes[mistake] = (patterns.commonMistakes[mistake] || 0) + 1;
        });
        
        return patterns;
    }
    
    analyzeTrends(trends) {
        if (trends.length < 3) return ['Insufficient data for trend analysis'];
        
        const recent = trends.slice(0, 7); // Last 7 days
        const older = trends.slice(7, 14); // 7-14 days ago
        
        const recentAvg = recent.reduce((sum, day) => sum + parseFloat(day.accuracy), 0) / recent.length;
        const olderAvg = older.reduce((sum, day) => sum + parseFloat(day.accuracy), 0) / older.length;
        
        const analysis = [];
        
        if (recentAvg > olderAvg + 5) {
            analysis.push('📈 Performance is improving over time');
        } else if (recentAvg < olderAvg - 5) {
            analysis.push('📉 Performance is declining - investigate algorithm weights');
        } else {
            analysis.push('📊 Performance is stable');
        }
        
        return analysis;
    }
    
    getTrendRecommendations(trends) {
        // Generate recommendations based on trends
        return [
            'Monitor daily performance for early detection of issues',
            'Compare algorithm performance across different time periods',
            'Adjust ensemble weights based on recent performance data'
        ];
    }
    
    generateThompsonInsights(parameters) {
        const insights = [];
        
        const highConfidence = parameters.filter(p => p.total_predictions > 20);
        if (highConfidence.length > 0) {
            insights.push(`${highConfidence.length} strategies have high-confidence parameters (>20 samples)`);
        }
        
        const underperforming = parameters.filter(p => p.expected_accuracy < 0.4);
        if (underperforming.length > 0) {
            insights.push(`${underperforming.length} strategies are underperforming and may need attention`);
        }
        
        return insights;
    }
    
    getParameterConfidence(alpha, beta) {
        const total = alpha + beta;
        if (total > 50) return 'High';
        if (total > 20) return 'Medium';
        return 'Low';
    }
    
    assessOverallCalibration(calibrationData) {
        const wellCalibrated = calibrationData.filter(d => d.isWellCalibrated).length;
        const total = calibrationData.length;
        
        const percentage = Math.round((wellCalibrated / total) * 100);
        
        if (percentage > 80) return `🟢 Well calibrated (${percentage}% of confidence buckets)`;
        if (percentage > 60) return `🟡 Reasonably calibrated (${percentage}% of confidence buckets)`;
        return `🔴 Poorly calibrated (${percentage}% of confidence buckets)`;
    }
    
    getCalibrationRecommendations(calibrationData) {
        const recommendations = [];
        
        const overconfident = calibrationData.filter(d => 
            parseFloat(d.expectedAccuracy) > parseFloat(d.actualAccuracy) + 10
        );
        
        if (overconfident.length > 0) {
            recommendations.push('System is overconfident - consider reducing confidence multipliers');
        }
        
        return recommendations.length > 0 ? recommendations : ['Confidence calibration looks reasonable'];
    }
    
    getClassificationDescription(classification) {
        const descriptions = {
            'predictable': 'Enemy follows clear patterns - Markov chains work well',
            'semi-predictable': 'Enemy has some patterns but also randomness',
            'random': 'Enemy behavior is mostly random - use stat-based predictions',
            'adaptive': 'Enemy may be learning and adapting to your strategy'
        };
        
        return descriptions[classification] || 'Unknown enemy type';
    }
    
    generateEntropyInsights(entropyData) {
        const insights = [];
        
        const predictable = entropyData.find(d => d.classification === 'predictable');
        if (predictable) {
            insights.push(`${predictable.count} predictable enemies - perfect for Markov chain learning`);
        }
        
        const random = entropyData.find(d => d.classification === 'random');
        if (random) {
            insights.push(`${random.count} random enemies - rely on weapon stat correlations`);
        }
        
        return insights;
    }
    
    async stop() {
        if (this.server) {
            this.server.close();
            console.log('🛑 Learning evaluation server stopped');
        }
        
        if (this.engine) {
            await this.engine.close();
        }
    }
}

// Export for use as module or run standalone
export default LearningEvaluationServer;