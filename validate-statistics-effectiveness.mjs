#!/usr/bin/env node
import 'dotenv/config';
import { DatabaseStatisticsEngine } from './src/database-statistics-engine.mjs';

async function validateStatisticsEffectiveness() {
  console.log('🔍 Validating Statistics Effectiveness...\n');
  
  const statsEngine = new DatabaseStatisticsEngine();
  
  try {
    // Get recent battles (last 7 days)
    const query = `
      SELECT 
        enemy_id,
        turn,
        player_move,
        enemy_move,
        result,
        prediction_made,
        prediction_correct,
        confidence_level,
        timestamp
      FROM battles 
      WHERE timestamp > (strftime('%s', 'now') - 7*24*3600) * 1000
      ORDER BY timestamp DESC
    `;
    
    const battles = await statsEngine.db.all(query);
    console.log(`📊 Analyzing ${battles.length} recent battles (last 7 days)\n`);
    
    if (battles.length === 0) {
      console.log('❌ No recent battles found to analyze');
      return;
    }
    
    // === OVERALL PERFORMANCE ===
    console.log('=== OVERALL PERFORMANCE ===');
    const wins = battles.filter(b => b.result === 'win').length;
    const losses = battles.filter(b => b.result === 'loss').length;
    const ties = battles.filter(b => b.result === 'tie').length;
    
    const winRate = (wins / battles.length * 100).toFixed(1);
    const lossRate = (losses / battles.length * 100).toFixed(1);
    const tieRate = (ties / battles.length * 100).toFixed(1);
    
    console.log(`Total battles: ${battles.length}`);
    console.log(`Wins: ${wins} (${winRate}%)`);
    console.log(`Losses: ${losses} (${lossRate}%)`);
    console.log(`Ties: ${ties} (${tieRate}%)`);
    
    const randomChance = 33.33;
    const improvement = (parseFloat(winRate) - randomChance).toFixed(1);
    const isEffective = parseFloat(winRate) > randomChance;
    
    console.log(`\n🎯 Performance vs Random Chance:`);
    console.log(`Random chance: ${randomChance}%`);
    console.log(`Bot win rate: ${winRate}%`);
    console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement}%`);
    console.log(`Status: ${isEffective ? '✅ EFFECTIVE' : '❌ NOT EFFECTIVE'}\n`);
    
    // === PREDICTION ACCURACY ===
    console.log('=== PREDICTION ACCURACY ===');
    const battlesWithPredictions = battles.filter(b => b.prediction_made !== null);
    const correctPredictions = battlesWithPredictions.filter(b => b.prediction_correct === 1);
    
    console.log(`Battles with predictions: ${battlesWithPredictions.length}`);
    console.log(`Correct predictions: ${correctPredictions.length}`);
    
    if (battlesWithPredictions.length > 0) {
      const predictionAccuracy = (correctPredictions.length / battlesWithPredictions.length * 100).toFixed(1);
      console.log(`Prediction accuracy: ${predictionAccuracy}%`);
      console.log(`Expected random accuracy: 33.33%`);
      const predictionImprovement = (parseFloat(predictionAccuracy) - 33.33).toFixed(1);
      console.log(`Prediction improvement: ${predictionImprovement > 0 ? '+' : ''}${predictionImprovement}%\n`);
    } else {
      console.log('❌ No battles with predictions found\n');
    }
    
    // === CONFIDENCE ANALYSIS ===
    console.log('=== CONFIDENCE CORRELATION ===');
    const confidenceBattles = battles.filter(b => b.confidence_level !== null && b.confidence_level > 0);
    
    if (confidenceBattles.length > 0) {
      // Group by confidence ranges
      const lowConfidence = confidenceBattles.filter(b => b.confidence_level < 0.4);
      const medConfidence = confidenceBattles.filter(b => b.confidence_level >= 0.4 && b.confidence_level < 0.7);
      const highConfidence = confidenceBattles.filter(b => b.confidence_level >= 0.7);
      
      const analyzeConfidenceGroup = (group, name) => {
        if (group.length === 0) return;
        const groupWins = group.filter(b => b.result === 'win').length;
        const groupWinRate = (groupWins / group.length * 100).toFixed(1);
        console.log(`${name} (${group.length} battles): ${groupWinRate}% win rate`);
      };
      
      analyzeConfidenceGroup(lowConfidence, 'Low confidence (<40%)');
      analyzeConfidenceGroup(medConfidence, 'Med confidence (40-70%)');
      analyzeConfidenceGroup(highConfidence, 'High confidence (>70%)');
      console.log();
    } else {
      console.log('❌ No battles with confidence data found\n');
    }
    
    // === ENEMY-SPECIFIC ANALYSIS ===
    console.log('=== ENEMY-SPECIFIC PERFORMANCE ===');
    const enemyStats = {};
    
    battles.forEach(battle => {
      if (!enemyStats[battle.enemy_id]) {
        enemyStats[battle.enemy_id] = { wins: 0, total: 0, battles: [] };
      }
      enemyStats[battle.enemy_id].total++;
      if (battle.result === 'win') enemyStats[battle.enemy_id].wins++;
      enemyStats[battle.enemy_id].battles.push(battle);
    });
    
    // Show performance for enemies with at least 5 battles
    const significantEnemies = Object.entries(enemyStats)
      .filter(([id, stats]) => stats.total >= 5)
      .sort((a, b) => b[1].total - a[1].total);
    
    console.log('Performance against enemies (5+ battles):');
    significantEnemies.forEach(([enemyId, stats]) => {
      const winRate = (stats.wins / stats.total * 100).toFixed(1);
      console.log(`Enemy ${enemyId}: ${stats.wins}/${stats.total} wins (${winRate}%)`);
    });
    console.log();
    
    // === LEARNING EFFECTIVENESS ===
    console.log('=== LEARNING EFFECTIVENESS ===');
    
    // Check if performance improves over turns against same enemy
    const enemyTurnAnalysis = {};
    
    battles.forEach(battle => {
      const key = `${battle.enemy_id}`;
      if (!enemyTurnAnalysis[key]) {
        enemyTurnAnalysis[key] = {};
      }
      if (!enemyTurnAnalysis[key][battle.turn]) {
        enemyTurnAnalysis[key][battle.turn] = { wins: 0, total: 0 };
      }
      enemyTurnAnalysis[key][battle.turn].total++;
      if (battle.result === 'win') {
        enemyTurnAnalysis[key][battle.turn].wins++;
      }
    });
    
    // Show turn-based performance for most battled enemy
    const mostBattledEnemy = significantEnemies[0];
    if (mostBattledEnemy) {
      const [enemyId, stats] = mostBattledEnemy;
      console.log(`Turn-based performance vs Enemy ${enemyId}:`);
      
      const turnStats = enemyTurnAnalysis[enemyId];
      const turns = Object.keys(turnStats).map(Number).sort((a, b) => a - b);
      
      turns.forEach(turn => {
        const turnData = turnStats[turn];
        const winRate = (turnData.wins / turnData.total * 100).toFixed(1);
        console.log(`  Turn ${turn}: ${turnData.wins}/${turnData.total} wins (${winRate}%)`);
      });
      
      // Check if there's improvement from early to late turns
      if (turns.length >= 3) {
        const earlyTurns = turns.slice(0, Math.ceil(turns.length / 2));
        const lateTurns = turns.slice(Math.floor(turns.length / 2));
        
        const earlyWins = earlyTurns.reduce((sum, turn) => sum + turnStats[turn].wins, 0);
        const earlyTotal = earlyTurns.reduce((sum, turn) => sum + turnStats[turn].total, 0);
        const lateWins = lateTurns.reduce((sum, turn) => sum + turnStats[turn].wins, 0);
        const lateTotal = lateTurns.reduce((sum, turn) => sum + turnStats[turn].total, 0);
        
        const earlyWinRate = (earlyWins / earlyTotal * 100).toFixed(1);
        const lateWinRate = (lateWins / lateTotal * 100).toFixed(1);
        
        console.log(`\n📈 Learning Analysis for Enemy ${enemyId}:`);
        console.log(`Early turns (${earlyTurns.join(',')}): ${earlyWinRate}% win rate`);
        console.log(`Late turns (${lateTurns.join(',')}): ${lateWinRate}% win rate`);
        
        const improvement = (parseFloat(lateWinRate) - parseFloat(earlyWinRate)).toFixed(1);
        console.log(`Learning improvement: ${improvement > 0 ? '+' : ''}${improvement}%`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Overall effectiveness: ${isEffective ? '✅ Statistics are beneficial' : '❌ Statistics need improvement'}`);
    console.log(`Win rate improvement: ${improvement > 0 ? '+' : ''}${improvement}% vs random`);
    
    if (parseFloat(improvement) > 5) {
      console.log('🏆 EXCELLENT: Statistics providing significant advantage!');
    } else if (parseFloat(improvement) > 0) {
      console.log('👍 GOOD: Statistics providing measurable benefit');
    } else {
      console.log('⚠️  NEEDS WORK: Statistics not outperforming random chance');
    }
    
  } catch (error) {
    console.error('Error validating statistics effectiveness:', error);
  } finally {
    await statsEngine.db.close();
  }
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  validateStatisticsEffectiveness().catch(console.error);
}

export { validateStatisticsEffectiveness };