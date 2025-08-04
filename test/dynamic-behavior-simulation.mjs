import { DecisionEngine } from '../src/decision-engine.mjs';
import { config } from '../src/config.mjs';

// Disable output for cleaner results
config.minimalOutput = true;
config.debug = false;

console.log('=== DYNAMIC BEHAVIOR SIMULATION ===\n');

// More realistic enemy behaviors that change over time
class DynamicEnemy {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.battleCount = 0;
    this.turnCount = 0;
    this.playerHistory = [];
    this.phase = 0;
  }

  reset() {
    this.turnCount = 0;
    this.playerHistory = [];
    this.battleCount++;
    // Change phase every few battles
    if (this.battleCount % 3 === 0) {
      this.phase = (this.phase + 1) % 3;
    }
  }

  recordPlayerMove(move) {
    this.playerHistory.push(move);
  }

  getNextMove() {
    this.turnCount++;
    // Each enemy must implement this
    throw new Error('Not implemented');
  }
}

// Enemy 1: Adaptive Learner - Gets better at countering player patterns
class AdaptiveLearner extends DynamicEnemy {
  constructor() {
    super('Adaptive Learner', 'Learns and counters player patterns over time');
    this.playerPatterns = { rock: 0, paper: 0, scissor: 0 };
  }

  getNextMove() {
    // First few turns: random
    if (this.turnCount <= 3) {
      const moves = ['rock', 'paper', 'scissor'];
      return moves[Math.floor(Math.random() * 3)];
    }

    // Update pattern knowledge
    if (this.playerHistory.length > 0) {
      const lastMove = this.playerHistory[this.playerHistory.length - 1];
      this.playerPatterns[lastMove]++;
    }

    // Counter most common player move
    const total = Object.values(this.playerPatterns).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const probs = {
        rock: this.playerPatterns.rock / total,
        paper: this.playerPatterns.paper / total,
        scissor: this.playerPatterns.scissor / total
      };

      // Find most likely player move
      let maxProb = 0;
      let likelyMove = 'rock';
      for (const [move, prob] of Object.entries(probs)) {
        if (prob > maxProb) {
          maxProb = prob;
          likelyMove = move;
        }
      }

      // Counter it (with increasing accuracy over battles)
      const accuracy = Math.min(0.9, 0.5 + this.battleCount * 0.1);
      if (Math.random() < accuracy) {
        const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
        return counters[likelyMove];
      }
    }

    // Random fallback
    const moves = ['rock', 'paper', 'scissor'];
    return moves[Math.floor(Math.random() * 3)];
  }
}

// Enemy 2: Phase Shifter - Changes strategy every N turns
class PhaseShifter extends DynamicEnemy {
  constructor() {
    super('Phase Shifter', 'Changes strategy every 10 turns');
    this.strategies = [
      { name: 'aggressive', moves: ['rock', 'rock', 'scissor'] },
      { name: 'defensive', moves: ['paper', 'paper', 'rock'] },
      { name: 'balanced', moves: ['rock', 'paper', 'scissor'] }
    ];
  }

  getNextMove() {
    const strategyPhase = Math.floor((this.turnCount - 1) / 10) % this.strategies.length;
    const strategy = this.strategies[strategyPhase];
    
    if (!strategy || !strategy.moves) {
      // Fallback to random
      const moves = ['rock', 'paper', 'scissor'];
      return moves[Math.floor(Math.random() * 3)];
    }
    
    const moveIndex = (this.turnCount - 1) % strategy.moves.length;
    
    // Add some noise to prevent being too predictable
    if (Math.random() < 0.2) {
      const moves = ['rock', 'paper', 'scissor'];
      return moves[Math.floor(Math.random() * 3)];
    }
    
    return strategy.moves[moveIndex];
  }
}

// Enemy 3: Reactive Strategist - Changes based on win/loss ratio
class ReactiveStrategist extends DynamicEnemy {
  constructor() {
    super('Reactive Strategist', 'Adapts strategy based on performance');
    this.wins = 0;
    this.losses = 0;
    this.lastMove = 'rock';
    this.strategy = 'balanced';
  }

  recordResult(result) {
    if (result === 'lose') this.wins++; // Enemy win
    else if (result === 'win') this.losses++; // Enemy loss
  }

  getNextMove() {
    // Adjust strategy based on performance
    const total = this.wins + this.losses;
    if (total > 5) {
      const winRate = this.wins / total;
      if (winRate < 0.3) {
        this.strategy = 'defensive'; // Losing too much, be defensive
      } else if (winRate > 0.7) {
        this.strategy = 'exploitative'; // Winning a lot, exploit patterns
      } else {
        this.strategy = 'balanced';
      }
    }

    switch (this.strategy) {
      case 'defensive':
        // Play what beats common aggressive moves
        return ['paper', 'rock', 'paper'][this.turnCount % 3];
      
      case 'exploitative':
        // Try to exploit detected patterns
        if (this.playerHistory.length >= 2) {
          const recent = this.playerHistory.slice(-2);
          if (recent[0] === recent[1]) {
            // Player repeated, counter it
            const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            return counters[recent[1]];
          }
        }
        return this.lastMove;
      
      default: // balanced
        const moves = ['rock', 'paper', 'scissor'];
        this.lastMove = moves[Math.floor(Math.random() * 3)];
        return this.lastMove;
    }
  }
}

