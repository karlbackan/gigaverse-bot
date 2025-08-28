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
     * Play defensively by choosing move that minimizes maximum loss
     */
    static playDefensiveUniform(availableWeapons, weights) {
        // Calculate worst-case for each move
        const worstCase = {};
        
        for (const ourMove of availableWeapons) {
            let worstOutcome = 0;
            
            // Calculate worst possible outcome for this move
            const outcomes = {
                rock: { win: 'scissor', draw: 'rock', loss: 'paper' },
                paper: { win: 'rock', draw: 'paper', loss: 'scissor' },
                scissor: { win: 'paper', draw: 'scissor', loss: 'rock' }
            };
            
            // Worst case is always losing
            worstOutcome = weights.loss;
            
            // But consider average case too (uniform distribution)
            const avgOutcome = (weights.win + weights.draw + weights.loss) / 3;
            
            // Blend worst and average (pessimistic but not paranoid)
            worstCase[ourMove] = 0.3 * worstOutcome + 0.7 * avgOutcome;
        }
        
        // Choose move with best worst-case
        let bestMove = availableWeapons[0];
        let bestWorstCase = worstCase[bestMove];
        
        for (const move of availableWeapons) {
            if (worstCase[move] > bestWorstCase) {
                bestWorstCase = worstCase[move];
                bestMove = move;
            }
        }
        
        return {
            bestMove: bestMove,
            reasoning: `Defensive play (low confidence) - minimizing maximum loss`,
            expectedValue: bestWorstCase
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