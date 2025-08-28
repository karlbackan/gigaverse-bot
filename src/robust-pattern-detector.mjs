/**
 * Robust Pattern Detection System - Designed to Avoid Overfitting
 * 
 * Key principles:
 * 1. Use simple, generalizable patterns (not specific percentages)
 * 2. Require statistical significance before acting
 * 3. Online learning - adapt as we play
 * 4. Conservative confidence thresholds
 * 5. Validate patterns before trusting them
 * 6. Adaptive Markov order - use Markov-3 when enough data available
 */

import { AdaptiveMarkovDetector } from './adaptive-markov-detector.mjs';

export class RobustPatternDetector {
    constructor() {
        // Track patterns with confidence intervals
        this.patterns = new Map();
        
        // Conservative thresholds
        this.MIN_SAMPLES = 15;  // Need 15+ battles before detecting
        this.CONFIDENCE_THRESHOLD = 0.95;  // 95% confidence interval
        this.SIGNIFICANCE_LEVEL = 0.05;  // p < 0.05 for significance
        
        // Online learning parameters
        this.learningRate = 0.1;  // How fast we adapt
        this.decayRate = 0.95;  // How fast old data loses weight
        
        // Adaptive Markov chain detector
        this.markovDetector = new AdaptiveMarkovDetector();
    }
    
    /**
     * Analyze enemy with statistical rigor
     */
    analyzeEnemy(enemyId, battles) {
        if (!battles || battles.length < this.MIN_SAMPLES) {
            return {
                pattern: 'insufficient_data',
                confidence: 0,
                recommendation: 'play_defensively'
            };
        }
        
        // Get or initialize pattern tracking
        let tracker = this.patterns.get(enemyId) || {
            observations: [],
            hypotheses: new Map(),
            validated: null
        };
        
        // Update observations with exponential decay (recent matters more)
        this.updateObservations(tracker, battles);
        
        // Test simple hypotheses
        const hypotheses = this.testHypotheses(tracker.observations);
        
        // Validate strongest hypothesis
        const validated = this.validatePattern(hypotheses, battles);
        
        // Store results
        tracker.validated = validated;
        this.patterns.set(enemyId, tracker);
        
        return this.getRecommendation(validated, battles);
    }
    
    /**
     * Update observations with exponential decay weighting
     */
    updateObservations(tracker, battles) {
        // Weight recent battles more heavily
        tracker.observations = [];
        const totalBattles = battles.length;
        
        battles.forEach((battle, index) => {
            const age = totalBattles - index;
            const weight = Math.pow(this.decayRate, age);
            
            tracker.observations.push({
                ...battle,
                weight: weight
            });
        });
    }
    
    /**
     * Test simple, robust hypotheses
     */
    testHypotheses(observations) {
        const hypotheses = new Map();
        
        // Hypothesis 1: Fixed bias (plays one move significantly more)
        const bias = this.testBiasHypothesis(observations);
        if (bias.significant) {
            hypotheses.set('bias', bias);
        }
        
        // Hypothesis 2: Reactive (responds to our moves)
        const reactive = this.testReactiveHypothesis(observations);
        if (reactive.significant) {
            hypotheses.set('reactive', reactive);
        }
        
        // Hypothesis 3: Markov chains (adaptive order based on data)
        const markovPattern = this.markovDetector.detectPattern(
            observations.map(o => ({ enemyMove: o.enemyMove, ourMove: o.ourMove }))
        );
        if (markovPattern) {
            hypotheses.set('markov', markovPattern);
        }
        
        // Hypothesis 4: Result-based (changes after win/loss)
        const resultBased = this.testResultBasedHypothesis(observations);
        if (resultBased.significant) {
            hypotheses.set('result_based', resultBased);
        }
        
        return hypotheses;
    }
    
    /**
     * Test if enemy has significant bias toward one move
     */
    testBiasHypothesis(observations) {
        const counts = { rock: 0, paper: 0, scissor: 0 };
        let totalWeight = 0;
        
        observations.forEach(obs => {
            counts[obs.enemyMove] += obs.weight;
            totalWeight += obs.weight;
        });
        
        // Calculate proportions
        const proportions = {};
        for (const move in counts) {
            proportions[move] = counts[move] / totalWeight;
        }
        
        // Chi-square test for uniformity
        const expected = totalWeight / 3;
        let chiSquare = 0;
        
        for (const move in counts) {
            const diff = counts[move] - expected;
            chiSquare += (diff * diff) / expected;
        }
        
        // Critical value for p=0.05, df=2
        const criticalValue = 5.991;
        const significant = chiSquare > criticalValue;
        
        // Find dominant move
        let dominant = null;
        let maxProp = 0;
        for (const move in proportions) {
            if (proportions[move] > maxProp) {
                maxProp = proportions[move];
                dominant = move;
            }
        }
        
        return {
            significant: significant && maxProp > 0.4,  // Need 40%+ for one move
            dominant: dominant,
            proportion: maxProp,
            chiSquare: chiSquare,
            confidence: significant ? Math.min(0.95, maxProp * 1.5) : 0
        };
    }
    
