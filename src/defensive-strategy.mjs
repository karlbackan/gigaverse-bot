/**
 * Defensive Strategy Calculator
 * Calculates optimal move considering draws as valuable for survival
 */

export class DefensiveStrategy {
    /**
     * Calculate defensive scores that value not losing over winning
     * @param {Object} predictions - Enemy move probabilities {rock: 0.5, paper: 0.2, scissor: 0.3}
     * @param {number} healthRatio - Player health / total health (0-1)
     * @param {number} confidence - Prediction confidence (0-1)
     * @returns {Object} Defensive weapon scores and recommended move
     */
    static calculateDefensiveScores(predictions, healthRatio, confidence) {
        // Calculate outcome probabilities for each weapon choice
        const outcomes = {
            rock: {
                win: predictions.scissor,    // Rock beats scissor
                draw: predictions.rock,      // Rock draws rock
                loss: predictions.paper,     // Rock loses to paper
                survival: predictions.scissor + predictions.rock  // Win + Draw
            },
            paper: {
                win: predictions.rock,       // Paper beats rock
                draw: predictions.paper,     // Paper draws paper
                loss: predictions.scissor,   // Paper loses to scissor
                survival: predictions.rock + predictions.paper
            },
            scissor: {
                win: predictions.paper,      // Scissor beats paper
                draw: predictions.scissor,   // Scissor draws scissor
                loss: predictions.rock,      // Scissor loses to rock
                survival: predictions.paper + predictions.scissor
            }
        };
        
        // Calculate defensive value (prioritize not losing)
        const defensiveScores = {};
        const aggressiveScores = {};
        
        for (const [weapon, outcome] of Object.entries(outcomes)) {
            // Defensive score: Heavily weight survival over winning
            // When health is critical, a draw is almost as good as a win
            defensiveScores[weapon] = (outcome.win * 1.0) + (outcome.draw * 0.9) - (outcome.loss * 2.0);
            
            // Aggressive score: Traditional win-focused scoring
            aggressiveScores[weapon] = (outcome.win * 1.0) + (outcome.draw * 0.0) - (outcome.loss * 1.0);
        }
        
        // Blend defensive and aggressive based on health
        // Lower health = more defensive
        const defensiveWeight = Math.max(0, Math.min(1, (0.4 - healthRatio) * 3));
        const aggressiveWeight = 1 - defensiveWeight;
        
        const finalScores = {};
        for (const weapon of ['rock', 'paper', 'scissor']) {
            finalScores[weapon] = 
                (defensiveScores[weapon] * defensiveWeight) + 
                (aggressiveScores[weapon] * aggressiveWeight);
        }
        
        // Find best defensive move
        let bestMove = 'rock';
        let bestScore = -Infinity;
        let bestSurvival = 0;
        
        for (const [weapon, score] of Object.entries(finalScores)) {
            if (score > bestScore || (score === bestScore && outcomes[weapon].survival > bestSurvival)) {
                bestMove = weapon;
                bestScore = score;
                bestSurvival = outcomes[weapon].survival;
            }
        }
        
        return {
            scores: finalScores,
            outcomes: outcomes,
            bestMove: bestMove,
            bestSurvival: bestSurvival,
            defensiveWeight: defensiveWeight,
            reasoning: this.explainChoice(bestMove, outcomes[bestMove], predictions, healthRatio)
        };
    }
    
    /**
     * Explain why a defensive move was chosen
     */
    static explainChoice(move, outcome, predictions, healthRatio) {
        const survivalChance = (outcome.survival * 100).toFixed(0);
        const winChance = (outcome.win * 100).toFixed(0);
        const drawChance = (outcome.draw * 100).toFixed(0);
        const lossChance = (outcome.loss * 100).toFixed(0);
        
        if (healthRatio < 0.3) {
            return `DEFENSIVE ${move.toUpperCase()}: ${survivalChance}% survival (${winChance}% win + ${drawChance}% draw), only ${lossChance}% loss risk`;
        } else if (outcome.draw > outcome.win) {
            return `SAFE ${move.toUpperCase()}: High draw chance ${drawChance}%, minimizes risk`;
        } else {
            return `BALANCED ${move.toUpperCase()}: ${winChance}% win, ${survivalChance}% total survival`;
        }
    }
    
    /**
     * Determine if defensive strategy should be used
     */
    static shouldUseDefensiveStrategy(healthRatio, confidence, turnNumber, enemyEntropy) {
        // Use defensive strategy when:
        // 1. Very low health
        if (healthRatio < 0.25) return true;
        
        // 2. Low-moderate health with uncertain predictions
        if (healthRatio < 0.4 && confidence < 0.5) return true;
        
        // 3. Late game preservation (survive to win)
        if (turnNumber > 15 && healthRatio < 0.5) return true;
        
        // 4. Against highly random enemies when health is precious
        if (enemyEntropy > 1.5 && healthRatio < 0.35) return true;
        
        return false;
    }
    
    /**
     * Example calculation showing why Rock might be better than Paper
     */
    static demonstrateExample() {
        console.log('\n🎯 DEFENSIVE STRATEGY EXAMPLE\n');
        console.log('Enemy Predictions: Rock 50%, Scissor 30%, Paper 20%\n');
        
        const predictions = { rock: 0.5, paper: 0.2, scissor: 0.3 };
        const healthRatio = 0.2; // 20% health remaining
        
        const result = this.calculateDefensiveScores(predictions, healthRatio, 0.7);
        
        console.log('OUTCOME ANALYSIS:');
        for (const [weapon, outcome] of Object.entries(result.outcomes)) {
            console.log(`\n${weapon.toUpperCase()}:`);
            console.log(`  Win: ${(outcome.win * 100).toFixed(0)}%`);
            console.log(`  Draw: ${(outcome.draw * 100).toFixed(0)}%`);
            console.log(`  Loss: ${(outcome.loss * 100).toFixed(0)}%`);
            console.log(`  → Survival: ${(outcome.survival * 100).toFixed(0)}%`);
        }
        
        console.log('\nDECISION:');
        console.log(`Best defensive move: ${result.bestMove.toUpperCase()}`);
        console.log(`Reasoning: ${result.reasoning}`);
        
        console.log('\nCOMPARISON:');
        console.log('Old strategy: Play PAPER to beat Rock (50% win, 30% loss)');
        console.log('New strategy: Play ROCK for safety (50% draw + 30% win = 80% survival)');
        console.log('→ Reduces loss risk from 30% to 20%!\n');
        
        return result;
    }
}

export default DefensiveStrategy;