// Enemy 4: Meta Gamer - Tries to exploit the bot's statistics system
class MetaGamer extends DynamicEnemy {
  constructor() {
    super('Meta Gamer', 'Exploits statistical prediction systems');
    this.trapPhase = 0;
  }

  getNextMove() {
    // Set up patterns then break them
    if (this.turnCount <= 15) {
      // Establish a strong pattern
      return ['rock', 'paper', 'scissor'][(this.turnCount - 1) % 3];
    } else if (this.turnCount <= 20) {
      // Suddenly break the pattern
      return 'rock'; // When bot expects scissor after paper
    } else {
      // New pattern to confuse
      this.trapPhase = Math.floor((this.turnCount - 20) / 5);
      if (this.trapPhase % 2 === 0) {
        // Mirror last player move if available
        if (this.playerHistory.length > 0) {
          return this.playerHistory[this.playerHistory.length - 1];
        }
      } else {
        // Counter last player move
        if (this.playerHistory.length > 0) {
          const lastMove = this.playerHistory[this.playerHistory.length - 1];
          const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
          return counters[lastMove];
        }
      }
      return 'paper';
    }
  }
}

// Enemy 5: Chaos Agent - Highly unpredictable with hidden patterns
class ChaosAgent extends DynamicEnemy {
  constructor() {
    super('Chaos Agent', 'Appears random but has subtle patterns');
    this.seed = 42;
  }

  // Simple pseudo-random generator
  nextRandom() {
    this.seed = (this.seed * 1664525 + 1013904223) % 2147483647;
    return this.seed / 2147483647;
  }

  getNextMove() {
    // Appears random but actually has patterns based on turn number
    const turnMod = this.turnCount % 7;
    let bias = { rock: 0.33, paper: 0.33, scissor: 0.34 };
    
    // Hidden biases based on turn patterns
    if (turnMod === 0 || turnMod === 3) {
      bias = { rock: 0.5, paper: 0.3, scissor: 0.2 };
    } else if (turnMod === 1 || turnMod === 4) {
      bias = { rock: 0.2, paper: 0.5, scissor: 0.3 };
    } else if (turnMod === 2 || turnMod === 5) {
      bias = { rock: 0.3, paper: 0.2, scissor: 0.5 };
    }
    
    const rand = this.nextRandom();
    if (rand < bias.rock) return 'rock';
    if (rand < bias.rock + bias.paper) return 'paper';
    return 'scissor';
  }
}

// Battle simulator
async function simulateDynamicBattle(engine, enemy, enemyId, battles = 10, turnsPerBattle = 30) {
  const results = {
    wins: 0,
    losses: 0,
    draws: 0,
    winRates: [], // Track win rate progression
    avgTurnsToAdapt: 0,
    explorationCount: 0
  };

  for (let battle = 0; battle < battles; battle++) {
    enemy.reset();
    let battleWins = 0;
    let battleLosses = 0;
    let battleDraws = 0;

    for (let turn = 1; turn <= turnsPerBattle; turn++) {
      // Simulate charges
      const charges = {
        rock: Math.max(1, 3 - Math.floor(turn / 4)),
        paper: Math.max(1, 3 - Math.floor((turn + 1) / 4)),
        scissor: Math.max(1, 3 - Math.floor((turn + 2) / 4))
      };

      // Make decision
      const decision = await engine.makeDecision(
        enemyId,
        turn,
        100, 100,
        ['rock', 'paper', 'scissor'],
        charges,
        { healthPercent: 100 },
        { healthPercent: 100 }
      );

      // Get enemy move
      const enemyMove = enemy.getNextMove();
      
      // Record for enemy learning
      enemy.recordPlayerMove(decision);

      // Determine result
      let result = 'draw';
      if (decision === enemyMove) {
        result = 'draw';
        battleDraws++;
      } else if (
        (decision === 'rock' && enemyMove === 'scissor') ||
        (decision === 'paper' && enemyMove === 'rock') ||
        (decision === 'scissor' && enemyMove === 'paper')
      ) {
        result = 'win';
        battleWins++;
      } else {
        result = 'lose';
        battleLosses++;
      }

      // Record turn
      engine.recordTurn(enemyId, turn, decision, enemyMove, result);
      
      // Update reactive enemies
      if (enemy instanceof ReactiveStrategist) {
        enemy.recordResult(result);
      }
    }

    // Calculate battle statistics
    const totalTurns = battleWins + battleLosses + battleDraws;
    const winRate = battleWins / totalTurns;
    results.winRates.push(winRate);
    
    results.wins += battleWins;
    results.losses += battleLosses;
    results.draws += battleDraws;
  }

  return results;
}

