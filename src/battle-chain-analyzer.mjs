/**
 * Battle Chain Analyzer - Tracks patterns BETWEEN battles
 * 
 * Detects meta-patterns like:
 * - Enemy changing dominant strategy after losses
 * - Cyclical adaptations (rock→paper→scissor across battles)
 * - Revenge patterns (countering what beat them)
 */

export class BattleChainAnalyzer {
    constructor() {
        this.battleSummaries = new Map(); // enemyId -> array of battle summaries
    }
    
    /**
     * Summarize a completed battle
     */
    summarizeBattle(enemyId, battles) {
        if (!battles || battles.length === 0) return null;
        
        // Calculate dominant strategy for this battle
        const moveCounts = { rock: 0, paper: 0, scissor: 0 };
        let wins = 0, losses = 0, ties = 0;
        
        battles.forEach(b => {
            moveCounts[b.enemyMove]++;
            if (b.result === 'win') wins++;
            else if (b.result === 'loss') losses++;
            else ties++;
        });
        
        // Find dominant move
        let dominant = 'rock';
        let maxCount = 0;
        for (const [move, count] of Object.entries(moveCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominant = move;
            }
        }
        
        return {
            battleNumber: battles[0].turn || 1,
            dominantMove: dominant,
            dominantRate: maxCount / battles.length,
            moveDistribution: {
                rock: moveCounts.rock / battles.length,
                paper: moveCounts.paper / battles.length,
                scissor: moveCounts.scissor / battles.length
            },
            outcome: wins > losses ? 'won' : (losses > wins ? 'lost' : 'tied'),
            winRate: wins / battles.length,
            totalMoves: battles.length
        };
    }
    
    /**
     * Analyze patterns across multiple battles
     */
    analyzeBattleChain(enemyId, currentBattle, previousBattles) {
        // Get or create battle history
        if (!this.battleSummaries.has(enemyId)) {
            this.battleSummaries.set(enemyId, []);
        }
        
        const history = this.battleSummaries.get(enemyId);
        
        // Add current battle summary if provided
        if (currentBattle) {
            const summary = this.summarizeBattle(enemyId, currentBattle);
            if (summary) {
                history.push(summary);
            }
        }
        
        // Need at least 2 battles to detect patterns
        if (history.length < 2) {
            return {
                pattern: 'insufficient_history',
                confidence: 0,
                prediction: null
            };
        }
        
        // Detect meta-patterns
        const patterns = [];
        
        // Pattern 1: Revenge Counter (plays counter to what beat them)
        const revengePattern = this.detectRevengePattern(history);
        if (revengePattern.detected) {
            patterns.push(revengePattern);
        }
        
        // Pattern 2: Rotation Pattern (cycles through moves)
        const rotationPattern = this.detectRotationPattern(history);
        if (rotationPattern.detected) {
            patterns.push(rotationPattern);
        }
        
        // Pattern 3: Win-Stay/Lose-Shift
        const adaptivePattern = this.detectAdaptivePattern(history);
        if (adaptivePattern.detected) {
            patterns.push(adaptivePattern);
        }
        
        // Pattern 4: Progressive Counter (each battle counters previous dominant)
        const progressivePattern = this.detectProgressivePattern(history);
        if (progressivePattern.detected) {
            patterns.push(progressivePattern);
        }
        
        // Return strongest pattern
        if (patterns.length === 0) {
            return {
                pattern: 'no_battle_chain_pattern',
                confidence: 0,
                prediction: null
            };
        }
        
        patterns.sort((a, b) => b.confidence - a.confidence);
        return patterns[0];
    }
    
    /**
     * Detect revenge pattern - enemy counters what beat them
     */
    detectRevengePattern(history) {
        let matches = 0;
        let total = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1];
            const curr = history[i];
            
