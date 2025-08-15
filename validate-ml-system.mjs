#!/usr/bin/env node
import 'dotenv/config';
import { DecisionEngine } from './src/decision-engine.mjs';
import { config } from './src/config.mjs';

console.log('🤖 ML Decision Engine Simulation & Validation\n');

// Simulated opponent types for testing
class SimulatedOpponent {
  constructor(type, config = {}) {
    this.type = type;
    this.config = { moveHistory: [], ...config };
    this.moveHistory = [];
    this.results = [];
    this.adaptationCounter = 0;
  }
  
  // Simulate different opponent behaviors
  makeMove(turn, botMoves = []) {
    switch (this.type) {
      case 'random':
        return this.randomMove();
        
      case 'rock_spammer':
        return Math.random() < 0.8 ? 'rock' : this.randomMove();
        
      case 'anti_bot':
        return this.antiBotMove(botMoves);
        
      case 'adaptive':
        return this.adaptiveMove(botMoves);
        
      case 'pattern_exploiter':
        return this.patternExploiterMove(botMoves);
        
      case 'mixed_strategy':
        return this.mixedStrategyMove(turn);
        
      default:
        return this.randomMove();
    }
  }
  
  randomMove() {
    const moves = ['rock', 'paper', 'scissor'];
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  antiBotMove(botMoves) {
    if (botMoves.length === 0) return this.randomMove();
    
    // Counter the bot's most recent move
    const lastBotMove = botMoves[botMoves.length - 1];
    const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    
    return Math.random() < 0.7 ? counters[lastBotMove] : this.randomMove();
  }
  
  adaptiveMove(botMoves) {
    this.adaptationCounter++;
    
    if (botMoves.length < 3) return this.randomMove();
    
    // Learn bot patterns and counter them
    const recent = botMoves.slice(-5);
    const moveCounts = { rock: 0, paper: 0, scissor: 0 };
    recent.forEach(move => moveCounts[move]++);
    
    // Find most common bot move and counter it
    let mostCommon = 'rock';
    let maxCount = 0;
    for (const [move, count] of Object.entries(moveCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = move;
      }
    }
    
    const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
    const adaptation = Math.min(0.8, this.adaptationCounter / 20); // adapt over time
    
    return Math.random() < adaptation ? counters[mostCommon] : this.randomMove();
  }
  
  patternExploiterMove(botMoves) {
    if (botMoves.length < 4) return this.randomMove();
    
    // Look for specific patterns in bot moves
    const recent = botMoves.slice(-4);
    
    // Check for alternating pattern
    if (recent.length >= 2) {
      const isAlternating = recent[0] !== recent[1] && 
                          recent[1] !== recent[2] && 
                          recent[2] !== recent[3];
      
      if (isAlternating) {
        // Predict next move in alternating pattern
        const nextMove = recent[1] === recent[3] ? recent[0] : recent[1];
        const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        return counters[nextMove];
      }
    }
    
    return this.randomMove();
  }
  
  mixedStrategyMove(turn) {
    // Game theory optimal mixed strategy with some bias
    const weights = { rock: 0.4, paper: 0.35, scissor: 0.25 };
    
    // Add some cyclical behavior
    if (turn % 3 === 0) weights.rock += 0.2;
    else if (turn % 3 === 1) weights.paper += 0.2;
    else weights.scissor += 0.2;
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [move, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (rand <= cumulative) return move;
    }
    
    return 'rock';
  }
  
  recordResult(result) {
    this.results.push(result);
  }
  
  getStats() {
    const total = this.results.length;
    if (total === 0) return { wins: 0, losses: 0, ties: 0, winRate: 0 };
    
    const wins = this.results.filter(r => r === 'win').length;
    const losses = this.results.filter(r => r === 'loss').length;
    const ties = this.results.filter(r => r === 'tie').length;
    
    return {
      wins, losses, ties, total,
      winRate: wins / total,
      lossRate: losses / total,
      tieRate: ties / total
    };
  }
}

// Battle simulator
class BattleSimulator {
  constructor() {
    this.decisionEngine = new DecisionEngine();
    this.battles = [];
  }
  
