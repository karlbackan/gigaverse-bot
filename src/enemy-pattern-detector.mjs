/**
 * Enhanced Enemy Pattern Detection System
 * Based on statistical analysis of 2,838 battles showing 84% of enemies are reactive
 */

export class EnemyPatternDetector {
    constructor() {
        this.enemyProfiles = new Map();
        this.minSamplesForDetection = 5; // Can detect patterns quickly
    }
    
    /**
     * Analyze enemy and classify their behavior type
     * @returns {Object} Enemy profile with type and optimal counter-strategy
     */
    analyzeEnemy(enemyId, battleHistory) {
        if (!battleHistory || battleHistory.length < this.minSamplesForDetection) {
            return { type: 'unknown', confidence: 0, strategy: 'uniform' };
        }
        
        // Get or create profile
        let profile = this.enemyProfiles.get(enemyId) || {
            type: 'unknown',
            patterns: {},
            lastUpdate: 0
        };
        
        // Only update every 5 battles for efficiency
        if (battleHistory.length - profile.lastUpdate < 5 && profile.type !== 'unknown') {
            return profile;
        }
        
        // Calculate behavior metrics
        const metrics = this.calculateMetrics(battleHistory);
        
        // Classify enemy type based on metrics
        profile = this.classifyEnemy(metrics, battleHistory);
        profile.lastUpdate = battleHistory.length;
        
        // Store profile
        this.enemyProfiles.set(enemyId, profile);
        
        return profile;
    }
    
    /**
     * Calculate behavioral metrics from battle history
     */
    calculateMetrics(battles) {
        const metrics = {
            counterRate: 0,
            copyRate: 0,
            oppositeRate: 0,
            postLossRepeatRate: 0,
            postWinRepeatRate: 0,
            moveDistribution: { rock: 0, paper: 0, scissor: 0 },
            dominantMove: null,
            entropy: 0,
            fixedPattern: false
        };
        
        if (battles.length < 2) return metrics;
        
        // Count behaviors
        let counterCount = 0;
        let copyCount = 0;
        let oppositeCount = 0;
        let postLossRepeats = 0;
        let postLossTotal = 0;
        let postWinRepeats = 0;
        let postWinTotal = 0;
        
        const moveCount = { rock: 0, paper: 0, scissor: 0 };
        
        for (let i = 0; i < battles.length; i++) {
            const battle = battles[i];
            moveCount[battle.enemyMove]++;
            
            if (i > 0) {
                const prevBattle = battles[i - 1];
                const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                const opposite = { rock: 'scissor', paper: 'rock', scissor: 'paper' };
                
                // Check reactive patterns to our moves
                if (battle.enemyMove === counter[prevBattle.ourMove]) {
                    counterCount++;
                }
                if (battle.enemyMove === prevBattle.ourMove) {
                    copyCount++;
                }
                if (battle.enemyMove === opposite[prevBattle.ourMove]) {
                    oppositeCount++;
                }
                
                // Check post-result patterns
                if (prevBattle.result === 'loss') {
                    postLossTotal++;
                    if (battle.enemyMove === prevBattle.enemyMove) {
                        postLossRepeats++;
                    }
                } else if (prevBattle.result === 'win') {
                    postWinTotal++;
                    if (battle.enemyMove === prevBattle.enemyMove) {
                        postWinRepeats++;
                    }
                }
            }
        }
        
        // Calculate rates
        const transitions = battles.length - 1;
        metrics.counterRate = counterCount / Math.max(1, transitions);
        metrics.copyRate = copyCount / Math.max(1, transitions);
        metrics.oppositeRate = oppositeCount / Math.max(1, transitions);
        metrics.postLossRepeatRate = postLossRepeats / Math.max(1, postLossTotal);
        metrics.postWinRepeatRate = postWinRepeats / Math.max(1, postWinTotal);
        
        // Calculate move distribution
        const total = battles.length;
        metrics.moveDistribution.rock = moveCount.rock / total;
        metrics.moveDistribution.paper = moveCount.paper / total;
        metrics.moveDistribution.scissor = moveCount.scissor / total;
        
        // Find dominant move
        let maxProb = 0;
        for (const [move, prob] of Object.entries(metrics.moveDistribution)) {
            if (prob > maxProb) {
                maxProb = prob;
                metrics.dominantMove = move;
            }
        }
        
        // Check for fixed pattern (100% one move)
        metrics.fixedPattern = maxProb > 0.95;
        
        // Calculate entropy
        metrics.entropy = this.calculateEntropy(metrics.moveDistribution);
        
        return metrics;
    }
    
