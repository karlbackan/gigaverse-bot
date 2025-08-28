/**
 * Adaptive Markov Chain Pattern Detector
 * Automatically selects the optimal Markov order based on available data
 */

export class AdaptiveMarkovDetector {
    constructor() {
        // Minimum samples needed for each Markov order
        this.MIN_SAMPLES = {
            1: 20,   // 9 possible 2-grams
            2: 50,   // 27 possible 3-grams  
            3: 100,  // 81 possible 4-grams
            4: 200   // 243 possible 5-grams
        };
        
        // Statistical significance threshold
        this.SIGNIFICANCE = 0.01; // p < 0.01 for pattern detection
    }
    
    /**
     * Detect patterns using the highest viable Markov order
     */
    detectPattern(battles) {
        if (!battles || battles.length < this.MIN_SAMPLES[1]) {
            return null;
        }
        
        // Determine maximum viable Markov order based on data size
        let maxOrder = 0;
        for (let order = 4; order >= 1; order--) {
            if (battles.length >= this.MIN_SAMPLES[order]) {
                maxOrder = order;
                break;
            }
        }
        
        console.log(`🎯 Using Markov-${maxOrder} analysis (${battles.length} samples)`);
        
        // Test each order from highest to lowest
        for (let order = maxOrder; order >= 1; order--) {
            const pattern = this.testMarkovOrder(battles, order);
            if (pattern && pattern.significant) {
                return {
                    ...pattern,
                    order: order,
                    description: `Markov-${order} pattern detected`
                };
            }
        }
        
        return null;
    }
    
    /**
     * Test for patterns at a specific Markov order
     */
    testMarkovOrder(battles, order) {
        const sequences = new Map();
        const transitions = new Map();
        let totalTransitions = 0;
        
        // Build n-gram sequences
        for (let i = order; i < battles.length; i++) {
            // Build the context (last 'order' moves)
            const context = [];
            for (let j = order; j >= 1; j--) {
                context.push(battles[i - j].enemyMove);
            }
            const contextKey = context.join('-');
            
            // Record the transition
            const nextMove = battles[i].enemyMove;
            const transitionKey = `${contextKey}=>${nextMove}`;
            
            sequences.set(transitionKey, (sequences.get(transitionKey) || 0) + 1);
            
            // Track all transitions from this context
            if (!transitions.has(contextKey)) {
                transitions.set(contextKey, new Map());
            }
            const contextTransitions = transitions.get(contextKey);
            contextTransitions.set(nextMove, (contextTransitions.get(nextMove) || 0) + 1);
            
            totalTransitions++;
        }
        
        // Find the most predictive sequence
        let bestPattern = null;
        let bestScore = 0;
        
        for (const [context, moveMap] of transitions) {
            const contextTotal = Array.from(moveMap.values()).reduce((a, b) => a + b, 0);
            
            // Need minimum occurrences for statistical significance
            if (contextTotal < 5) continue;
            
            for (const [move, count] of moveMap) {
                const probability = count / contextTotal;
                
                // Calculate z-score for this transition probability
                // Null hypothesis: uniform distribution (1/3 probability)
                const expectedP = 1/3;
                const stdError = Math.sqrt(expectedP * (1 - expectedP) / contextTotal);
                const zScore = (probability - expectedP) / stdError;
                
                // Check for statistical significance
                if (zScore > 2.576) { // p < 0.01
                    const score = probability * Math.sqrt(contextTotal); // Weight by sample size
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestPattern = {
                            context: context,
                            prediction: move,
                            probability: probability,
                            confidence: Math.min(0.95, probability * 1.2),
                            occurrences: count,
                            totalSamples: contextTotal,
                            zScore: zScore
                        };
                    }
                }
            }
        }
        
        if (bestPattern) {
            return {
                significant: true,
                pattern: bestPattern,
                description: `After ${bestPattern.context}, plays ${bestPattern.prediction} ${(bestPattern.probability * 100).toFixed(0)}% of the time`
            };
        }
        
        return { significant: false };
    }
    
    /**
     * Get prediction based on detected pattern
     */
    getPrediction(pattern, recentBattles) {
        if (!pattern || !pattern.pattern) return null;
        
        const order = pattern.order;
        const targetContext = pattern.pattern.context;
        
        // Check if recent history matches the pattern context
        if (recentBattles.length < order) return null;
        
        const currentContext = [];
        for (let i = order; i >= 1; i--) {
            currentContext.push(recentBattles[recentBattles.length - i].enemyMove);
        }
        const currentKey = currentContext.join('-');
        
        if (currentKey === targetContext) {
            // Pattern matches! Return counter to predicted move
            const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            return {
                move: counter[pattern.pattern.prediction],
                confidence: pattern.pattern.confidence,
                reason: `Markov-${order}: After ${targetContext}, enemy plays ${pattern.pattern.prediction} ${(pattern.pattern.probability * 100).toFixed(0)}%`
            };
        }
        
        return null;
    }
    
    /**
     * Calculate information gain for pattern validation
     */
    calculateInformationGain(pattern, baseline = 0.333) {
        if (!pattern || !pattern.pattern) return 0;
        
        const p = pattern.pattern.probability;
        
        // Information gain = reduction in entropy
        const baselineEntropy = -3 * baseline * Math.log2(baseline);
        const patternEntropy = -p * Math.log2(p) - 2 * ((1-p)/2) * Math.log2((1-p)/2);
        
        return baselineEntropy - patternEntropy;
    }
}

export default AdaptiveMarkovDetector;