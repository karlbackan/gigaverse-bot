#!/usr/bin/env node

import { StatisticsEngine } from './statistics-engine.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StatisticsAnalyzer {
  constructor() {
    this.stats = new StatisticsEngine();
  }

  // Generate a comprehensive analysis report
  generateReport(outputFile = null) {
    const report = this.stats.getAnalysisReport();
    
    if (!report || report.totalEnemies === 0) {
      console.log('No statistics data found. Play some games first!');
      return;
    }

    const output = [];
    output.push('='.repeat(80));
    output.push('GIGAVERSE BOT STATISTICS ANALYSIS REPORT');
    output.push(`Generated: ${new Date().toISOString()}`);
    output.push('='.repeat(80));
    output.push('');
    
    // Overall statistics
    output.push('OVERALL STATISTICS');
    output.push('-'.repeat(40));
    output.push(`Total Enemies Analyzed: ${report.totalEnemies}`);
    output.push(`Total Battles Recorded: ${report.totalBattles}`);
    output.push(`Current Session Battles: ${report.sessionBattles}`);
    output.push('');

    // Enemy-specific reports
    if (report.enemyReports && report.enemyReports.length > 0) {
      output.push('ENEMY ANALYSIS');
      output.push('-'.repeat(40));
      
      for (const enemy of report.enemyReports) {
        output.push('');
        output.push(`Enemy ID: ${enemy.enemyId}`);
        output.push(`Total Battles: ${enemy.totalBattles}`);
        output.push(`Favorite Move: ${enemy.favoriteMove}`);
        output.push(`Move Distribution: Rock=${enemy.moves.rock}, Paper=${enemy.moves.paper}, Scissors=${enemy.moves.scissor}`);
        
        // Turn patterns
        if (enemy.turnPatterns && enemy.turnPatterns.length > 0) {
          output.push('\n  Turn-Specific Patterns:');
          for (const pattern of enemy.turnPatterns) {
            output.push(`    Turn ${pattern.turn}: ${pattern.favoriteMove} (${(pattern.distribution[pattern.favoriteMove] * 100).toFixed(1)}%)`);
          }
        }
        
        // Strongest sequences
        if (enemy.strongestSequences && enemy.strongestSequences.length > 0) {
          output.push('\n  Strongest Move Sequences:');
          for (const seq of enemy.strongestSequences) {
            output.push(`    After "${seq.sequence}" → ${seq.nextMove} (${(seq.probability * 100).toFixed(1)}% from ${seq.samples} samples)`);
          }
        }
        
        // NoobId shifts
        if (enemy.noobIdShifts && enemy.noobIdShifts.length > 0) {
          output.push('\n  Pattern Shifts by NoobId:');
          for (const shift of enemy.noobIdShifts) {
            output.push(`    NoobId ${shift.fromRange}-${shift.toRange}: ${shift.shift}`);
          }
        }
        
        output.push('-'.repeat(40));
      }
    }

    // Win rate analysis
    output.push('');
    output.push('WIN RATE ANALYSIS');
    output.push('-'.repeat(40));
    
    const winStats = this.calculateWinRates();
    output.push(`Overall Win Rate: ${(winStats.overall * 100).toFixed(1)}%`);
    output.push(`Rock Win Rate: ${(winStats.rock * 100).toFixed(1)}%`);
    output.push(`Paper Win Rate: ${(winStats.paper * 100).toFixed(1)}%`);
    output.push(`Scissors Win Rate: ${(winStats.scissor * 100).toFixed(1)}%`);
    
    // Confidence analysis
    output.push('');
    output.push('PREDICTION CONFIDENCE');
    output.push('-'.repeat(40));
    
    const confidenceStats = this.analyzeConfidence();
    output.push(`High Confidence Predictions (>60%): ${confidenceStats.high}`);
    output.push(`Medium Confidence Predictions (30-60%): ${confidenceStats.medium}`);
    output.push(`Low Confidence Predictions (<30%): ${confidenceStats.low}`);
    
    // Configuration recommendations
    output.push('');
    output.push('CONFIGURATION RECOMMENDATIONS');
    output.push('-'.repeat(40));
    
    const recommendations = this.generateRecommendations(winStats);
    for (const rec of recommendations) {
      output.push(`• ${rec}`);
    }
    
    const reportText = output.join('\n');
    
    if (outputFile) {
      fs.writeFileSync(outputFile, reportText);
      console.log(`Report saved to: ${outputFile}`);
    } else {
      console.log(reportText);
    }
  }

  // Calculate win rates from session data
  calculateWinRates() {
    const battles = this.stats.sessionData.battles;
    const stats = {
      overall: 0,
      rock: 0,
      paper: 0,
      scissor: 0
    };
    
    if (battles.length === 0) return stats;
    
    const counts = {
      total: { wins: 0, total: 0 },
      rock: { wins: 0, total: 0 },
      paper: { wins: 0, total: 0 },
      scissor: { wins: 0, total: 0 }
    };
    
    for (const battle of battles) {
      counts.total.total++;
      counts[battle.playerAction].total++;
      
      if (battle.result === 'win') {
        counts.total.wins++;
        counts[battle.playerAction].wins++;
      }
    }
    
    stats.overall = counts.total.total > 0 ? counts.total.wins / counts.total.total : 0;
    stats.rock = counts.rock.total > 0 ? counts.rock.wins / counts.rock.total : 0;
    stats.paper = counts.paper.total > 0 ? counts.paper.wins / counts.paper.total : 0;
    stats.scissor = counts.scissor.total > 0 ? counts.scissor.wins / counts.scissor.total : 0;
    
    return stats;
  }

  // Analyze prediction confidence levels
  analyzeConfidence() {
    const stats = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    // This would need to track confidence scores during gameplay
    // For now, estimate based on data volume
    for (const [enemyId, enemy] of this.stats.enemyStats.entries()) {
      if (enemy.totalBattles >= 50) {
        stats.high++;
      } else if (enemy.totalBattles >= 20) {
        stats.medium++;
      } else {
        stats.low++;
      }
    }
    
    return stats;
  }

  // Generate configuration recommendations
  generateRecommendations(winStats) {
    const recommendations = [];
    
    // Overall win rate recommendations
    if (winStats.overall < 0.33) {
      recommendations.push('Win rate is below random (33%). Consider resetting statistics and starting fresh.');
    } else if (winStats.overall < 0.5) {
      recommendations.push('Win rate is below 50%. The prediction system needs more data or weight adjustments.');
    } else if (winStats.overall > 0.6) {
      recommendations.push('Good win rate! The prediction system is working well.');
    }
    
    // Weapon-specific recommendations
    const weapons = ['rock', 'paper', 'scissor'];
    for (const weapon of weapons) {
      if (winStats[weapon] < 0.25) {
        recommendations.push(`${weapon.charAt(0).toUpperCase() + weapon.slice(1)} has poor performance. Consider adjusting attack stat weights.`);
      }
    }
    
    // Data volume recommendations
    if (this.stats.enemyStats.size < 10) {
      recommendations.push('Limited enemy data. Play more games to improve predictions.');
    }
    
    if (this.stats.sessionData.battles.length < 100) {
      recommendations.push('Small sample size. Continue playing to gather more data.');
    }
    
    return recommendations;
  }

  // Export raw data for external analysis
  exportRawData(outputFile) {
    const data = {
      enemyStats: Array.from(this.stats.enemyStats.entries()),
      sessionBattles: this.stats.sessionData.battles,
      exportDate: new Date().toISOString()
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`Raw data exported to: ${outputFile}`);
  }

  // Clear all statistics
  clearStatistics() {
    const dataPath = path.join(__dirname, '..', 'data', 'battle-statistics.json');
    if (fs.existsSync(dataPath)) {
      fs.unlinkSync(dataPath);
      console.log('Statistics cleared.');
    } else {
      console.log('No statistics file found.');
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new StatisticsAnalyzer();
  const command = process.argv[2];
  
  console.log('Gigaverse Bot Statistics Analyzer');
  console.log('=================================\n');
  
  switch (command) {
    case 'report':
      analyzer.generateReport(process.argv[3]);
      break;
      
    case 'export':
      if (!process.argv[3]) {
        console.error('Please provide an output file path');
        process.exit(1);
      }
      analyzer.exportRawData(process.argv[3]);
      break;
      
    case 'clear':
      console.log('Are you sure you want to clear all statistics? This cannot be undone.');
      console.log('Run with --confirm flag to proceed.');
      if (process.argv[3] === '--confirm') {
        analyzer.clearStatistics();
      }
      break;
      
    default:
      console.log('Usage:');
      console.log('  node statistics-analyzer.mjs report [output-file]  - Generate analysis report');
      console.log('  node statistics-analyzer.mjs export <output-file>  - Export raw data as JSON');
      console.log('  node statistics-analyzer.mjs clear --confirm       - Clear all statistics');
  }
}

export { StatisticsAnalyzer };