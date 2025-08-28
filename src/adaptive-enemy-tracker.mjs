/**
 * Adaptive Enemy Tracker
 * Tracks how quickly enemies adapt and predicts their strategy evolution
 */

export class AdaptiveEnemyTracker {
    /**
     * Analyze enemy adaptation patterns
     * @param {Array} recentMoves - Last 10-20 moves [{move, turn, result}]
     * @param {Array} historicalMoves - Older moves for comparison
     * @returns {Object} Adaptation analysis
     */
    static analyzeAdaptation(recentMoves, historicalMoves) {
        // Calculate move distributions for different time windows
        const windows = {
            veryRecent: this.getDistribution(recentMoves.slice(-5)),      // Last 5 moves
            recent: this.getDistribution(recentMoves.slice(-10)),         // Last 10 moves
            medium: this.getDistribution(recentMoves.slice(-20)),         // Last 20 moves
            historical: this.getDistribution(historicalMoves)             // All older moves
        };
        
        // Calculate drift (how much strategy is changing)
        const drift = this.calculateDrift(windows);
        
        // Detect adaptation patterns
        const adaptationType = this.detectAdaptationType(recentMoves);
        
        // Predict where strategy is heading
        const trendPrediction = this.predictTrend(windows, drift);
        
        return {
            adaptationSpeed: drift.speed,           // How fast they adapt (0-1)
            adaptationType: adaptationType,         // 'static', 'slow', 'fast', 'reactive'
            currentStrategy: windows.veryRecent,    // What they're playing NOW
            evolving: trendPrediction,              // Where they're heading
            confidence: this.calculateConfidence(drift, recentMoves.length)
        };
    }
    
    /**
     * Calculate distribution of moves in a window
     */
    static getDistribution(moves) {
        const dist = { rock: 0, paper: 0, scissor: 0 };
        if (!moves || moves.length === 0) {
            return { rock: 0.33, paper: 0.33, scissor: 0.34 };
        }
        
        moves.forEach(m => {
            if (m && m.move) dist[m.move]++;
        });
        
        const total = moves.length;
        return {
            rock: dist.rock / total,
            paper: dist.paper / total,
            scissor: dist.scissor / total
        };
    }
    
    /**
     * Calculate how much the strategy is drifting/changing
     */
    static calculateDrift(windows) {
        // KL divergence between distributions
        const klDivergence = (p, q) => {
            let kl = 0;
            ['rock', 'paper', 'scissor'].forEach(move => {
                if (p[move] > 0) {
                    kl += p[move] * Math.log(p[move] / (q[move] || 0.01));
                }
            });
            return kl;
        };
        
        // Calculate drift between time windows
        const recentDrift = klDivergence(windows.veryRecent, windows.recent);
        const mediumDrift = klDivergence(windows.recent, windows.medium);
        const historicalDrift = klDivergence(windows.medium, windows.historical);
        
        // Adaptation speed (0-1 scale)
        const speed = Math.min(1, (recentDrift + mediumDrift * 0.5) / 2);
        
        return {
            speed,
            recentDrift,
            mediumDrift,
            historicalDrift,
            isAccelerating: recentDrift > mediumDrift  // Adapting faster recently
        };
    }
    
    /**
     * Detect what type of adaptation pattern
     */
    static detectAdaptationType(recentMoves) {
        if (!recentMoves || recentMoves.length < 10) {
            return 'unknown';
        }
        
        // Check if enemy is reacting to our moves
        let reactiveScore = 0;
        for (let i = 1; i < recentMoves.length; i++) {
            const prev = recentMoves[i-1];
            const curr = recentMoves[i];
            
            // If they lost, did they switch to counter what beat them?
            if (prev.result === 'loss' && prev.ourMove) {
                const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                if (curr.move === counter[prev.ourMove]) {
                    reactiveScore++;
                }
            }
        }
        
        const reactiveRatio = reactiveScore / (recentMoves.length - 1);
        
        // Classify adaptation type
        if (reactiveRatio > 0.5) return 'reactive';      // Reacting to our moves
        
        // Check pattern stability
        const patterns = {};
        for (let i = 2; i < recentMoves.length; i++) {
            const pattern = `${recentMoves[i-2].move}-${recentMoves[i-1].move}-${recentMoves[i].move}`;
            patterns[pattern] = (patterns[pattern] || 0) + 1;
        }
        
        const uniquePatterns = Object.keys(patterns).length;
        const patternDiversity = uniquePatterns / (recentMoves.length - 2);
        
        if (patternDiversity < 0.3) return 'static';     // Repeating patterns
        if (patternDiversity < 0.5) return 'slow';       // Slowly changing
        if (patternDiversity < 0.7) return 'moderate';   // Moderate adaptation
        return 'fast';                                    // Rapid adaptation
    }
    
