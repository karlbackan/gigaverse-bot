#!/usr/bin/env node
/**
 * Migration script to enhance ML data collection
 */

import { getDatabase } from '../src/database.mjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrateToEnhancedML() {
    console.log('🔧 Migrating to Enhanced ML Data Collection...\n');
    
    const db = getDatabase('./data/battle-statistics.db');
    await db.initialize();
    
    try {
        // Read and execute enhanced schema
        const schemaPath = join(__dirname, '..', 'database', 'enhanced-ml-schema.sql');
        const schema = readFileSync(schemaPath, 'utf8');
        
        console.log('📊 Creating enhanced ML tables and indexes...');
        
        // Split and execute each statement
        const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            try {
                await db.run(statement.trim());
            } catch (error) {
                // Ignore "table already exists" errors
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }
        
        console.log('✅ Enhanced ML schema created successfully');
        
        // Migrate existing data to new structure
        console.log('\n📈 Migrating existing battle data...');
        
        // Get all existing battles
        const battles = await db.all(`
            SELECT id, enemy_id, dungeon_id, turn, enemy_move, player_move, 
                   result, timestamp, enemy_stats, weapon_stats, prediction_made, prediction_correct
            FROM battles 
            ORDER BY enemy_id, timestamp
        `);
        
        console.log(`Processing ${battles.length} battles...`);
        
        let migratedCount = 0;
        let enemySequences = {}; // Track sequences per enemy
        
        for (const battle of battles) {
            const enemyKey = `${battle.enemy_id}-${battle.dungeon_id}`;
            
            if (!enemySequences[enemyKey]) {
                enemySequences[enemyKey] = [];
            }
            
            // Add current move to sequence
            enemySequences[enemyKey].push({
                move: battle.enemy_move,
                timestamp: battle.timestamp,
                turn: battle.turn,
                battleId: battle.id,
                result: battle.result,
                prediction: battle.prediction_made,
                correct: battle.prediction_correct
            });
            
            // Process sequences when we have enough data
            if (enemySequences[enemyKey].length >= 4) { // Need at least 4 for 3rd order
                const sequence = enemySequences[enemyKey];
                const lastIndex = sequence.length - 1;
                const currentMove = sequence[lastIndex];
                
                // Create Markov sequences (1st, 2nd, 3rd order)
                for (let order = 1; order <= 3 && order <= lastIndex; order++) {
                    const pattern = sequence.slice(lastIndex - order, lastIndex).map(s => s.move).join('-');
                    const nextMove = currentMove.move;
                    
                    // Insert/update markov sequence
                    await db.run(`
                        INSERT OR REPLACE INTO markov_sequences 
                        (enemy_id, dungeon_id, order_level, sequence_pattern, next_move, count, last_updated)
                        VALUES (?, ?, ?, ?, ?, 
                            COALESCE((SELECT count + 1 FROM markov_sequences 
                                     WHERE enemy_id = ? AND dungeon_id = ? AND order_level = ? 
                                     AND sequence_pattern = ? AND next_move = ?), 1),
                            ?
                        )
                    `, [battle.enemy_id, battle.dungeon_id, order, pattern, nextMove,
                        battle.enemy_id, battle.dungeon_id, order, pattern, nextMove,
                        battle.timestamp]);
                }
                
                // Extract and store weapon stats if available
                if (battle.enemy_stats) {
                    try {
                        const stats = JSON.parse(battle.enemy_stats);
                        if (stats.weapons) {
                            // Determine encounter ID (reset when turn = 1)
                            const encounterId = sequence.filter(s => s.turn === 1).length;
                            
                            await db.run(`
                                INSERT OR REPLACE INTO enemy_weapon_stats
                                (enemy_id, dungeon_id, encounter_id, rock_attack, rock_defense,
                                 paper_attack, paper_defense, scissor_attack, scissor_defense,
                                 total_attack_power, first_seen_timestamp, last_updated)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                battle.enemy_id, battle.dungeon_id, encounterId,
                                stats.weapons.rock?.attack || 0, stats.weapons.rock?.defense || 0,
                                stats.weapons.paper?.attack || 0, stats.weapons.paper?.defense || 0,
                                stats.weapons.scissor?.attack || 0, stats.weapons.scissor?.defense || 0,
                                (stats.weapons.rock?.attack || 0) + (stats.weapons.paper?.attack || 0) + (stats.weapons.scissor?.attack || 0),
                                battle.timestamp, battle.timestamp
                            ]);
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
            
            migratedCount++;
            
            if (migratedCount % 100 === 0) {
                console.log(`   Processed ${migratedCount}/${battles.length} battles...`);
            }
        }
        
        console.log(`✅ Migrated ${migratedCount} battles to enhanced structure`);
        
        // Calculate entropy for all enemies
        console.log('\n🧮 Pre-calculating entropy and predictability metrics...');
        
        const enemies = await db.all(`
            SELECT DISTINCT enemy_id, dungeon_id, COUNT(*) as battle_count
            FROM battles 
            GROUP BY enemy_id, dungeon_id
            HAVING battle_count >= 5
        `);
        
        for (const enemy of enemies) {
            // Get move sequence for entropy calculation
            const moves = await db.all(`
                SELECT enemy_move 
                FROM battles 
                WHERE enemy_id = ? AND dungeon_id = ?
                ORDER BY timestamp
            `, [enemy.enemy_id, enemy.dungeon_id]);
            
            // Calculate move frequencies
            const moveCounts = { rock: 0, paper: 0, scissor: 0 };
            moves.forEach(m => moveCounts[m.enemy_move]++);
            
            const total = moves.length;
            const frequencies = {
                rock: moveCounts.rock / total,
                paper: moveCounts.paper / total,
                scissor: moveCounts.scissor / total
            };
            
            // Calculate Shannon entropy
            let entropy = 0;
            Object.values(frequencies).forEach(freq => {
                if (freq > 0) {
                    entropy -= freq * Math.log2(freq);
                }
            });
            
            // Classify predictability
            let classification = 'unknown';
            let predictabilityScore = 0.5;
            
            if (entropy < 1.0) {
                classification = 'predictable';
                predictabilityScore = 1.0 - (entropy / 1.0);
            } else if (entropy > 1.5) {
                classification = 'random';
                predictabilityScore = 0.2;
            } else {
                classification = 'semi-predictable';
                predictabilityScore = 0.6;
            }
            
            // Store entropy cache
            await db.run(`
                INSERT OR REPLACE INTO enemy_entropy_cache
                (enemy_id, dungeon_id, current_entropy, predictability_score, classification,
                 rock_frequency, paper_frequency, scissor_frequency, total_battles, cache_valid)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
                enemy.enemy_id, enemy.dungeon_id, entropy, predictabilityScore, classification,
                frequencies.rock, frequencies.paper, frequencies.scissor, total
            ]);
        }
        
        console.log(`✅ Pre-calculated entropy for ${enemies.length} enemies`);
        
        // Initialize strategy performance tracking
        console.log('\n🎯 Initializing strategy performance tracking...');
        
        for (const enemy of enemies) {
            const strategies = ['markov_1', 'markov_2', 'markov_3', 'frequency', 'turn_pattern', 
                              'stats_enhanced', 'thompson_sampling', 'ensemble'];
            
            for (const strategy of strategies) {
                await db.run(`
                    INSERT OR IGNORE INTO strategy_performance
                    (enemy_id, dungeon_id, strategy_name, successes, failures, total_predictions, alpha_param, beta_param)
                    VALUES (?, ?, ?, 0, 0, 0, 1.0, 1.0)
                `, [enemy.enemy_id, enemy.dungeon_id, strategy]);
            }
        }
        
        console.log('✅ Strategy performance tracking initialized');
        
        // Verify migration
        console.log('\n🔍 Verifying enhanced ML data...');
        
        const sequenceCount = await db.get('SELECT COUNT(*) as count FROM markov_sequences');
        const weaponStatsCount = await db.get('SELECT COUNT(*) as count FROM enemy_weapon_stats'); 
        const entropyCount = await db.get('SELECT COUNT(*) as count FROM enemy_entropy_cache');
        const strategyCount = await db.get('SELECT COUNT(*) as count FROM strategy_performance');
        
        console.log(`   Markov sequences: ${sequenceCount.count}`);
        console.log(`   Weapon stats: ${weaponStatsCount.count}`);
        console.log(`   Entropy cache: ${entropyCount.count}`);
        console.log(`   Strategy tracking: ${strategyCount.count}`);
        
        console.log('\n🎊 Enhanced ML migration completed successfully!');
        console.log('\n📊 Enhanced Features Now Available:');
        console.log('   ✅ Multi-order Markov chains (1st, 2nd, 3rd order)');
        console.log('   ✅ Thompson sampling with Beta distribution tracking');
        console.log('   ✅ Pre-calculated entropy and predictability classification'); 
        console.log('   ✅ Weapon stat correlation analysis');
        console.log('   ✅ Method-specific prediction tracking');
        console.log('   ✅ Algorithm performance metrics');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateToEnhancedML().catch(console.error);
}

export { migrateToEnhancedML };