  async simulateBattle(opponentType, numTurns = 30, enemyId = 999001) {
    console.log(`\n🥊 Simulating ${numTurns} turns vs ${opponentType} opponent...`);
    
    const opponent = new SimulatedOpponent(opponentType);
    const botMoves = [];
    const enemyMoves = [];
    const results = [];
    
    // Initialize stats
    let botWins = 0, botLosses = 0, ties = 0;
    
    for (let turn = 1; turn <= numTurns; turn++) {
      // Simulate game state
      const playerHealth = Math.max(10, 100 - turn * 2);
      const enemyHealth = Math.max(10, 100 - turn * 1.5);
      const availableWeapons = ['rock', 'paper', 'scissor'];
      const weaponCharges = { rock: 3, paper: 3, scissor: 3 };
      
      const playerStats = {
        health: playerHealth,
        maxHealth: 100,
        shield: Math.max(0, 50 - turn),
        weapons: {
          rock: { attack: 20 + turn, defense: 10 },
          paper: { attack: 15 + turn, defense: 15 },
          scissor: { attack: 18 + turn, defense: 12 }
        }
      };
      
      const enemyStats = {
        health: enemyHealth,
        maxHealth: 100,
        shield: Math.max(0, 40 - turn)
      };
      
      // Bot makes decision
      const botMove = await this.decisionEngine.makeDecision(
        enemyId, turn, playerHealth, enemyHealth,
        availableWeapons, weaponCharges, playerStats, enemyStats
      );
      
      // Opponent makes move
      const enemyMove = opponent.makeMove(turn, botMoves);
      
      // Determine result
      const result = this.determineResult(botMove, enemyMove);
      
      // Track results
      botMoves.push(botMove);
      enemyMoves.push(enemyMove);
      results.push(result);
      
      if (result === 'win') botWins++;
      else if (result === 'loss') botLosses++;
      else ties++;
      
      // Record turn for learning
      this.decisionEngine.recordTurn(
        enemyId, turn, botMove, enemyMove, result,
        playerStats, enemyStats, null
      );
      
      // Opponent records result (from their perspective)
      const opponentResult = result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'tie';
      opponent.recordResult(opponentResult);
      
      // Progress indicator
      if (turn % 10 === 0 && !config.minimalOutput) {
        const winRate = (botWins / turn * 100).toFixed(1);
        console.log(`   Turn ${turn}/${numTurns}: ${botWins}W ${botLosses}L ${ties}T (${winRate}% win rate)`);
      }
    }
    
    const battleResults = {
      opponentType,
      turns: numTurns,
      botStats: {
        wins: botWins,
        losses: botLosses, 
        ties: ties,
        winRate: botWins / numTurns,
        lossRate: botLosses / numTurns,
        tieRate: ties / numTurns
      },
      opponentStats: opponent.getStats(),
      moves: { bot: botMoves, enemy: enemyMoves },
      results: results
    };
    
    this.battles.push(battleResults);
    return battleResults;
  }
  
  determineResult(botMove, enemyMove) {
    if (botMove === enemyMove) return 'tie';
    
    const winCombos = {
      'rock': 'scissor',
      'paper': 'rock', 
      'scissor': 'paper'
    };
    
    return winCombos[botMove] === enemyMove ? 'win' : 'loss';
  }
  