// Run comprehensive test
async function runDynamicSimulation() {
  const enemies = [
    { enemy: new AdaptiveLearner(), id: 200 },
    { enemy: new PhaseShifter(), id: 201 },
    { enemy: new ReactiveStrategist(), id: 202 },
    { enemy: new MetaGamer(), id: 203 },
    { enemy: new ChaosAgent(), id: 204 }
  ];

  const battlesPerEnemy = 20;
  const turnsPerBattle = 30;

  console.log(`Testing against ${enemies.length} dynamic enemy types`);
  console.log(`${battlesPerEnemy} battles each, ${turnsPerBattle} turns per battle\n`);

  // Test WITH improvements
  console.log('=== WITH ROBUSTNESS IMPROVEMENTS ===');
  const improvedResults = {};

  for (const { enemy, id } of enemies) {
    const engine = new DecisionEngine();
    console.log(`\nTesting vs ${enemy.name}: ${enemy.description}`);
    
    const results = await simulateDynamicBattle(engine, enemy, id, battlesPerEnemy, turnsPerBattle);
    improvedResults[enemy.name] = results;

    const totalTurns = results.wins + results.losses + results.draws;
    const overallWinRate = results.wins / totalTurns;
    
    console.log(`Overall: ${(overallWinRate * 100).toFixed(1)}% win rate`);
    console.log(`Progression: ${results.winRates.slice(0, 5).map(r => (r * 100).toFixed(0) + '%').join(' → ')} ... ${results.winRates.slice(-5).map(r => (r * 100).toFixed(0) + '%').join(' → ')}`);
  }

  // Test WITHOUT improvements (baseline)
  console.log('\n\n=== BASELINE (Without Improvements) ===');
  const baselineResults = {};

  for (const { enemy, id } of enemies) {
    const engine = new DecisionEngine();
    // Disable improvements
    engine.params.explorationRate = 0;
    engine.params.minBattlesForConfidence = 1;
    engine.params.mixedStrategyWeight = 0;

    console.log(`\nTesting vs ${enemy.name}`);
    
    const results = await simulateDynamicBattle(engine, enemy, id + 100, battlesPerEnemy, turnsPerBattle);
    baselineResults[enemy.name] = results;

    const totalTurns = results.wins + results.losses + results.draws;
    const overallWinRate = results.wins / totalTurns;
    
    console.log(`Overall: ${(overallWinRate * 100).toFixed(1)}% win rate`);
  }

  // Summary comparison
  console.log('\n\n=== COMPARISON SUMMARY ===');
  console.log('Enemy Type                    | Baseline | Improved | Difference');
  console.log('-'.repeat(65));

  let totalBaselineWins = 0;
  let totalImprovedWins = 0;
  let totalTurns = 0;

  for (const enemyName of Object.keys(improvedResults)) {
    const baseline = baselineResults[enemyName];
    const improved = improvedResults[enemyName];
    
    const baselineTurns = baseline.wins + baseline.losses + baseline.draws;
    const improvedTurns = improved.wins + improved.losses + improved.draws;
    
    const baselineWinRate = baseline.wins / baselineTurns;
    const improvedWinRate = improved.wins / improvedTurns;
    const difference = improvedWinRate - baselineWinRate;

    totalBaselineWins += baseline.wins;
    totalImprovedWins += improved.wins;
    totalTurns += improvedTurns;

    console.log(
      `${enemyName.padEnd(29)} | ${(baselineWinRate * 100).toFixed(1).padStart(7)}% | ${(improvedWinRate * 100).toFixed(1).padStart(7)}% | ${difference >= 0 ? '+' : ''}${(difference * 100).toFixed(1)}%`
    );
  }

  console.log('-'.repeat(65));
  const overallBaseline = totalBaselineWins / totalTurns;
  const overallImproved = totalImprovedWins / totalTurns;
  const overallDiff = overallImproved - overallBaseline;
  
  console.log(
    `${'OVERALL'.padEnd(29)} | ${(overallBaseline * 100).toFixed(1).padStart(7)}% | ${(overallImproved * 100).toFixed(1).padStart(7)}% | ${overallDiff >= 0 ? '+' : ''}${(overallDiff * 100).toFixed(1)}%`
  );

  // Key insights
  console.log('\n=== KEY INSIGHTS ===');
  
  // Check adaptation
  console.log('\nAdaptation Performance:');
  for (const enemyName of ['Adaptive Learner', 'Phase Shifter', 'Meta Gamer']) {
    if (improvedResults[enemyName]) {
      const improved = improvedResults[enemyName];
      const early = improved.winRates.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const late = improved.winRates.slice(-5).reduce((a, b) => a + b, 0) / 5;
      console.log(`${enemyName}: Early ${(early * 100).toFixed(0)}% → Late ${(late * 100).toFixed(0)}%`);
    }
  }
}

// Run simulation
runDynamicSimulation().catch(console.error);