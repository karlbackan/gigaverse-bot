import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

// Disable output for cleaner results
config.minimalOutput = true;
config.debug = false;

console.log('=== COMPREHENSIVE ROBUSTNESS SIMULATION ===\n');

// Enemy behavior simulators
class EnemySimulator {
  constructor(type, params = {}) {
    this.type = type;
    this.params = params;
    this.moveHistory = [];
    this.turnCount = 0;
  }

  getNextMove(playerLastMove = null) {
    this.turnCount++;
    let move;

    switch (this.type) {
      case 'static':
        // Always plays the same move
        move = this.params.favoriteMove || 'rock';
        break;

      case 'biased':
        // Plays one move 60-80% of the time
        const bias = this.params.bias || 0.7;
        const favorite = this.params.favoriteMove || 'rock';
        if (Math.random() < bias) {
          move = favorite;
        } else {
          const others = ['rock', 'paper', 'scissor'].filter(m => m !== favorite);
          move = others[Math.floor(Math.random() * others.length)];
        }
        break;

      case 'random':
        // Equal probability for all moves
        const moves = ['rock', 'paper', 'scissor'];
        move = moves[Math.floor(Math.random() * moves.length)];
        break;

      case 'adaptive':
        // Tries to counter player's patterns
        if (this.moveHistory.length < 5) {
          // Start random
          const moves = ['rock', 'paper', 'scissor'];
          move = moves[Math.floor(Math.random() * moves.length)];
        } else {
          // Analyze player's recent moves
          const recentPlayerMoves = this.moveHistory.slice(-10).map(h => h.playerMove);
          const moveCounts = { rock: 0, paper: 0, scissor: 0 };
          recentPlayerMoves.forEach(m => { if (m) moveCounts[m]++; });
          
          // Find player's favorite move
          const playerFavorite = Object.entries(moveCounts).reduce((a, b) => 
            a[1] > b[1] ? a : b
          )[0];
          
          // Counter it
          const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
          move = counters[playerFavorite];
        }
        break;

      case 'pattern_changer':
        // Changes pattern every 20-30 turns
        const phase = Math.floor(this.turnCount / 25);
        const patterns = ['rock', 'paper', 'scissor'];
        const currentPattern = patterns[phase % 3];
        
        // 80% follow pattern, 20% random
        if (Math.random() < 0.8) {
          move = currentPattern;
        } else {
          const moves = ['rock', 'paper', 'scissor'];
          move = moves[Math.floor(Math.random() * moves.length)];
        }
        break;

      case 'cyclical':
        // Cycles through moves predictably
        const cycle = ['rock', 'paper', 'scissor'];
        move = cycle[this.turnCount % 3];
        break;

      case 'mirror':
        // Tries to play what player played last turn
        if (playerLastMove && this.moveHistory.length > 0) {
          move = playerLastMove;
        } else {
          move = 'rock';
        }
        break;

      default:
        move = 'rock';
    }

    this.moveHistory.push({ playerMove: playerLastMove, enemyMove: move });
    return move;
  }

  reset() {
    this.moveHistory = [];
    this.turnCount = 0;
  }
}

// Battle simulator
class BattleSimulator {
  constructor(decisionEngine, enemyId, enemySimulator) {
    this.engine = decisionEngine;
    this.enemyId = enemyId;
    this.enemy = enemySimulator;
    this.results = {
      wins: 0,
      losses: 0,
      draws: 0,
      totalTurns: 0,
      chargesUsed: 0,
      explorationMoves: 0,
      losingStreakLengths: [],
      currentLosingStreak: 0,
      adaptationTurns: [] // Turns needed to adapt to pattern changes
    };
  }

  determineResult(playerMove, enemyMove) {
    if (playerMove === enemyMove) return 'draw';
    if ((playerMove === 'rock' && enemyMove === 'scissor') ||
        (playerMove === 'paper' && enemyMove === 'rock') ||
        (playerMove === 'scissor' && enemyMove === 'paper')) {
      return 'win';
    }
    return 'lose';
  }

