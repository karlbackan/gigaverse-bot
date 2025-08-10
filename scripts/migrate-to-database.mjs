#!/usr/bin/env node
/**
 * Migrate battle statistics from JSON file to SQLite database
 * Transfers all existing data while maintaining data integrity
 */

import fs from 'fs';
import path from 'path';
import { getDatabase } from '../src/database.mjs';

const jsonFile = path.join(process.cwd(), 'data', 'battle-statistics.json');
const backupFile = path.join(process.cwd(), 'data', 'battle-statistics-pre-migration.json');
const dbPath = path.join(process.cwd(), 'data', 'battle-statistics.db');

console.log('🔄 Starting migration from JSON to database...');
console.log(`📄 Source: ${jsonFile}`);
console.log(`🗄️  Target: ${dbPath}`);

if (!fs.existsSync(jsonFile)) {
    console.error(`❌ Source file not found: ${jsonFile}`);
    process.exit(1);
}

try {
    // Create backup of JSON file
    console.log('💾 Creating backup of JSON file...');
    const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    fs.writeFileSync(backupFile, JSON.stringify(jsonData, null, 2));
    console.log(`✅ Backup created: ${backupFile}`);
    
    // Initialize database
    console.log('🗄️  Connecting to database...');
    const db = getDatabase(dbPath);
    await db.initialize();
    
    console.log('📊 Starting data migration...');
    let totalEnemies = 0;
    let totalBattles = 0;
    let totalDungeons = 0;
    
    // Begin transaction for performance
    await db.exec('BEGIN TRANSACTION');
    
    try {
        // Process dungeon statistics
        if (jsonData.dungeonStats) {
            console.log('🏛️  Migrating dungeon data...');
            
            // First pass: Create all dungeon records
            for (const [dungeonIdStr, dungeonEnemies] of Object.entries(jsonData.dungeonStats)) {
                const dungeonId = parseInt(dungeonIdStr);
                totalDungeons++;
                
                // Insert dungeon record first
                await migrateDungeon(db, dungeonId, dungeonEnemies);
            }
            
            // Second pass: Create enemies and battles
            for (const [dungeonIdStr, dungeonEnemies] of Object.entries(jsonData.dungeonStats)) {
                const dungeonId = parseInt(dungeonIdStr);
                
                // Process enemies in this dungeon
                for (const [enemyId, enemyData] of dungeonEnemies) {
                    totalEnemies++;
                    
                    // Insert/update enemy record
                    await migrateEnemy(db, enemyId, dungeonId, enemyData);
                    
                    // Migrate battle history if available
                    if (enemyData.recentBattles && Array.isArray(enemyData.recentBattles)) {
                        for (const battle of enemyData.recentBattles) {
                            await migrateBattle(db, enemyId, dungeonId, battle);
                            totalBattles++;
                        }
                    }
                    
                    // Migrate move data
                    await migrateMoveData(db, enemyId, dungeonId, enemyData);
                    
                    // Log progress every 10 enemies
                    if (totalEnemies % 10 === 0) {
                        console.log(`   Processed ${totalEnemies} enemies...`);
                    }
                }
            }
        }
        
        // Commit transaction
        await db.exec('COMMIT');
        console.log('✅ Transaction committed successfully');
        
    } catch (error) {
        await db.exec('ROLLBACK');
        console.error('❌ Transaction rolled back due to error:', error);
        throw error;
    }
    
    // Update metadata
    await db.run(`
        UPDATE metadata 
        SET value = ?, updated_at = ?
        WHERE key = 'migration_completed'
    `, [Date.now().toString(), Date.now()]);
    
    await db.run(`
        INSERT OR REPLACE INTO metadata (key, value, updated_at)
        VALUES ('original_json_backup', ?, ?)
    `, [path.basename(backupFile), Date.now()]);
    
    // Get final statistics
    const finalStats = await db.get(`SELECT * FROM battle_summary`);
    const enemyCount = await db.get(`SELECT COUNT(*) as count FROM enemies`);
    const dungeonCount = await db.get(`SELECT COUNT(*) as count FROM dungeons`);
    
    console.log('');
    console.log('📈 MIGRATION SUMMARY');
    console.log('===================');
    console.log(`🏛️  Dungeons migrated: ${totalDungeons}`);
    console.log(`👾 Enemies migrated: ${totalEnemies}`);
    console.log(`⚔️  Battles migrated: ${totalBattles}`);
    console.log('');
    console.log('📊 DATABASE STATISTICS');
    console.log('=====================');
    console.log(`📋 Dungeons in DB: ${dungeonCount.count}`);
    console.log(`👾 Enemies in DB: ${enemyCount.count}`);
    console.log(`⚔️  Battles in DB: ${finalStats.total_battles || 0}`);
    console.log(`🏆 Bot wins: ${finalStats.bot_wins || 0}`);
    console.log(`💀 Bot losses: ${finalStats.bot_losses || 0}`);
    console.log(`🤝 Ties: ${finalStats.ties || 0}`);
    
    if (finalStats.total_battles > 0) {
        console.log(`📈 Bot win rate: ${((finalStats.bot_wins || 0) / finalStats.total_battles * 100).toFixed(2)}%`);
    }
    
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('🗄️  Statistics are now stored in the database');
    console.log(`💾 Original data backed up to: ${path.basename(backupFile)}`);
    
    await db.close();
    
} catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
}

