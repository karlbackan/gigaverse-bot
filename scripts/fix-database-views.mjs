#!/usr/bin/env node
/**
 * Fix database views with corrected column references
 */

import { getDatabase } from '../src/database.mjs';

console.log('🔧 Fixing database views...');

const db = getDatabase();

try {
    await db.initialize();
    
    console.log('🗑️  Dropping existing views...');
    await db.exec(`DROP VIEW IF EXISTS enemy_summary`);
    await db.exec(`DROP VIEW IF EXISTS battle_summary`);
    
    console.log('🔨 Creating corrected views...');
    
    // Create corrected enemy summary view
    await db.exec(`
        CREATE VIEW enemy_summary AS
        SELECT 
            e.id,
            e.dungeon_id,
            e.total_battles,
            e.wins,
            e.losses, 
            e.ties,
            e.win_rate,
            e.prediction_accuracy,
            COALESCE(rm.count, 0) as rock_moves,
            COALESCE(pm.count, 0) as paper_moves,
            COALESCE(sm.count, 0) as scissor_moves,
            e.last_seen,
            e.dominant_strategy
        FROM enemies e
        LEFT JOIN enemy_moves rm ON e.id = rm.enemy_id AND e.dungeon_id = rm.dungeon_id AND rm.move = 'rock'
        LEFT JOIN enemy_moves pm ON e.id = pm.enemy_id AND e.dungeon_id = pm.dungeon_id AND pm.move = 'paper'  
        LEFT JOIN enemy_moves sm ON e.id = sm.enemy_id AND e.dungeon_id = rm.dungeon_id AND sm.move = 'scissor'
    `);
    
    // Create battle summary view
    await db.exec(`
        CREATE VIEW battle_summary AS
        SELECT 
            COUNT(*) as total_battles,
            SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as bot_wins,
            SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as bot_losses,
            SUM(CASE WHEN result = 'tie' THEN 1 ELSE 0 END) as ties,
            AVG(CASE WHEN result = 'win' THEN 1.0 ELSE 0.0 END) as bot_win_rate,
            MIN(timestamp) as first_battle,
            MAX(timestamp) as last_battle
        FROM battles
    `);
    
    console.log('✅ Database views fixed successfully!');
    
    // Test the views
    console.log('🧪 Testing views...');
    const battleSummary = await db.get(`SELECT * FROM battle_summary`);
    console.log('Battle Summary:', battleSummary);
    
    const enemies = await db.all(`SELECT * FROM enemy_summary LIMIT 3`);
    console.log(`Enemy Summary (${enemies.length} records):`, enemies);
    
    await db.close();
    
} catch (error) {
    console.error('❌ Failed to fix views:', error);
    await db.close();
    process.exit(1);
}