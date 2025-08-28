/**
 * Meta-Adaptation Handler
 * Handles scenarios where both players are adapting to each other
 */

export class MetaAdaptationHandler {
    /**
     * Detect if we're in an adaptation loop with the enemy
     */
    static detectAdaptationLoop(battleHistory) {
        if (battleHistory.length < 30) return null;
        
        // Look for oscillating patterns (sign of mutual adaptation)
        const patterns = this.findOscillationPatterns(battleHistory.slice(-30));
        
        // Check if strategies are converging to uniform
        const convergence = this.checkConvergence(battleHistory.slice(-30));
        
        // Detect level-k thinking patterns
        const levelK = this.detectLevelKThinking(battleHistory.slice(-20));
        
        return {
            isInLoop: patterns.oscillationScore > 0.6,
            loopType: this.classifyLoopType(patterns, convergence, levelK),
            recommendation: this.getLoopBreakStrategy(patterns, convergence, levelK)
        };
    }
    
    /**
     * Find oscillation patterns indicating mutual adaptation
     */
    static findOscillationPatterns(moves) {
        // Track dominant move in each 5-turn window
        const windows = [];
        for (let i = 0; i < moves.length - 4; i += 5) {
            const window = moves.slice(i, i + 5);
            const counts = { rock: 0, paper: 0, scissor: 0 };
            window.forEach(m => counts[m.move]++);
            
            // Find dominant move
            const dominant = Object.keys(counts).reduce((a, b) => 
                counts[a] > counts[b] ? a : b
            );
            windows.push(dominant);
        }
        
        // Check for cycling pattern (rock→paper→scissor→rock)
        let oscillations = 0;
        const cycle = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        
        for (let i = 1; i < windows.length; i++) {
            if (cycle[windows[i-1]] === windows[i]) {
                oscillations++;
            }
        }
        
        return {
            oscillationScore: oscillations / Math.max(1, windows.length - 1),
            windowPattern: windows
        };
    }
    
    /**
     * Check if strategies are converging to uniform distribution
     */
    static checkConvergence(moves) {
        // Calculate distribution in recent moves
        const dist = { rock: 0, paper: 0, scissor: 0 };
        moves.forEach(m => dist[m.move]++);
        
        const total = moves.length;
        const probs = {
            rock: dist.rock / total,
            paper: dist.paper / total,
            scissor: dist.scissor / total
        };
        
        // Calculate how close to uniform (0.333 each)
        const deviation = Math.abs(probs.rock - 0.333) + 
                         Math.abs(probs.paper - 0.333) + 
                         Math.abs(probs.scissor - 0.333);
        
        return {
            isConverging: deviation < 0.15,
            distribution: probs,
            deviationFromUniform: deviation
        };
    }
    
    /**
     * Detect level-k thinking (I think he thinks I think...)
     */
    static detectLevelKThinking(moves) {
        // Look for counter-counter patterns
        let levelKScore = 0;
        
        for (let i = 2; i < moves.length; i++) {
            const twoBack = moves[i-2];
            const oneBack = moves[i-1];
            const current = moves[i];
            
            // Check if current counters what would counter twoBack
            const counterToTwoBack = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            const counterCounter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            
            if (current.enemyMove === counterCounter[counterToTwoBack[twoBack.ourMove]]) {
                levelKScore++;
            }
        }
        
        return {
            levelKScore: levelKScore / Math.max(1, moves.length - 2),
            estimatedLevel: this.estimateThinkingLevel(levelKScore / (moves.length - 2))
        };
    }
    
    /**
     * Classify the type of adaptation loop
     */
    static classifyLoopType(patterns, convergence, levelK) {
        if (convergence.isConverging) {
            return 'converging_to_nash';  // Both playing optimally
        }
        if (patterns.oscillationScore > 0.7) {
            return 'oscillating_adaptation';  // Chase each other in circles
        }
        if (levelK.levelKScore > 0.4) {
            return 'level_k_recursion';  // "I think he thinks" loop
        }
        return 'unstable_adaptation';  // Chaotic mutual adaptation
    }
    
