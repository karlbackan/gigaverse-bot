/**
 * Unified Scoring System
 * Always considers both winning and surviving with configurable weights
 */

import { ThreatCalculator } from './threat-calculator.mjs';

export class UnifiedScoring {
    /**
     * Calculate unified scores that always value both wins and draws
     * @param {Object} predictions - Enemy move probabilities {rock: 0.5, paper: 0.2, scissor: 0.3}
     * @param {Object} weights - Scoring weights {win: 1.3, draw: 1.0, loss: 0}
     * @returns {Object} Weapon scores and best move
     */
    static calculateUnifiedScores(predictions, weights = null) {
        // Default weights: Win is worth 30% more than draw
        const scoreWeights = weights || {
            win: 1.3,   // Winning is valuable
            draw: 1.0,  // Drawing has value (survival)
            loss: 0     // Losing has no value
        };
        
        // Calculate outcome probabilities for each weapon
        const outcomes = {
            rock: {
                win: predictions.scissor,    // Rock beats scissor
                draw: predictions.rock,      // Rock draws rock
                loss: predictions.paper,     // Rock loses to paper
            },
            paper: {
                win: predictions.rock,       // Paper beats rock
                draw: predictions.paper,     // Paper draws paper
                loss: predictions.scissor,   // Paper loses to scissor
            },
            scissor: {
                win: predictions.paper,      // Scissor beats paper
                draw: predictions.scissor,   // Scissor draws scissor
                loss: predictions.rock,      // Scissor loses to rock
            }
        };
        
        // Calculate unified score for each weapon
        const scores = {};
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const [weapon, outcome] of Object.entries(outcomes)) {
            // Unified scoring formula
            scores[weapon] = 
                (outcome.win * scoreWeights.win) +
                (outcome.draw * scoreWeights.draw) +
                (outcome.loss * scoreWeights.loss);
            
            // Track best move
            if (scores[weapon] > bestScore) {
                bestScore = scores[weapon];
                bestMove = weapon;
            }
        }
        