  async simulateBattle(maxTurns = 50) {
    this.enemy.reset();
    let playerLastMove = null;
    let consecutiveWins = 0;
    let lastPatternChange = 0;
    
    for (let turn = 1; turn <= maxTurns; turn++) {
      // Simulate weapon charges (3 each)
      const charges = {
        rock: Math.max(1, 3 - Math.floor(turn / 3)),
        paper: Math.max(1, 3 - Math.floor((turn - 1) / 3)),
        scissor: Math.max(1, 3 - Math.floor((turn - 2) / 3))
      };
      
      // Get player decision
      const playerMove = await this.engine.makeDecision(
        this.enemyId,
        turn,
        100, // player health
        100, // enemy health
        ['rock', 'paper', 'scissor'],
        charges,
        { healthPercent: 100 },
        { healthPercent: 100 }
      );
      
      // Get enemy move
      const enemyMove = this.enemy.getNextMove(playerLastMove);
      
      // Determine result
      const result = this.determineResult(playerMove, enemyMove);
      
      // Record turn
      this.engine.recordTurn(
        this.enemyId,
        turn,
        playerMove,
        enemyMove,
        result
      );
      
      // Update statistics
      this.results.totalTurns++;
      this.results.chargesUsed++;
      
      if (result === 'win') {
        this.results.wins++;
        consecutiveWins++;
        if (this.results.currentLosingStreak > 0) {
          this.results.losingStreakLengths.push(this.results.currentLosingStreak);
          this.results.currentLosingStreak = 0;
        }
      } else if (result === 'lose') {
        this.results.losses++;
        consecutiveWins = 0;
        this.results.currentLosingStreak++;
      } else {
        this.results.draws++;
      }
      
      // Track pattern change adaptation
      if (this.enemy.type === 'pattern_changer' && turn % 25 === 0) {
        if (lastPatternChange > 0) {
          // Measure how many turns it took to start winning again
          this.results.adaptationTurns.push(turn - lastPatternChange);
        }
        lastPatternChange = turn;
      }
      
      playerLastMove = playerMove;
    }
    
    // Record final losing streak if any
    if (this.results.currentLosingStreak > 0) {
      this.results.losingStreakLengths.push(this.results.currentLosingStreak);
    }
  }

  getStatistics() {
    const total = this.results.wins + this.results.losses + this.results.draws;
    const winRate = total > 0 ? this.results.wins / total : 0;
    const avgLosingStreak = this.results.losingStreakLengths.length > 0 
      ? this.results.losingStreakLengths.reduce((a, b) => a + b, 0) / this.results.losingStreakLengths.length
      : 0;
    const maxLosingStreak = this.results.losingStreakLengths.length > 0
      ? Math.max(...this.results.losingStreakLengths)
      : 0;
    const avgAdaptationTime = this.results.adaptationTurns.length > 0
      ? this.results.adaptationTurns.reduce((a, b) => a + b, 0) / this.results.adaptationTurns.length
      : 0;
    
    return {
      winRate,
      totalBattles: total,
      wins: this.results.wins,
      losses: this.results.losses,
      draws: this.results.draws,
      avgLosingStreak,
      maxLosingStreak,
      avgAdaptationTime,
      chargeEfficiency: this.results.wins / this.results.chargesUsed
    };
  }
}

