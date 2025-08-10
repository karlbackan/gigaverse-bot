#!/usr/bin/env node
/**
 * Fix inverted win/loss statistics in battle-statistics.json
 * 
 * The bug was that enemy.wins and enemy.losses were recorded from enemy's perspective
 * instead of from bot's perspective. This script corrects the existing data by:
 * 1. Swapping enemy.wins ↔ enemy.losses for all enemies
 * 2. Recalculating win rates based on corrected data
 * 3. Creating a backup of the original file
 */

import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const statsFile = path.join(dataDir, 'battle-statistics.json');
const backupFile = path.join(dataDir, 'battle-statistics-backup-before-fix.json');

console.log('🔧 Starting statistics fix...');
console.log(`📂 Data directory: ${dataDir}`);
console.log(`📄 Statistics file: ${statsFile}`);

// Check if stats file exists
if (!fs.existsSync(statsFile)) {
    console.error(`❌ Statistics file not found: ${statsFile}`);
    process.exit(1);
}

try {
    // Read current statistics
    console.log('📖 Reading current statistics...');
    const statsData = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    
    // Create backup
    console.log('💾 Creating backup...');
    fs.writeFileSync(backupFile, JSON.stringify(statsData, null, 2));
    console.log(`✅ Backup created: ${backupFile}`);
    
    let totalEnemies = 0;
    let totalSwapped = 0;
    let totalOriginalWins = 0;
    let totalOriginalLosses = 0;
    let totalCorrectedWins = 0;
    let totalCorrectedLosses = 0;
    
    // Process all dungeons and enemies
    if (statsData.dungeonStats) {
        console.log('🔄 Processing dungeon statistics...');
        
        for (const [dungeonId, enemies] of Object.entries(statsData.dungeonStats)) {
            for (const [enemyId, enemy] of Object.entries(enemies)) {
                totalEnemies++;
                
                // Record original values
                const originalWins = enemy.wins || 0;
                const originalLosses = enemy.losses || 0;
                
                totalOriginalWins += originalWins;
                totalOriginalLosses += originalLosses;
                
                // Swap wins and losses to correct the perspective
                // Original bug: enemy.wins = bot losses, enemy.losses = bot wins
                // After fix: enemy.wins = enemy wins, enemy.losses = enemy losses
                enemy.wins = originalLosses;   // What were recorded as enemy losses are actually enemy wins
                enemy.losses = originalWins;   // What were recorded as enemy wins are actually enemy losses
                
                totalCorrectedWins += enemy.wins;
                totalCorrectedLosses += enemy.losses;
                
                // Recalculate win rate (from enemy's perspective)
                const totalBattles = enemy.wins + enemy.losses + (enemy.ties || 0);
                if (totalBattles > 0) {
                    enemy.winRate = enemy.wins / totalBattles;
                } else {
                    enemy.winRate = 0;
                }
                
                totalSwapped++;
            }
        }
    }
    
    // Update last modified timestamp
    statsData.lastUpdated = Date.now();
    
    // Write corrected statistics
    console.log('💾 Writing corrected statistics...');
    fs.writeFileSync(statsFile, JSON.stringify(statsData, null, 2));
    
    // Summary report
    console.log('\n📊 STATISTICS CORRECTION SUMMARY');
    console.log('================================');
    console.log(`🎯 Total enemies processed: ${totalEnemies}`);
    console.log(`✅ Total swaps completed: ${totalSwapped}`);
    console.log('');
    console.log('📈 ORIGINAL DATA (from enemy perspective - BUG):');
    console.log(`   Enemy "wins" (actually bot losses): ${totalOriginalWins.toLocaleString()}`);
    console.log(`   Enemy "losses" (actually bot wins): ${totalOriginalLosses.toLocaleString()}`);
    
    console.log('');
    console.log('📈 CORRECTED DATA (from bot perspective):');
    console.log(`   Bot wins (enemy losses): ${totalCorrectedLosses.toLocaleString()}`);
    console.log(`   Bot losses (enemy wins): ${totalCorrectedWins.toLocaleString()}`);
    
    // Calculate corrected bot win rate
    const totalResults = totalCorrectedWins + totalCorrectedLosses;
    const botWinRate = totalResults > 0 ? (totalCorrectedLosses / totalResults * 100) : 0;
    
    console.log('');
    console.log('🎯 CORRECTED BOT PERFORMANCE:');
    console.log(`   Total decisive battles: ${totalResults.toLocaleString()}`);
    console.log(`   Bot win rate: ${botWinRate.toFixed(2)}%`);
    console.log(`   Bot loss rate: ${totalResults > 0 ? ((totalCorrectedWins / totalResults) * 100).toFixed(2) : 0}%`);
    
    console.log('');
    console.log('✅ Statistics correction completed successfully!');
    console.log(`📄 Original data backed up to: ${path.basename(backupFile)}`);
    console.log(`📄 Corrected data saved to: ${path.basename(statsFile)}`);
    
} catch (error) {
    console.error('❌ Error fixing statistics:', error);
    process.exit(1);
}