    /**
     * Classify enemy based on metrics
     */
    classifyEnemy(metrics, battles) {
        // Priority 1: Fixed pattern (out of charges or broken)
        if (metrics.fixedPattern) {
            const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            return {
                type: 'fixed',
                confidence: 1.0,
                strategy: 'exploit_fixed',
                optimalMove: counter[metrics.dominantMove],
                description: `Enemy only plays ${metrics.dominantMove} - free wins!`
            };
        }
        
        // Priority 2: High counter rate (counters our moves)
        if (metrics.counterRate > 0.38) {
            return {
                type: 'counter',
                confidence: Math.min(1.0, metrics.counterRate * 2),
                strategy: 'second_order',
                description: `Counters our moves ${(metrics.counterRate * 100).toFixed(0)}% - use second-order prediction`,
                // They counter us, so we counter their counter
                getMove: (ourLastMove) => {
                    // They'll play counter[ourLastMove], so we play counter[counter[ourLastMove]]
                    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                    const theirMove = counter[ourLastMove];
                    return counter[theirMove];
                }
            };
        }
        
        // Priority 3: High copy rate (copies our moves)
        if (metrics.copyRate > 0.38) {
            return {
                type: 'copier',
                confidence: Math.min(1.0, metrics.copyRate * 2),
                strategy: 'exploit_copy',
                description: `Copies our moves ${(metrics.copyRate * 100).toFixed(0)}% - counter ourselves`,
                // They'll copy us, so we play what beats our last move
                getMove: (ourLastMove) => {
                    const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                    return counter[ourLastMove];
                }
            };
        }
        
        // Priority 4: Post-loss reactor
        if (metrics.postLossRepeatRate > 0.45) {
            return {
                type: 'loss_repeater',
                confidence: metrics.postLossRepeatRate,
                strategy: 'exploit_loss_repeat',
                description: `Repeats ${(metrics.postLossRepeatRate * 100).toFixed(0)}% after loss - counter their last move`,
                // After they lose, they repeat, so counter what they just played
                getMove: (theirLastMove, lastResult) => {
                    if (lastResult === 'win') { // We won, they lost
                        const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
                        return counter[theirLastMove];
                    }
                    return null; // Use default strategy
                }
            };
        }
        
        // Priority 5: High entropy (unpredictable)
        if (metrics.entropy > 0.95) {
            return {
                type: 'random',
                confidence: 0.5,
                strategy: 'defensive',
                description: 'Unpredictable - play defensively'
            };
        }
        
        // Priority 6: Biased (favors one move)
        if (metrics.moveDistribution[metrics.dominantMove] > 0.45) {
            const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            return {
                type: 'biased',
                confidence: metrics.moveDistribution[metrics.dominantMove],
                strategy: 'exploit_bias',
                dominantMove: metrics.dominantMove,
                optimalMove: counter[metrics.dominantMove],
                description: `Favors ${metrics.dominantMove} ${(metrics.moveDistribution[metrics.dominantMove] * 100).toFixed(0)}%`
            };
        }
        
        // Default: Adaptive (changes patterns)
        return {
            type: 'adaptive',
            confidence: 0.6,
            strategy: 'track_adaptation',
            description: 'Adapts strategies - use trend analysis'
        };
    }
    