    /**
     * Predict where the enemy's strategy is heading
     */
    static predictTrend(windows, drift) {
        // Calculate momentum (direction of change)
        const momentum = {
            rock: windows.veryRecent.rock - windows.recent.rock,
            paper: windows.veryRecent.paper - windows.recent.paper,
            scissor: windows.veryRecent.scissor - windows.recent.scissor
        };
        
        // Project forward based on momentum and adaptation speed
        const projected = {
            rock: Math.max(0, Math.min(1, windows.veryRecent.rock + momentum.rock * drift.speed)),
            paper: Math.max(0, Math.min(1, windows.veryRecent.paper + momentum.paper * drift.speed)),
            scissor: Math.max(0, Math.min(1, windows.veryRecent.scissor + momentum.scissor * drift.speed))
        };
        
        // Normalize
        const total = projected.rock + projected.paper + projected.scissor;
        if (total > 0) {
            projected.rock /= total;
            projected.paper /= total;
            projected.scissor /= total;
        }
        
        return {
            prediction: projected,
            momentum: momentum,
            accelerating: drift.isAccelerating,
            direction: this.getMomentumDirection(momentum)
        };
    }
    
    /**
     * Get the primary direction of momentum
     */
    static getMomentumDirection(momentum) {
        const moves = ['rock', 'paper', 'scissor'];
        let maxMove = 'rock';
        let maxValue = momentum.rock;
        
        for (const move of moves) {
            if (momentum[move] > maxValue) {
                maxValue = momentum[move];
                maxMove = move;
            }
        }
        
        if (maxValue > 0.1) return `increasing_${maxMove}`;
        if (maxValue < -0.1) return `decreasing_${maxMove}`;
        return 'stable';
    }
    
    /**
     * Calculate confidence in our adaptation analysis
     */
    static calculateConfidence(drift, sampleSize) {
        // More samples = higher confidence
        const sampleConfidence = Math.min(1, sampleSize / 30);
        
        // Clear drift patterns = higher confidence
        const driftConfidence = drift.speed > 0.1 ? 0.8 : 0.5;
        
        return sampleConfidence * driftConfidence;
    }
    
    /**
     * Get recommended counter based on adaptation analysis
     */
    static getAdaptiveCounter(analysis) {
        // If enemy is adapting fast, predict where they're going
        if (analysis.adaptationSpeed > 0.5 && analysis.confidence > 0.6) {
            // Use their evolving prediction (where they're heading)
            const prediction = analysis.evolving.prediction;
            console.log(`🎯 Enemy adapting ${analysis.adaptationType} - predicting future: R:${(prediction.rock*100).toFixed(0)}% P:${(prediction.paper*100).toFixed(0)}% S:${(prediction.scissor*100).toFixed(0)}%`);
            return prediction;
        }
        
        // If reactive, use second-order prediction
        if (analysis.adaptationType === 'reactive') {
            console.log('🔄 Enemy is reactive - using second-order counter');
            // They're countering our last move, so counter their counter
            return this.secondOrderCounter(analysis.currentStrategy);
        }
        
        // Static/slow enemies - use current distribution
        console.log(`📊 Enemy ${analysis.adaptationType} - using current distribution`);
        return analysis.currentStrategy;
    }
    
    /**
     * Second-order counter for reactive enemies
     */
    static secondOrderCounter(distribution) {
        // If they're playing mostly rock (to counter our scissors)
        // We should play paper (to beat their rock)
        // This creates a shifted distribution
        return {
            rock: distribution.scissor,  // They play scissor -> we play rock
            paper: distribution.rock,     // They play rock -> we play paper
            scissor: distribution.paper   // They play paper -> we play scissor
        };
    }
}

export default AdaptiveEnemyTracker;