            // If they lost previous battle
            if (prev.outcome === 'lost') {
                total++;
                
                // Check if current dominant counters our winning move
                const ourWinningMove = this.getCounterMove(prev.dominantMove);
                const expectedRevenge = this.getCounterMove(ourWinningMove);
                
                if (curr.dominantMove === expectedRevenge) {
                    matches++;
                }
            }
        }
        
        if (total < 2) return { detected: false };
        
        const rate = matches / total;
        if (rate > 0.6) {
            const lastBattle = history[history.length - 1];
            let nextPrediction = null;
            
            if (lastBattle.outcome === 'lost') {
                const ourWinningMove = this.getCounterMove(lastBattle.dominantMove);
                nextPrediction = this.getCounterMove(ourWinningMove);
            }
            
            return {
                detected: true,
                pattern: 'revenge_counter',
                confidence: Math.min(0.9, rate),
                rate: rate,
                prediction: nextPrediction,
                description: `Enemy counters what beat them ${(rate * 100).toFixed(0)}% of the time`
            };
        }
        
        return { detected: false };
    }
    
    /**
     * Detect rotation pattern - cycles through moves
     */
    detectRotationPattern(history) {
        if (history.length < 3) return { detected: false };
        
        // Check for rock->paper->scissor or reverse
        const forward = ['rock', 'paper', 'scissor', 'rock'];
        const backward = ['rock', 'scissor', 'paper', 'rock'];
        
        let forwardMatches = 0;
        let backwardMatches = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1].dominantMove;
            const curr = history[i].dominantMove;
            
            // Check forward rotation
            const forwardIndex = forward.indexOf(prev);
            if (forward[forwardIndex + 1] === curr) {
                forwardMatches++;
            }
            
            // Check backward rotation
            const backwardIndex = backward.indexOf(prev);
            if (backward[backwardIndex + 1] === curr) {
                backwardMatches++;
            }
        }
        
        const total = history.length - 1;
        const forwardRate = forwardMatches / total;
        const backwardRate = backwardMatches / total;
        
        if (forwardRate > 0.6) {
            const lastMove = history[history.length - 1].dominantMove;
            const nextIndex = forward.indexOf(lastMove) + 1;
            
            return {
                detected: true,
                pattern: 'forward_rotation',
                confidence: Math.min(0.85, forwardRate),
                rate: forwardRate,
                prediction: forward[nextIndex],
                description: `Enemy rotates rock→paper→scissor ${(forwardRate * 100).toFixed(0)}% of battles`
            };
        }
        
        if (backwardRate > 0.6) {
            const lastMove = history[history.length - 1].dominantMove;
            const nextIndex = backward.indexOf(lastMove) + 1;
            
            return {
                detected: true,
                pattern: 'backward_rotation',
                confidence: Math.min(0.85, backwardRate),
                rate: backwardRate,
                prediction: backward[nextIndex],
                description: `Enemy rotates rock→scissor→paper ${(backwardRate * 100).toFixed(0)}% of battles`
            };
        }
        
        return { detected: false };
    }
    
    /**
     * Detect adaptive pattern - changes strategy based on outcome
     */
    detectAdaptivePattern(history) {
        let stayAfterWin = 0;
        let changeAfterLoss = 0;
        let totalWins = 0;
        let totalLosses = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1];
            const curr = history[i];
            
            if (prev.outcome === 'won') {
                totalWins++;
                if (curr.dominantMove === prev.dominantMove) {
                    stayAfterWin++;
                }
            } else if (prev.outcome === 'lost') {
                totalLosses++;
                if (curr.dominantMove !== prev.dominantMove) {
                    changeAfterLoss++;
                }
            }
        }
        
        const winStayRate = totalWins > 0 ? stayAfterWin / totalWins : 0;
        const lossChangeRate = totalLosses > 0 ? changeAfterLoss / totalLosses : 0;
        
        if (winStayRate > 0.7 || lossChangeRate > 0.7) {
            const lastBattle = history[history.length - 1];
            let prediction = null;
            
            if (lastBattle.outcome === 'won' && winStayRate > 0.7) {
                prediction = lastBattle.dominantMove;
            } else if (lastBattle.outcome === 'lost' && lossChangeRate > 0.7) {
                // Predict they'll switch - but to what?
                // Often they switch to counter what beat them
                const ourWinner = this.getCounterMove(lastBattle.dominantMove);
                prediction = this.getCounterMove(ourWinner);
            }
            
            return {
                detected: true,
                pattern: 'win_stay_lose_shift',
                confidence: Math.max(winStayRate, lossChangeRate),
                winStayRate: winStayRate,
                lossChangeRate: lossChangeRate,
                prediction: prediction,
                description: `Stays after win ${(winStayRate * 100).toFixed(0)}%, changes after loss ${(lossChangeRate * 100).toFixed(0)}%`
            };
        }
        
        return { detected: false };
    }
    
    /**
     * Detect progressive counter pattern
     */
    detectProgressivePattern(history) {
        let matches = 0;
        
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1].dominantMove;
            const curr = history[i].dominantMove;
            
            // Check if current counters previous
            if (curr === this.getCounterMove(prev)) {
                matches++;
            }
        }
        
        const rate = matches / (history.length - 1);
        
        if (rate > 0.6) {
            const lastMove = history[history.length - 1].dominantMove;
            const prediction = this.getCounterMove(lastMove);
            
            return {
                detected: true,
                pattern: 'progressive_counter',
                confidence: Math.min(0.9, rate),
                rate: rate,
                prediction: prediction,
                description: `Each battle counters previous dominant ${(rate * 100).toFixed(0)}% of the time`
            };
        }
        
        return { detected: false };
    }
    
    /**
     * Helper: Get counter move
     */
    getCounterMove(move) {
        const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        return counter[move];
    }
    
    /**
     * Predict next battle's dominant strategy
     */
    predictNextBattle(enemyId) {
        const history = this.battleSummaries.get(enemyId);
        if (!history || history.length < 2) {
            return null;
        }
        
        const analysis = this.analyzeBattleChain(enemyId);
        
        if (analysis.prediction) {
            return {
                predictedDominant: analysis.prediction,
                pattern: analysis.pattern,
                confidence: analysis.confidence,
                recommendation: this.getCounterMove(analysis.prediction),
                description: `Based on ${analysis.pattern}: Enemy likely to favor ${analysis.prediction} next battle`
            };
        }
        
        return null;
    }
}

export default BattleChainAnalyzer;