    /**
     * Get optimal move based on enemy profile
     */
    getOptimalMove(enemyId, ourLastMove, theirLastMove, lastResult, availableWeapons) {
        const profile = this.enemyProfiles.get(enemyId);
        
        if (!profile || profile.type === 'unknown') {
            // Not enough data - play defensively
            return availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        }
        
        // Handle fixed pattern enemies (free wins!)
        if (profile.type === 'fixed' && profile.optimalMove) {
            if (availableWeapons.includes(profile.optimalMove)) {
                console.log(`💯 Fixed enemy detected! Playing ${profile.optimalMove} for guaranteed win!`);
                return profile.optimalMove;
            }
        }
        
        // Handle counter enemies (second-order prediction)
        if (profile.type === 'counter' && profile.getMove && ourLastMove) {
            const move = profile.getMove(ourLastMove);
            if (availableWeapons.includes(move)) {
                console.log(`🎯 Counter enemy - using second-order: ${move}`);
                return move;
            }
        }
        
        // Handle copier enemies
        if (profile.type === 'copier' && profile.getMove && ourLastMove) {
            const move = profile.getMove(ourLastMove);
            if (availableWeapons.includes(move)) {
                console.log(`📋 Copier enemy - countering ourselves: ${move}`);
                return move;
            }
        }
        
        // Handle loss repeaters
        if (profile.type === 'loss_repeater' && profile.getMove) {
            const move = profile.getMove(theirLastMove, lastResult);
            if (move && availableWeapons.includes(move)) {
                console.log(`🔁 Loss repeater - exploiting pattern: ${move}`);
                return move;
            }
        }
        
        // Handle biased enemies
        if (profile.type === 'biased' && profile.optimalMove) {
            if (availableWeapons.includes(profile.optimalMove)) {
                console.log(`📊 Biased enemy - exploiting: ${profile.optimalMove}`);
                return profile.optimalMove;
            }
        }
        
        // Default to best available based on general strategy
        return this.getDefensiveMove(availableWeapons);
    }
    
    /**
     * Calculate entropy of move distribution
     */
    calculateEntropy(distribution) {
        let entropy = 0;
        for (const prob of Object.values(distribution)) {
            if (prob > 0) {
                entropy -= prob * Math.log2(prob);
            }
        }
        return entropy / Math.log2(3); // Normalize to 0-1
    }
    
    /**
     * Get defensive move when uncertain
     */
    getDefensiveMove(availableWeapons) {
        // Prefer rock slightly (beats scissor, decent against paper)
        const weights = { rock: 0.4, paper: 0.3, scissor: 0.3 };
        
        const available = availableWeapons.filter(w => weights[w]);
        if (available.length === 0) return availableWeapons[0];
        
        // Weighted random selection
        const totalWeight = available.reduce((sum, w) => sum + weights[w], 0);
        let random = Math.random() * totalWeight;
        
        for (const weapon of available) {
            random -= weights[weapon];
            if (random <= 0) return weapon;
        }
        
        return available[0];
    }
    
    /**
     * Quick classification for real-time decisions
     */
    quickClassify(recentMoves) {
        if (recentMoves.length < 3) return null;
        
        // Check last 3 moves for quick patterns
        const last3 = recentMoves.slice(-3);
        
        // All same = fixed/out of charges
        if (last3.every(m => m.enemyMove === last3[0].enemyMove)) {
            const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            return {
                type: 'likely_fixed',
                optimalMove: counter[last3[0].enemyMove],
                confidence: 0.9
            };
        }
        
        // Check if countering
        let counters = 0;
        for (let i = 1; i < last3.length; i++) {
            const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            if (last3[i].enemyMove === counter[last3[i-1].ourMove]) {
                counters++;
            }
        }
        
        if (counters >= 2) {
            return { type: 'likely_counter', confidence: 0.7 };
        }
        
        return null;
    }
}

export default EnemyPatternDetector;