    /**
     * Get strategy to break out of adaptation loops
     */
    static getLoopBreakStrategy(patterns, convergence, levelK) {
        const loopType = this.classifyLoopType(patterns, convergence, levelK);
        
        switch (loopType) {
            case 'converging_to_nash':
                // Already optimal, maintain mixed strategy
                return {
                    strategy: 'maintain_mixed',
                    distribution: { rock: 0.333, paper: 0.333, scissor: 0.334 },
                    reasoning: 'Both playing optimally - maintain Nash equilibrium'
                };
                
            case 'oscillating_adaptation':
                // Break the cycle by playing TWO steps ahead
                return {
                    strategy: 'double_counter',
                    distribution: this.getDoubleCounterDistribution(patterns.windowPattern),
                    reasoning: 'Breaking oscillation by jumping two steps ahead'
                };
                
            case 'level_k_recursion':
                // Drop down to level 0 (random) to reset
                return {
                    strategy: 'reset_to_random',
                    distribution: { rock: 0.333, paper: 0.333, scissor: 0.334 },
                    reasoning: 'Breaking level-k recursion with unpredictability'
                };
                
            case 'unstable_adaptation':
                // Introduce controlled randomness
                return {
                    strategy: 'controlled_chaos',
                    distribution: this.getControlledChaosDistribution(),
                    reasoning: 'Adding controlled randomness to unstable adaptation'
                };
                
            default:
                return {
                    strategy: 'adaptive_mixed',
                    distribution: { rock: 0.333, paper: 0.333, scissor: 0.334 },
                    reasoning: 'Unknown loop type - playing safe mixed strategy'
                };
        }
    }
    
    /**
     * Get distribution for double-counter strategy
     */
    static getDoubleCounterDistribution(windowPattern) {
        if (!windowPattern || windowPattern.length === 0) {
            return { rock: 0.333, paper: 0.333, scissor: 0.334 };
        }
        
        // Predict next in cycle and counter TWO steps ahead
        const lastMove = windowPattern[windowPattern.length - 1];
        const cycle = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        const nextExpected = cycle[lastMove];
        const twoStepsAhead = cycle[nextExpected];
        
        // Heavy weight on two-steps-ahead counter
        const dist = { rock: 0.2, paper: 0.2, scissor: 0.2 };
        dist[twoStepsAhead] = 0.6;
        
        return dist;
    }
    
    /**
     * Get controlled chaos distribution
     */
    static getControlledChaosDistribution() {
        // Random with slight bias that changes each call
        const bias = Math.random();
        
        if (bias < 0.33) {
            return { rock: 0.4, paper: 0.3, scissor: 0.3 };
        } else if (bias < 0.66) {
            return { rock: 0.3, paper: 0.4, scissor: 0.3 };
        } else {
            return { rock: 0.3, paper: 0.3, scissor: 0.4 };
        }
    }
    
    /**
     * Estimate the thinking level
     */
    static estimateThinkingLevel(score) {
        if (score < 0.2) return 0;  // Random/Level 0
        if (score < 0.4) return 1;  // Level 1 thinking
        if (score < 0.6) return 2;  // Level 2 thinking
        return 3;                    // Level 3+ thinking
    }
    
    /**
     * Meta-strategy: What to do when in adaptation war
     */
    static getMetaStrategy(loopDetection, currentConfidence) {
        if (!loopDetection || !loopDetection.isInLoop) {
            return null;  // Not in a loop, use normal strategies
        }
        
        console.log(`🔄 Adaptation Loop Detected: ${loopDetection.loopType}`);
        
        const breakStrategy = loopDetection.recommendation;
        
        // Adjust confidence based on loop type
        let adjustedConfidence = currentConfidence;
        
        switch (loopDetection.loopType) {
            case 'converging_to_nash':
                // High confidence - we know it's optimal
                adjustedConfidence = 0.9;
                break;
            case 'oscillating_adaptation':
                // Medium confidence - we can predict the cycle
                adjustedConfidence = 0.6;
                break;
            case 'level_k_recursion':
                // Low confidence - too recursive
                adjustedConfidence = 0.3;
                break;
            case 'unstable_adaptation':
                // Very low confidence - chaotic
                adjustedConfidence = 0.2;
                break;
        }
        
        return {
            distribution: breakStrategy.distribution,
            confidence: adjustedConfidence,
            strategy: breakStrategy.strategy,
            reasoning: breakStrategy.reasoning
        };
    }
}

export default MetaAdaptationHandler;