    /**
     * Test if enemy reacts to our moves
     */
    testReactiveHypothesis(observations) {
        if (observations.length < 2) {
            return { significant: false };
        }
        
        // Count reaction patterns
        let counterCount = 0;
        let copyCount = 0;
        let totalTransitions = 0;
        let totalWeight = 0;
        
        for (let i = 1; i < observations.length; i++) {
            const prev = observations[i - 1];
            const curr = observations[i];
            const weight = Math.min(prev.weight, curr.weight);
            
            const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            
            if (curr.enemyMove === counter[prev.ourMove]) {
                counterCount += weight;
            }
            if (curr.enemyMove === prev.ourMove) {
                copyCount += weight;
            }
            
            totalTransitions++;
            totalWeight += weight;
        }
        
        const counterRate = counterCount / totalWeight;
        const copyRate = copyCount / totalWeight;
        
        // Binomial test against random (33.3%)
        const expectedRate = 1/3;
        const stdError = Math.sqrt(expectedRate * (1 - expectedRate) / totalTransitions);
        const zScoreCounter = (counterRate - expectedRate) / stdError;
        const zScoreCopy = (copyRate - expectedRate) / stdError;
        
        // Critical value for p=0.05 (one-tailed)
        const criticalZ = 1.645;
        
        const isCounter = zScoreCounter > criticalZ;
        const isCopier = zScoreCopy > criticalZ;
        
        return {
            significant: isCounter || isCopier,
            type: isCounter ? 'counter' : (isCopier ? 'copier' : null),
            rate: isCounter ? counterRate : copyRate,
            zScore: Math.max(zScoreCounter, zScoreCopy),
            confidence: (isCounter || isCopier) ? Math.min(0.9, 0.5 + Math.abs(zScoreCounter) * 0.1) : 0
        };
    }
    
    /**
     * Test for sequential patterns
     */
    testSequentialHypothesis(observations) {
        if (observations.length < 4) {
            return { significant: false };
        }
        
        // Look for 2-move sequences
        const sequences = new Map();
        let totalWeight = 0;
        
        for (let i = 1; i < observations.length; i++) {
            const seq = `${observations[i-1].enemyMove}-${observations[i].enemyMove}`;
            const weight = Math.min(observations[i-1].weight, observations[i].weight);
            
            sequences.set(seq, (sequences.get(seq) || 0) + weight);
            totalWeight += weight;
        }
        
        // Find dominant sequence
        let maxSeq = null;
        let maxCount = 0;
        
        for (const [seq, count] of sequences) {
            if (count > maxCount) {
                maxCount = count;
                maxSeq = seq;
            }
        }
        
        const seqRate = maxCount / totalWeight;
        
        // Test if significantly above random (1/9 for any specific sequence)
        const expectedRate = 1/9;
        const stdError = Math.sqrt(expectedRate * (1 - expectedRate) / (observations.length - 1));
        const zScore = (seqRate - expectedRate) / stdError;
        
        return {
            significant: zScore > 2.326 && seqRate > 0.2,  // p < 0.01 and >20% occurrence
            sequence: maxSeq,
            rate: seqRate,
            zScore: zScore,
            confidence: zScore > 2.326 ? Math.min(0.8, seqRate * 2) : 0
        };
    }
    
    /**
     * Test if behavior changes based on results
     */
    testResultBasedHypothesis(observations) {
        const afterWin = { repeat: 0, change: 0 };
        const afterLoss = { repeat: 0, change: 0 };
        
        for (let i = 1; i < observations.length; i++) {
            const prev = observations[i - 1];
            const curr = observations[i];
            const weight = Math.min(prev.weight, curr.weight);
            
            if (prev.result === 'loss') {  // Enemy lost
                if (curr.enemyMove === prev.enemyMove) {
                    afterLoss.repeat += weight;
                } else {
                    afterLoss.change += weight;
                }
            } else if (prev.result === 'win') {  // Enemy won
                if (curr.enemyMove === prev.enemyMove) {
                    afterWin.repeat += weight;
                } else {
                    afterWin.change += weight;
                }
            }
        }
        
        const lossRepeatRate = afterLoss.repeat / (afterLoss.repeat + afterLoss.change + 0.001);
        const winRepeatRate = afterWin.repeat / (afterWin.repeat + afterWin.change + 0.001);
        
        // Test if significantly different from 50%
        const totalLoss = afterLoss.repeat + afterLoss.change;
        const totalWin = afterWin.repeat + afterWin.change;
        
        let significant = false;
        let pattern = null;
        let rate = 0;
        
        if (totalLoss > 5) {
            const stdError = Math.sqrt(0.5 * 0.5 / totalLoss);
            const zScore = Math.abs(lossRepeatRate - 0.5) / stdError;
            
            if (zScore > 1.96) {  // p < 0.05
                significant = true;
                pattern = lossRepeatRate > 0.5 ? 'repeat_after_loss' : 'change_after_loss';
                rate = lossRepeatRate;
            }
        }
        
        return {
            significant: significant,
            pattern: pattern,
            rate: rate,
            confidence: significant ? Math.min(0.7, Math.abs(rate - 0.5) * 2) : 0
        };
    }
    