        return {
            scores,
            outcomes,
            bestMove,
            bestScore,
            expectedValue: bestScore, // Expected value of best move
            reasoning: this.explainChoice(bestMove, outcomes[bestMove], scoreWeights)
        };
    }
    
    /**
     * Get adaptive weights based on game state
     * @param {number} healthRatio - Player health / total health
     * @param {number} turn - Current turn number
     * @param {number} confidence - Prediction confidence
     * @returns {Object} Adjusted weights
     */
    static getAdaptiveWeights(healthRatio, turn, confidence) {
        // Start with base weights
        let winWeight = 1.3;
        let drawWeight = 1.0;
        let lossWeight = 0;
        
        // Adjust based on health
        if (healthRatio < 0.2) {
            // Critical health: draws become more valuable
            winWeight = 1.1;   // Still prefer wins but less so
            drawWeight = 1.0;  // Draws are almost as good
            lossWeight = -0.5; // Losses are really bad
        } else if (healthRatio < 0.4) {
            // Low health: moderate adjustment
            winWeight = 1.2;
            drawWeight = 1.0;
            lossWeight = -0.2;
        } else if (healthRatio > 0.7) {
            // High health: more aggressive
            winWeight = 1.5;   // Wins are extra valuable
            drawWeight = 0.8;  // Draws less valuable
            lossWeight = 0;
        }
        
        // Late game adjustment (preserve lead)
        if (turn > 15 && healthRatio > 0.5) {
            drawWeight *= 1.1; // Draws slightly more valuable late game
        }
        
        // Low confidence adjustment (reduce risk)
        if (confidence < 0.3) {
            drawWeight *= 1.1; // Value draws more when uncertain
            lossWeight -= 0.1; // Avoid losses more
        }
        
        return {
            win: winWeight,
            draw: drawWeight,
            loss: lossWeight
        };
    }
    
    /**
     * Get threat-based weights using actual damage calculations
     * @param {Object} playerStats - Full player stats including health, shield, weapons
     * @param {Object} enemyStats - Full enemy stats including weapons and charges
     * @param {Object} predictions - ML predictions
     * @returns {Object} Threat-based weights
     */
    static getThreatBasedWeights(playerStats, enemyStats, predictions) {
        // Calculate threats
        const threatAssessment = ThreatCalculator.assessThreats(playerStats, enemyStats);
        
        // Calculate threat ratio
        const threatRatio = threatAssessment.maxThreat / playerStats.health;
        
        // Base weights
        let weights = {
            win: 1.3,
            draw: 1.0,
            loss: 0
        };
        
        // CRITICAL: Enemy can one-shot us
        if (threatAssessment.hasLethalThreat) {
            weights = {
                win: 1.5,  // Still prefer winning
                draw: 1.4, // Draws almost as good (survival!)
                loss: -10  // Death must be avoided
            };
            console.log('⚠️ LETHAL THREAT - Maximum survival mode!');
        }
        // HIGH: Enemy can do >50% health
        else if (threatRatio > 0.5) {
            weights = {
                win: 1.4,
                draw: 1.2,  // Draws valuable for armor regen
                loss: -2
            };
            console.log(`⚡ High threat (${Math.round(threatRatio * 100)}% health)`);
        }
        // MEDIUM: Enemy can do 25-50% health
        else if (threatRatio > 0.25) {
            weights = {
                win: 1.35,
                draw: 0.95,
                loss: -0.5
            };
        }
        // LOW: Enemy can do <25% health
        else {
            weights = {
                win: 1.5,   // Aggressive when safe
                draw: 0.6,  // Draws less valuable
                loss: 0
            };
            if (threatRatio < 0.1) {
                console.log('💪 Low threat - Going aggressive!');
            }
        }
        
        // Shield adjustment - draws help regen armor
        const shieldPercent = playerStats.shield / (playerStats.maxShield || 1);
        if (shieldPercent < 0.3 && threatRatio > 0.2) {
            weights.draw *= 1.2;
            console.log('🛡️ Low shield - Valuing draws for armor regen');
        }
        
        return weights;
    }
    
    /**
     * Explain the choice made
     */
    static explainChoice(weapon, outcome, weights) {
        const winValue = (outcome.win * weights.win).toFixed(2);
        const drawValue = (outcome.draw * weights.draw).toFixed(2);
        const lossValue = (outcome.loss * weights.loss).toFixed(2);
        const totalValue = (
            outcome.win * weights.win + 
            outcome.draw * weights.draw + 
            outcome.loss * weights.loss
        ).toFixed(2);
        
        return `${weapon.toUpperCase()}: Expected value ${totalValue} (${(outcome.win*100).toFixed(0)}% win×${weights.win} + ${(outcome.draw*100).toFixed(0)}% draw×${weights.draw})`;
    }
    
    /**
     * Demonstrate the unified scoring system
     */
    static demonstrateExample() {
        console.log('🎯 UNIFIED SCORING EXAMPLE\n');
        console.log('Enemy: 50% Rock, 30% Scissor, 20% Paper\n');
        
        const predictions = { rock: 0.5, paper: 0.2, scissor: 0.3 };
        
        console.log('SCENARIO 1: Standard Weights (Win=1.3, Draw=1.0)');
        const result1 = this.calculateUnifiedScores(predictions);
        console.log('\nWeapon Scores:');
        for (const [weapon, score] of Object.entries(result1.scores)) {
            const o = result1.outcomes[weapon];
            console.log(`${weapon}: ${score.toFixed(2)} = ${(o.win*100).toFixed(0)}%×1.3 + ${(o.draw*100).toFixed(0)}%×1.0`);
        }
        console.log(`\nBest move: ${result1.bestMove.toUpperCase()}`);
        console.log('Analysis: Rock gives best expected value (wins + draws)');
        
        console.log('\n─────────────────────────────────────');
        console.log('\nSCENARIO 2: Critical Health (Win=1.1, Draw=1.0, Loss=-0.5)');
        const weights2 = { win: 1.1, draw: 1.0, loss: -0.5 };
        const result2 = this.calculateUnifiedScores(predictions, weights2);
        console.log('\nWeapon Scores:');
        for (const [weapon, score] of Object.entries(result2.scores)) {
            const o = result2.outcomes[weapon];
            console.log(`${weapon}: ${score.toFixed(2)} = ${(o.win*100).toFixed(0)}%×1.1 + ${(o.draw*100).toFixed(0)}%×1.0 - ${(o.loss*100).toFixed(0)}%×0.5`);
        }
        console.log(`\nBest move: ${result2.bestMove.toUpperCase()}`);
        console.log('Analysis: Rock even better now (lowest loss risk)');
        
        console.log('\n─────────────────────────────────────');
        console.log('\nSCENARIO 3: High Health Aggression (Win=1.5, Draw=0.8)');
        const weights3 = { win: 1.5, draw: 0.8, loss: 0 };
        const result3 = this.calculateUnifiedScores(predictions, weights3);
        console.log('\nWeapon Scores:');
        for (const [weapon, score] of Object.entries(result3.scores)) {
            const o = result3.outcomes[weapon];
            console.log(`${weapon}: ${score.toFixed(2)} = ${(o.win*100).toFixed(0)}%×1.5 + ${(o.draw*100).toFixed(0)}%×0.8`);
        }
        console.log(`\nBest move: ${result3.bestMove.toUpperCase()}`);
        console.log('Analysis: Paper becomes competitive (high win chance valued)');
        
        console.log('\n✅ UNIFIED SYSTEM BENEFITS:');
        console.log('• Always considers both winning AND surviving');
        console.log('• No mode switching - just smooth weight adjustment');
        console.log('• Naturally adapts to any situation');
        console.log('• Simpler and more consistent logic');
    }
}

export default UnifiedScoring;