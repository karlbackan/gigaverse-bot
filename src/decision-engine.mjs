import { config } from './config.mjs';

// Game actions
const GameAction = {
  rock: 'rock',
  paper: 'paper',
  scissor: 'scissor'
};

// Action counters (rock beats scissor, scissor beats paper, paper beats rock)
const actionWins = {
  rock: 'scissor',
  paper: 'rock',
  scissor: 'paper'
};

// Simple charge-aware random decision engine
export class DecisionEngine {
  constructor() {
    this.battleHistory = []; // Simple battle tracking for basic patterns
  }

  // Make decision based on charges and simple weighting
  async makeDecision(enemyId, turn, playerHealth, enemyHealth, availableWeapons = null, weaponCharges = null, playerStats = null, enemyStats = null) {
    if (config.debug) {
      console.log(`Making decision for enemy ${enemyId}, turn ${turn}`);
    }

    // Default available weapons if not specified
    const weapons = availableWeapons || ['rock', 'paper', 'scissor'];
    
    // Create base weights (equal probability)
    let weights = { rock: 1, paper: 1, scissor: 1 };
    
    // STEP 1: Filter out moves enemy cannot use (charge limitations)
    let enemyPossibleMoves = ['rock', 'paper', 'scissor'];
    if (enemyStats?.charges) {
      enemyPossibleMoves = [];
      // Enemy can only use moves with 0 or positive charges
      if (enemyStats.charges.rock >= 0) enemyPossibleMoves.push('rock');
      if (enemyStats.charges.paper >= 0) enemyPossibleMoves.push('paper');
      if (enemyStats.charges.scissor >= 0) enemyPossibleMoves.push('scissor');
      
      // Log when enemy options are limited
      if (enemyPossibleMoves.length < 3) {
        const formatCharge = (c) => c < 0 ? `${c}/3 (recharging)` : `${c}/3`;
        console.log(`🎯 Enemy limited to: ${enemyPossibleMoves.join(', ')} (R${formatCharge(enemyStats.charges.rock)}, P${formatCharge(enemyStats.charges.paper)}, S${formatCharge(enemyStats.charges.scissor)})`);
        
        if (enemyPossibleMoves.length === 1) {
          console.log(`💯 Enemy can ONLY play ${enemyPossibleMoves[0]}!`);
        }
      }
    }
    
    // STEP 2: Apply slight weighting based on player weapon charges
    if (weaponCharges) {
      const maxCharges = Math.max(weaponCharges.rock || 0, weaponCharges.paper || 0, weaponCharges.scissor || 0);
      if (maxCharges > 0) {
        // Slightly prefer weapons with more charges (10% bonus max)
        if (weaponCharges.rock > 0) {
          weights.rock *= (1 + 0.1 * (weaponCharges.rock / maxCharges));
        }
        if (weaponCharges.paper > 0) {
          weights.paper *= (1 + 0.1 * (weaponCharges.paper / maxCharges));
        }
        if (weaponCharges.scissor > 0) {
          weights.scissor *= (1 + 0.1 * (weaponCharges.scissor / maxCharges));
        }
      }
    }
    
    // STEP 3: Apply slight weighting based on player weapon stats
    if (playerStats?.weapons) {
      const rockAttack = playerStats.weapons.rock?.attack || 0;
      const paperAttack = playerStats.weapons.paper?.attack || 0;
      const scissorAttack = playerStats.weapons.scissor?.attack || 0;
      
      const maxAttack = Math.max(rockAttack, paperAttack, scissorAttack);
      if (maxAttack > 0) {
        // Give up to 15% bonus for higher attack stats
        weights.rock *= (1 + 0.15 * (rockAttack / maxAttack));
        weights.paper *= (1 + 0.15 * (paperAttack / maxAttack));
        weights.scissor *= (1 + 0.15 * (scissorAttack / maxAttack));
      }
    }
    
    // STEP 4: Apply health-based strategy (very slight influence)
    const healthRatio = playerHealth / (playerHealth + enemyHealth);
    if (healthRatio < 0.3) {
      // Low health - slightly prefer paper (defensive)
      weights.paper *= 1.05;
    } else if (healthRatio > 0.7) {
      // High health - slightly prefer aggressive moves
      weights.rock *= 1.03;
      weights.scissor *= 1.03;
    }
    
    // STEP 5: Special handling when enemy has limited moves
    if (enemyPossibleMoves.length === 1) {
      // Enemy can only play one move - counter it deterministically
      const onlyMove = enemyPossibleMoves[0];
      // What beats the enemy's only move? Use actionLosses to find what the enemy loses to
      const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' }[onlyMove];
      
      if (weapons.includes(counter) && (!weaponCharges || weaponCharges[counter] > 0)) {
        console.log(`💯 Guaranteed win! Enemy can only play ${onlyMove}, countering with ${counter}`);
        return counter;
      }
    } else if (enemyPossibleMoves.length === 2) {
      // Enemy has 2 options - slightly boost counters to both
      for (const enemyMove of enemyPossibleMoves) {
        const counter = { rock: 'paper', paper: 'scissor', scissor: 'rock' }[enemyMove];
        if (weights[counter] !== undefined) {
          weights[counter] *= 1.2; // 20% boost to counter moves
        }
      }
    }
    
    // STEP 6: Make weighted random choice
    const choice = this.getWeightedRandomAction(weights, weapons, weaponCharges);
    
    if (config.debug) {
      console.log('Final weights:', weights);
      console.log('Available weapons:', weapons);
      console.log('Choice:', choice);
    }
    
    return choice;
  }
  
  // Weighted random selection with charge validation
  getWeightedRandomAction(weights, availableWeapons = null, weaponCharges = null) {
    // Filter to only available weapons with charges
    let validWeapons = {};
    const weaponList = availableWeapons || ['rock', 'paper', 'scissor'];
    
    for (const weapon of weaponList) {
      if (weights[weapon] !== undefined && 
          (!weaponCharges || weaponCharges[weapon] > 0)) {
        validWeapons[weapon] = weights[weapon];
      }
    }
    
    // If no valid weapons, fall back to any available weapon
    if (Object.keys(validWeapons).length === 0) {
      validWeapons = {};
      for (const weapon of weaponList) {
        validWeapons[weapon] = 1; // Equal weights
      }
    }
    
    const total = Object.values(validWeapons).reduce((sum, weight) => sum + weight, 0);
    if (total === 0) {
      // Ultimate fallback
      return weaponList[Math.floor(Math.random() * weaponList.length)];
    }
    
    let random = Math.random() * total;
    for (const [weapon, weight] of Object.entries(validWeapons)) {
      random -= weight;
      if (random <= 0) {
        return weapon;
      }
    }
    
    // Fallback (shouldn't reach here)
    return Object.keys(validWeapons)[0];
  }
  
  // Record battle result (minimal tracking)
  recordTurn(enemyId, turn, playerAction, enemyAction, result) {
    this.battleHistory.push({
      enemyId,
      turn,
      playerAction,
      enemyAction,
      result,
      timestamp: Date.now()
    });
    
    // Keep only last 100 battles to avoid memory bloat
    if (this.battleHistory.length > 100) {
      this.battleHistory = this.battleHistory.slice(-100);
    }
    
    if (config.debug) {
      console.log(`Recorded: ${playerAction} vs ${enemyAction} = ${result}`);
    }
  }
  
  // Simple random action selector
  getRandomAction(availableWeapons = null) {
    const weapons = availableWeapons || ['rock', 'paper', 'scissor'];
    return weapons[Math.floor(Math.random() * weapons.length)];
  }
}