async function migrateEnemy(db, enemyId, dungeonId, enemyData) {
    const now = Date.now();
    
    await db.run(`
        INSERT OR REPLACE INTO enemies (
            id, dungeon_id, first_seen, last_seen, total_battles,
            wins, losses, ties, win_rate, prediction_accuracy,
            predictability_score, adaptability_rating, dominant_strategy,
            exploitable_weakness, confidence_level, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        enemyId,
        dungeonId,
        enemyData.firstSeen || now,
        enemyData.lastSeen || now,
        enemyData.totalBattles || 0,
        enemyData.wins || 0,
        enemyData.losses || 0,
        enemyData.ties || 0,
        enemyData.winRate || 0,
        enemyData.predictionAccuracy || 0,
        enemyData.predictabilityScore || 0,
        enemyData.adaptabilityRating || 50,
        enemyData.dominantStrategy || null,
        enemyData.exploitableWeakness || null,
        enemyData.confidenceLevel || 0,
        now,
        now
    ]);
}

async function migrateBattle(db, enemyId, dungeonId, battle) {
    await db.run(`
        INSERT INTO battles (
            enemy_id, dungeon_id, turn, timestamp, player_move, enemy_move, result,
            sequence_key, player_health, enemy_health, player_stats, enemy_stats,
            weapon_stats, noob_id, prediction_made, prediction_correct, confidence_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        enemyId,
        dungeonId,
        battle.turn || 1,
        battle.timestamp || Date.now(),
        battle.playerAction || battle.move || 'rock',
        battle.enemyAction || battle.enemyMove || 'rock', 
        battle.result || 'tie',
        battle.sequenceKey || null,
        battle.playerHealth || null,
        battle.enemyHealth || null,
        battle.playerStats ? JSON.stringify(battle.playerStats) : null,
        battle.enemyStats ? JSON.stringify(battle.enemyStats) : null,
        battle.weaponStats ? JSON.stringify(battle.weaponStats) : null,
        battle.noobId || null,
        battle.predictionMade || null,
        battle.predictionCorrect || null,
        battle.confidenceLevel || null
    ]);
}

async function migrateMoveData(db, enemyId, dungeonId, enemyData) {
    // Migrate move counts
    if (enemyData.moves) {
        for (const [move, count] of Object.entries(enemyData.moves)) {
            await db.run(`
                INSERT OR REPLACE INTO enemy_moves (enemy_id, dungeon_id, move, count)
                VALUES (?, ?, ?, ?)
            `, [enemyId, dungeonId, move, count]);
        }
    }
    
    // Migrate moves by turn
    if (enemyData.movesByTurn) {
        for (const [turnStr, turnMoves] of Object.entries(enemyData.movesByTurn)) {
            const turn = parseInt(turnStr);
            for (const [move, count] of Object.entries(turnMoves)) {
                await db.run(`
                    INSERT OR REPLACE INTO enemy_moves_by_turn (enemy_id, dungeon_id, turn, move, count)
                    VALUES (?, ?, ?, ?, ?)
                `, [enemyId, dungeonId, turn, move, count]);
            }
        }
    }
    
    // Migrate move sequences
    if (enemyData.moveSequences) {
        for (const [sequenceKey, nextMoves] of Object.entries(enemyData.moveSequences)) {
            for (const [nextMove, count] of Object.entries(nextMoves)) {
                await db.run(`
                    INSERT OR REPLACE INTO move_sequences (enemy_id, dungeon_id, sequence_key, next_move, count)
                    VALUES (?, ?, ?, ?, ?)
                `, [enemyId, dungeonId, sequenceKey, nextMove, count]);
            }
        }
    }
    
    // Migrate turn performance
    if (enemyData.turnPerformance) {
        for (const [turnStr, performance] of Object.entries(enemyData.turnPerformance)) {
            const turn = parseInt(turnStr);
            await db.run(`
                INSERT OR REPLACE INTO turn_performance (enemy_id, dungeon_id, turn, wins, losses, ties, total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                enemyId, dungeonId, turn,
                performance.wins || 0,
                performance.losses || 0, 
                performance.ties || 0,
                performance.total || 0
            ]);
        }
    }
}

async function migrateDungeon(db, dungeonId, dungeonEnemies) {
    let totalBattles = 0;
    let firstSeen = Date.now();
    let lastSeen = 0;
    
    // Calculate dungeon statistics from enemies
    for (const [enemyId, enemyData] of dungeonEnemies) {
        totalBattles += enemyData.totalBattles || 0;
        if (enemyData.firstSeen && enemyData.firstSeen < firstSeen) {
            firstSeen = enemyData.firstSeen;
        }
        if (enemyData.lastSeen && enemyData.lastSeen > lastSeen) {
            lastSeen = enemyData.lastSeen;
        }
    }
    
    await db.run(`
        INSERT OR REPLACE INTO dungeons (id, first_seen, last_seen, total_battles, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [dungeonId, firstSeen, lastSeen || firstSeen, totalBattles, Date.now(), Date.now()]);
}