    /**
     * Validate the strongest pattern
     */
    validatePattern(hypotheses, battles) {
        if (hypotheses.size === 0) {
            return null;
        }
        
        // Find strongest hypothesis
        let strongest = null;
        let maxConfidence = 0;
        
        for (const [type, hypothesis] of hypotheses) {
            if (hypothesis.confidence > maxConfidence) {
                maxConfidence = hypothesis.confidence;
                strongest = { type, ...hypothesis };
            }
        }
        
        // Require high confidence to act on pattern
        if (maxConfidence < 0.7) {
            return null;
        }
        
        return strongest;
    }
    
    /**
     * Get recommendation based on validated pattern
     */
    getRecommendation(pattern, battles) {
        if (!pattern) {
            return {
                pattern: 'no_clear_pattern',
                confidence: 0,
                recommendation: 'use_ml_prediction',
                description: 'No statistically significant pattern detected'
            };
        }
        
        const lastBattle = battles[battles.length - 1];
        
        switch (pattern.type) {
            case 'bias':
                const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                return {
                    pattern: 'bias',
                    confidence: pattern.confidence,
                    recommendation: counter[pattern.dominant],
                    description: `Plays ${pattern.dominant} ${(pattern.proportion * 100).toFixed(0)}% - exploit bias`
                };
            
            case 'reactive':
                if (pattern.type === 'counter') {
                    // Second-order: counter their counter
                    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                    const theirExpected = counter[lastBattle.ourMove];
                    return {
                        pattern: 'reactive_counter',
                        confidence: pattern.confidence,
                        recommendation: counter[theirExpected],
                        description: `Counters our moves ${(pattern.rate * 100).toFixed(0)}% - use second-order`
                    };
                } else {
                    // They copy us, counter ourselves
                    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                    return {
                        pattern: 'reactive_copier',
                        confidence: pattern.confidence,
                        recommendation: counter[lastBattle.ourMove],
                        description: `Copies our moves ${(pattern.rate * 100).toFixed(0)}% - self-counter`
                    };
                }
            
            case 'markov':
                // Use Markov chain prediction
                const recentBattles = battles.slice(-pattern.order);
                const prediction = this.markovDetector.getPrediction(pattern, recentBattles);
                if (prediction) {
                    return {
                        pattern: 'markov',
                        confidence: prediction.confidence,
                        recommendation: prediction.move,
                        description: prediction.reason
                    };
                }
                break;
            
            case 'result_based':
                if (pattern.pattern === 'repeat_after_loss' && lastBattle.result === 'win') {
                    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                    return {
                        pattern: 'result_based',
                        confidence: pattern.confidence,
                        recommendation: counter[lastBattle.enemyMove],
                        description: `Repeats after losing ${(pattern.rate * 100).toFixed(0)}% - exploit`
                    };
                }
                break;
        }
        
        return {
            pattern: pattern.type,
            confidence: 0,
            recommendation: 'use_ml_prediction',
            description: 'Pattern detected but not applicable this turn'
        };
    }
    
    /**
     * Online learning - update patterns after each battle
     */
    updateAfterBattle(enemyId, battle, actualEnemyMove) {
        const tracker = this.patterns.get(enemyId);
        if (!tracker || !tracker.validated) {
            return;
        }
        
        // Check if our prediction was correct
        const recommendation = this.getRecommendation(tracker.validated, [battle]);
        const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        const predicted = Object.keys(counter).find(k => counter[k] === recommendation.recommendation);
        
        const correct = predicted === actualEnemyMove;
        
        // Update confidence based on result
        if (correct) {
            tracker.validated.confidence = Math.min(0.95, tracker.validated.confidence * (1 + this.learningRate));
        } else {
            tracker.validated.confidence *= (1 - this.learningRate);
            
            // If confidence drops too low, invalidate pattern
            if (tracker.validated.confidence < 0.5) {
                tracker.validated = null;
            }
        }
        
        this.patterns.set(enemyId, tracker);
    }
}

export default RobustPatternDetector;