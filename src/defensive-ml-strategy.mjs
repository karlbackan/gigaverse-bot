/**
 * Defensive ML Strategy
 * When ML accuracy is poor (<40%), use defensive play that maximizes survival
 */

export class DefensiveMLStrategy {
    /**
     * Calculate move that minimizes maximum loss (minimax approach)
     * Instead of trusting bad predictions, minimize worst-case scenario
     */
    static calculateDefensiveMove(predictions, weights, availableWeapons, confidence) {
        // If confidence is very low (<40%), ignore predictions
        if (confidence < 0.4) {
            return this.playDefensiveUniform(availableWeapons, weights);
        }
        
        // For medium confidence (40-60%), blend predictions with defensive play
        if (confidence < 0.6) {
            return this.blendDefensiveWithPrediction(predictions, weights, availableWeapons, confidence);
        }
        
        // Only trust predictions when confidence >60%
        return null; // Use normal unified scoring
    }
    
    /**
     * Play defensively with randomization when confidence is very low
     * CRITICAL FIX: Previous implementation calculated same score for all moves,
     * causing bot to pick first weapon repeatedly. Now uses weighted randomization.
     */
    static playDefensiveUniform(availableWeapons, weights) {
        // When confidence is very low, we can't trust predictions at all
        // Use weighted random based on uniform distribution (1/3 probability each)

        // Calculate expected value assuming uniform enemy distribution (1/3, 1/3, 1/3)
        const uniformPrediction = { rock: 1/3, paper: 1/3, scissor: 1/3 };

        const scores = {};
        for (const ourMove of availableWeapons) {
            // Calculate expected value for each move under uniform assumption
            if (ourMove === 'rock') {
                scores[ourMove] = uniformPrediction.scissor * weights.win +
                                 uniformPrediction.rock * weights.draw +
                                 uniformPrediction.paper * weights.loss;
            } else if (ourMove === 'paper') {
                scores[ourMove] = uniformPrediction.rock * weights.win +
                                 uniformPrediction.paper * weights.draw +
                                 uniformPrediction.scissor * weights.loss;
            } else { // scissor
                scores[ourMove] = uniformPrediction.paper * weights.win +
                                 uniformPrediction.scissor * weights.draw +
                                 uniformPrediction.rock * weights.loss;
            }
        }

        // All scores are equal under uniform distribution, so add small random variation
        // to prevent always picking the same move
        for (const move of availableWeapons) {
            scores[move] += Math.random() * 0.1; // Add 0-10% random noise
        }

        // Choose move with best score
        let bestMove = availableWeapons[0];
        let bestScore = scores[bestMove];

        for (const move of availableWeapons) {
            if (scores[move] > bestScore) {
                bestScore = scores[move];
                bestMove = move;
            }
        }

        return {
            bestMove: bestMove,
            reasoning: `Defensive play (low confidence) - randomized selection`,
            expectedValue: bestScore
        };
    }
    
    /**
     * Blend defensive uniform with weak predictions
     */
    static blendDefensiveWithPrediction(predictions, weights, availableWeapons, confidence) {
        // Normalize predictions to reduce extreme biases
        const normalized = {};
        const total = predictions.rock + predictions.paper + predictions.scissor;
        
        // Blend predictions toward uniform based on confidence
        const uniformWeight = 1 - confidence;
        const predictionWeight = confidence;
        
        normalized.rock = (predictions.rock / total) * predictionWeight + (1/3) * uniformWeight;
        normalized.paper = (predictions.paper / total) * predictionWeight + (1/3) * uniformWeight;
        normalized.scissor = (predictions.scissor / total) * predictionWeight + (1/3) * uniformWeight;
        
        // Calculate scores with blended predictions
        const scores = {};
        
        for (const ourMove of availableWeapons) {
            scores[ourMove] = 0;
            
            // Calculate expected value
            if (ourMove === 'rock') {
                scores[ourMove] = normalized.scissor * weights.win + 
                                 normalized.rock * weights.draw + 
                                 normalized.paper * weights.loss;
            } else if (ourMove === 'paper') {
                scores[ourMove] = normalized.rock * weights.win + 
                                 normalized.paper * weights.draw + 
                                 normalized.scissor * weights.loss;
            } else {
                scores[ourMove] = normalized.paper * weights.win + 
                                 normalized.scissor * weights.draw + 
                                 normalized.rock * weights.loss;
            }
        }
        
        // Find best move
        let bestMove = availableWeapons[0];
        let bestScore = scores[bestMove];
        
        for (const move of availableWeapons) {
            if (scores[move] > bestScore) {
                bestScore = scores[move];
                bestMove = move;
            }
        }
        
        return {
            bestMove: bestMove,
            reasoning: `Defensive blend (${Math.round(confidence*100)}% confidence)`,
            expectedValue: bestScore
        };
    }
    
    /**
     * Check if we should use defensive strategy based on recent performance
     */
    static shouldUseDefensiveStrategy(mlAccuracy, recentLossRate) {
        // Use defensive if:
        // 1. ML accuracy below 40%
        // 2. Recent loss rate above 35%
        // 3. Both together definitely
        
        if (mlAccuracy < 0.4 && recentLossRate > 0.35) {
            return true;
        }
        
        if (mlAccuracy < 0.35) {
            return true; // ML is worse than random
        }
        
        if (recentLossRate > 0.4) {
            return true; // Losing too much
        }
        
        return false;
    }
}

export default DefensiveMLStrategy;