// Run comprehensive simulation
async function runSimulation() {
  const enemyTypes = [
    { 
      name: 'Static (100% Rock)', 
      type: 'static', 
      params: { favoriteMove: 'rock' },
      enemyId: 100
    },
    { 
      name: 'Biased (70% Paper)', 
      type: 'biased', 
      params: { favoriteMove: 'paper', bias: 0.7 },
      enemyId: 101
    },
    { 
      name: 'Random (Equal)', 
      type: 'random', 
      params: {},
      enemyId: 102
    },
    { 
      name: 'Adaptive Counter', 
      type: 'adaptive', 
      params: {},
      enemyId: 103
    },
    { 
      name: 'Pattern Changer', 
      type: 'pattern_changer', 
      params: {},
      enemyId: 104
    },
    { 
      name: 'Cyclical', 
      type: 'cyclical', 
      params: {},
      enemyId: 105
    },
    { 
      name: 'Mirror Player', 
      type: 'mirror', 
      params: {},
      enemyId: 106
    }
  ];
  
  const battlesPerEnemy = 100;
  const turnsPerBattle = 30;
  
  console.log(`Simulating ${battlesPerEnemy} battles per enemy type...`);
  console.log(`Each battle: ${turnsPerBattle} turns\n`);
  
  // Test with improvements enabled
  console.log('WITH ROBUSTNESS IMPROVEMENTS:');
  console.log('=' .repeat(60));
  
  const resultsWithImprovements = {};
  
  for (const enemyConfig of enemyTypes) {
    const engine = new DecisionEngine();
    const enemy = new EnemySimulator(enemyConfig.type, enemyConfig.params);
    const simulator = new BattleSimulator(engine, enemyConfig.enemyId, enemy);
    
    // Run multiple battles
    for (let i = 0; i < battlesPerEnemy; i++) {
      await simulator.simulateBattle(turnsPerBattle);
      
      // Show progress
      if ((i + 1) % 20 === 0) {
        process.stdout.write('.');
      }
    }
    
    const stats = simulator.getStatistics();
    resultsWithImprovements[enemyConfig.name] = stats;
    
    console.log(`\n${enemyConfig.name}:`);
    console.log(`  Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
    console.log(`  Total: ${stats.wins}W / ${stats.losses}L / ${stats.draws}D`);
    console.log(`  Avg Losing Streak: ${stats.avgLosingStreak.toFixed(1)}`);
    console.log(`  Max Losing Streak: ${stats.maxLosingStreak}`);
    if (stats.avgAdaptationTime > 0) {
      console.log(`  Avg Adaptation Time: ${stats.avgAdaptationTime.toFixed(1)} turns`);
    }
  }
  
  // Test WITHOUT improvements (baseline)
  console.log('\n\nBASELINE (Without Improvements):');
  console.log('=' .repeat(60));
  
  const resultsBaseline = {};
  
  for (const enemyConfig of enemyTypes) {
    const engine = new DecisionEngine();
    // Disable improvements
    engine.params.explorationRate = 0;
    engine.params.minBattlesForConfidence = 1;
    engine.params.mixedStrategyWeight = 0;
    
    const enemy = new EnemySimulator(enemyConfig.type, enemyConfig.params);
    const simulator = new BattleSimulator(engine, enemyConfig.enemyId + 200, enemy);
    
    // Run multiple battles
    for (let i = 0; i < battlesPerEnemy; i++) {
      await simulator.simulateBattle(turnsPerBattle);
      
      // Show progress
      if ((i + 1) % 20 === 0) {
        process.stdout.write('.');
      }
    }
    
    const stats = simulator.getStatistics();
    resultsBaseline[enemyConfig.name] = stats;
    
    console.log(`\n${enemyConfig.name}:`);
    console.log(`  Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
    console.log(`  Total: ${stats.wins}W / ${stats.losses}L / ${stats.draws}D`);
  }
  
  // Compare results
  console.log('\n\nCOMPARISON SUMMARY:');
  console.log('=' .repeat(60));
  console.log('Enemy Type                  | Baseline | Improved | Change');
  console.log('-'.repeat(60));
  
  let totalBaselineWins = 0;
  let totalImprovedWins = 0;
  let totalBattles = 0;
  
  for (const enemyName of Object.keys(resultsWithImprovements)) {
    const baseline = resultsBaseline[enemyName];
    const improved = resultsWithImprovements[enemyName];
    const change = improved.winRate - baseline.winRate;
    
    totalBaselineWins += baseline.wins;
    totalImprovedWins += improved.wins;
    totalBattles += improved.totalBattles;
    
    console.log(
      `${enemyName.padEnd(27)} | ${(baseline.winRate * 100).toFixed(1).padStart(7)}% | ${(improved.winRate * 100).toFixed(1).padStart(7)}% | ${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%`
    );
  }
  
  console.log('-'.repeat(60));
  const overallBaseline = totalBaselineWins / totalBattles;
  const overallImproved = totalImprovedWins / totalBattles;
  const overallChange = overallImproved - overallBaseline;
  
  console.log(
    `${'OVERALL'.padEnd(27)} | ${(overallBaseline * 100).toFixed(1).padStart(7)}% | ${(overallImproved * 100).toFixed(1).padStart(7)}% | ${overallChange >= 0 ? '+' : ''}${(overallChange * 100).toFixed(1)}%`
  );
  
  // Additional insights
  console.log('\n\nKEY INSIGHTS:');
  console.log('=' .repeat(60));
  
  // Find biggest improvements
  const improvements = [];
  for (const enemyName of Object.keys(resultsWithImprovements)) {
    const change = resultsWithImprovements[enemyName].winRate - resultsBaseline[enemyName].winRate;
    improvements.push({ name: enemyName, change });
  }
  improvements.sort((a, b) => b.change - a.change);
  
  console.log('\nBiggest Improvements:');
  improvements.slice(0, 3).forEach((imp, i) => {
    console.log(`${i + 1}. ${imp.name}: +${(imp.change * 100).toFixed(1)}%`);
  });
  
  console.log('\nAny Regressions:');
  const regressions = improvements.filter(imp => imp.change < 0);
  if (regressions.length === 0) {
    console.log('None! All enemy types show improvement or no change.');
  } else {
    regressions.forEach(reg => {
      console.log(`- ${reg.name}: ${(reg.change * 100).toFixed(1)}%`);
    });
  }
  
  // Losing streak analysis
  console.log('\nLosing Streak Improvements:');
  for (const enemyName of ['Adaptive Counter', 'Pattern Changer']) {
    if (resultsWithImprovements[enemyName] && resultsBaseline[enemyName]) {
      const baselineAvg = resultsBaseline[enemyName].avgLosingStreak || 0;
      const improvedAvg = resultsWithImprovements[enemyName].avgLosingStreak || 0;
      const reduction = baselineAvg > 0 ? ((baselineAvg - improvedAvg) / baselineAvg * 100) : 0;
      console.log(`${enemyName}: ${reduction.toFixed(0)}% shorter losing streaks`);
    }
  }
}

// Run the simulation
console.log('Starting comprehensive simulation...\n');
runSimulation().catch(console.error);