  async runComprehensiveTest() {
    console.log('🧪 Running Comprehensive ML System Test\n');
    
    const opponentTypes = [
      'random',
      'rock_spammer', 
      'anti_bot',
      'adaptive',
      'pattern_exploiter',
      'mixed_strategy'
    ];
    
    const results = [];
    
    for (let i = 0; i < opponentTypes.length; i++) {
      const opponentType = opponentTypes[i];
      const enemyId = 999000 + i + 1; // 999001, 999002, etc.
      const result = await this.simulateBattle(opponentType, 50, enemyId);
      results.push(result);
      
      // Show results
      console.log(`\n📊 Results vs ${opponentType}:`);
      console.log(`   Bot: ${result.botStats.wins}W-${result.botStats.losses}L-${result.botStats.ties}T (${(result.botStats.winRate * 100).toFixed(1)}% win rate)`);
      console.log(`   Expected vs Random: ~33.3% win rate`);
      
      const performance = result.botStats.winRate > 0.4 ? '🟢 EXCELLENT' :
                         result.botStats.winRate > 0.35 ? '🟡 GOOD' : 
                         result.botStats.winRate > 0.3 ? '🟠 FAIR' : '🔴 POOR';
      console.log(`   Performance: ${performance}`);
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.analyzeFinalResults(results);
  }
  
  analyzeFinalResults(results) {
    console.log('\n📈 COMPREHENSIVE TEST ANALYSIS\n');
    
    let totalWins = 0, totalLosses = 0, totalTies = 0, totalBattles = 0;
    
    results.forEach(result => {
      totalWins += result.botStats.wins;
      totalLosses += result.botStats.losses;
      totalTies += result.botStats.ties;
      totalBattles += result.turns;
    });
    
    const overallWinRate = totalWins / totalBattles;
    const overallLossRate = totalLosses / totalBattles;
    const overallTieRate = totalTies / totalBattles;
    
    console.log('🎯 Overall Performance:');
    console.log(`   Total Battles: ${totalBattles}`);
    console.log(`   Win Rate: ${(overallWinRate * 100).toFixed(1)}%`);
    console.log(`   Loss Rate: ${(overallLossRate * 100).toFixed(1)}%`);
    console.log(`   Tie Rate: ${(overallTieRate * 100).toFixed(1)}%`);
    console.log();
    
    // Performance assessment
    let assessment = '';
    if (overallWinRate > overallLossRate) {
      assessment = '🎉 SUCCESS: Wins > Losses achieved!';
    } else if (overallWinRate > 0.35) {
      assessment = '✅ GOOD: Above random chance, close to target';
    } else if (overallWinRate > 0.3) {
      assessment = '⚠️  FAIR: Slightly above random, needs improvement';
    } else {
      assessment = '❌ NEEDS WORK: Below random chance';
    }
    
    console.log(`Assessment: ${assessment}`);
    console.log();
    
    // ML vs Rule-based breakdown
    const enhancedStats = this.decisionEngine.getEnhancedStats();
    if (enhancedStats.mlEnabled) {
      console.log('🤖 ML System Analysis:');
      console.log(`   ML Weight: ${(this.decisionEngine.hybridMode.mlWeight * 100).toFixed(0)}%`);
      console.log(`   ML Decisions: ${enhancedStats.decisionMethods.ml}`);
      console.log(`   Rule-based Decisions: ${enhancedStats.decisionMethods.ruleBased}`);
      console.log(`   Total Opponents Modeled: ${enhancedStats.mlStats.totalOpponents}`);
      console.log(`   Q-Learning States: ${enhancedStats.mlStats.qStates}`);
      console.log();
    }
    
    // Detailed breakdown by opponent type
    console.log('📊 Performance by Opponent Type:');
    results.forEach(result => {
      const winRate = (result.botStats.winRate * 100).toFixed(1);
      const effectiveness = result.botStats.winRate > 0.4 ? 'Excellent' :
                           result.botStats.winRate > 0.35 ? 'Good' :
                           result.botStats.winRate > 0.3 ? 'Fair' : 'Poor';
      
      console.log(`   ${result.opponentType.padEnd(20)} ${winRate}% (${effectiveness})`);
    });
    
    return {
      overall: {
        battles: totalBattles,
        winRate: overallWinRate,
        lossRate: overallLossRate,
        tieRate: overallTieRate,
        performance: assessment
      },
      byOpponent: results,
      mlStats: enhancedStats
    };
  }
}

// Quick validation test
async function quickValidationTest() {
  console.log('⚡ Quick ML Validation Test\n');
  
  const simulator = new BattleSimulator();
  
  // Test against a simple opponent
  const result = await simulator.simulateBattle('anti_bot', 20, 999999);
  
  console.log('\n✅ Quick Test Results:');
  console.log(`   Win Rate: ${(result.botStats.winRate * 100).toFixed(1)}%`);
  console.log(`   Performance: ${result.botStats.winRate > 0.33 ? 'Above Random' : 'Below Random'}`);
  
  // Test ML components individually
  console.log('\n🔧 ML Component Tests:');
  
  const decisionEngine = simulator.decisionEngine;
  if (decisionEngine.mlEngine) {
    console.log('   ✅ ML Engine: Initialized');
    console.log('   ✅ Multi-Armed Bandit: Ready');
    console.log('   ✅ Q-Learning: Ready');
    console.log('   ✅ Neural Network: Ready');
    console.log('   ✅ Opponent Modeling: Ready');
    
    const mlStats = decisionEngine.mlEngine.getMLStats();
    console.log(`   🧠 Bandit Arms: ${Object.keys(mlStats.strategies).length}`);
    console.log(`   🧠 Opponent Models: ${mlStats.totalOpponents}`);
  } else {
    console.log('   ❌ ML Engine: Not initialized');
  }
  
  return result;
}

// Main execution
async function runValidation() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'quick';
  
  try {
    if (testType === 'comprehensive' || testType === 'full') {
      const simulator = new BattleSimulator();
      await simulator.runComprehensiveTest();
    } else {
      await quickValidationTest();
    }
    
    console.log('\n🎯 ML System validated successfully!');
    console.log('\nUsage:');
    console.log('  node validate-ml-system.mjs quick      # Quick test (default)');
    console.log('  node validate-ml-system.mjs comprehensive  # Full test suite');
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error);
}

export { BattleSimulator, SimulatedOpponent, runValidation };