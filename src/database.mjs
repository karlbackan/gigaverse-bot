/**
 * Database utilities for battle statistics
 * Manages SQLite database connections and operations
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Enable verbose mode for debugging
const db = sqlite3.verbose();

class DatabaseManager {
    constructor(dbPath = './data/battle-statistics.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.isInitialized = false;
        
        // Ensure data directory exists
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new db.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Failed to open database:', err);
                    reject(err);
                    return;
                }
                
                console.log(`📁 Connected to SQLite database: ${this.dbPath}`);
                this.setupDatabase().then(() => {
                    this.isInitialized = true;
                    console.log('✅ Database initialized successfully');
                    resolve();
                }).catch(reject);
            });
        });
    }
    
    async setupDatabase() {
        // Enable foreign key constraints
        await this.exec("PRAGMA foreign_keys = ON;");
        
        // Check if database is already set up
        const tables = await this.all(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `);
        
        if (tables.length > 0) {
            console.log(`📊 Database already contains ${tables.length} tables`);
            return;
        }
        
        // Create tables from schema
        console.log('🔨 Creating database tables...');
        const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }
        
        const schema = fs.readFileSync(schemaPath, 'utf8');
        const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            if (statement.trim()) {
                await this.exec(statement);
            }
        }
        
        console.log('✅ Database tables created successfully');
    }
    
    // Promisified database methods
    async exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
    
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    
    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
    
    // Statistics-specific methods
    
    async getOrCreateEnemy(enemyId, dungeonId) {
        let enemy = await this.get(`
            SELECT * FROM enemies 
            WHERE id = ? AND dungeon_id = ?
        `, [enemyId, dungeonId]);
        
        if (!enemy) {
            const now = Date.now();
            await this.run(`
                INSERT INTO enemies (id, dungeon_id, first_seen, last_seen)
                VALUES (?, ?, ?, ?)
            `, [enemyId, dungeonId, now, now]);
            
            enemy = await this.get(`
                SELECT * FROM enemies 
                WHERE id = ? AND dungeon_id = ?
            `, [enemyId, dungeonId]);
        }
        
        return enemy;
    }
    
    async recordBattle(battleData) {
        const {
            enemyId,
            dungeonId, 
            turn,
            timestamp,
            playerMove,
            enemyMove,
            result,
            sequenceKey,
            playerHealth,
            enemyHealth,
            playerStats,
            enemyStats,
            weaponStats,
            noobId,
            predictionMade,
            predictionCorrect,
            confidenceLevel
        } = battleData;
        
        // Convert 'draw' to 'tie' for database compatibility
        const normalizedResult = result === 'draw' ? 'tie' : result;
        
        // Insert battle record
        await this.run(`
            INSERT INTO battles (
                enemy_id, dungeon_id, turn, timestamp, player_move, enemy_move, result,
                sequence_key, player_health, enemy_health, player_stats, enemy_stats,
                weapon_stats, noob_id, prediction_made, prediction_correct, confidence_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            enemyId, dungeonId, turn, timestamp, playerMove, enemyMove, normalizedResult,
            sequenceKey, playerHealth, enemyHealth, 
            JSON.stringify(playerStats), JSON.stringify(enemyStats), JSON.stringify(weaponStats),
            noobId, predictionMade, predictionCorrect ? 1 : 0, confidenceLevel
        ]);
        
        // Update enemy statistics
        await this.updateEnemyStats(enemyId, dungeonId, normalizedResult, enemyMove, turn, timestamp);
        
        // Update move tracking
        await this.updateMoveTracking(enemyId, dungeonId, enemyMove, turn, sequenceKey);
    }
    
    async updateEnemyStats(enemyId, dungeonId, result, enemyMove, turn, timestamp) {
        // Get current stats
        const enemy = await this.getOrCreateEnemy(enemyId, dungeonId);
        
        // Calculate new statistics
        const totalBattles = enemy.total_battles + 1;
        let wins = enemy.wins;
        let losses = enemy.losses;
        let ties = enemy.ties;
        
        // Update win/loss from bot's perspective
        if (result === 'win') {
            losses++; // Bot won, so enemy lost
        } else if (result === 'loss') {
            wins++;   // Bot lost, so enemy won
        } else if (result === 'tie') {
            ties++;
        }
        
        const winRate = (wins + losses + ties) > 0 ? wins / (wins + losses + ties) : 0;
        
        // Update enemy record
        await this.run(`
            UPDATE enemies SET
                total_battles = ?,
                wins = ?,
                losses = ?,
                ties = ?,
                win_rate = ?,
                last_seen = ?,
                updated_at = ?
            WHERE id = ? AND dungeon_id = ?
        `, [totalBattles, wins, losses, ties, winRate, timestamp, Date.now(), enemyId, dungeonId]);
    }
    
    async updateMoveTracking(enemyId, dungeonId, enemyMove, turn, sequenceKey) {
        // Update move counts
        const existingMove = await this.get(`
            SELECT count FROM enemy_moves 
            WHERE enemy_id = ? AND dungeon_id = ? AND move = ?
        `, [enemyId, dungeonId, enemyMove]);
        
        if (existingMove) {
            await this.run(`
                UPDATE enemy_moves SET count = count + 1
                WHERE enemy_id = ? AND dungeon_id = ? AND move = ?
            `, [enemyId, dungeonId, enemyMove]);
        } else {
            await this.run(`
                INSERT INTO enemy_moves (enemy_id, dungeon_id, move, count)
                VALUES (?, ?, ?, 1)
            `, [enemyId, dungeonId, enemyMove]);
        }
        
        // Update move counts by turn
        const existingTurnMove = await this.get(`
            SELECT count FROM enemy_moves_by_turn 
            WHERE enemy_id = ? AND dungeon_id = ? AND turn = ? AND move = ?
        `, [enemyId, dungeonId, turn, enemyMove]);
        
        if (existingTurnMove) {
            await this.run(`
                UPDATE enemy_moves_by_turn SET count = count + 1
                WHERE enemy_id = ? AND dungeon_id = ? AND turn = ? AND move = ?
            `, [enemyId, dungeonId, turn, enemyMove]);
        } else {
            await this.run(`
                INSERT INTO enemy_moves_by_turn (enemy_id, dungeon_id, turn, move, count)
                VALUES (?, ?, ?, ?, 1)
            `, [enemyId, dungeonId, turn, enemyMove]);
        }
        
        // Update turn performance
        const existingTurnPerf = await this.get(`
            SELECT total FROM turn_performance 
            WHERE enemy_id = ? AND dungeon_id = ? AND turn = ?
        `, [enemyId, dungeonId, turn]);
        
        if (existingTurnPerf) {
            await this.run(`
                UPDATE turn_performance SET total = total + 1
                WHERE enemy_id = ? AND dungeon_id = ? AND turn = ?
            `, [enemyId, dungeonId, turn]);
        } else {
            await this.run(`
                INSERT INTO turn_performance (enemy_id, dungeon_id, turn, total)
                VALUES (?, ?, ?, 1)
            `, [enemyId, dungeonId, turn]);
        }
    }
    
    async getBattleStatistics() {
        const summary = await this.get(`SELECT * FROM battle_summary`);
        const enemies = await this.all(`SELECT * FROM enemy_summary ORDER BY total_battles DESC`);
        const dungeons = await this.all(`SELECT * FROM dungeons ORDER BY total_battles DESC`);
        
        return {
            summary,
            enemies,
            dungeons,
            lastUpdated: Date.now()
        };
    }
    
    async getEnemyStats(enemyId, dungeonId) {
        const enemy = await this.get(`SELECT * FROM enemy_summary WHERE id = ? AND dungeon_id = ?`, [enemyId, dungeonId]);
        const recentBattles = await this.all(`
            SELECT * FROM battles 
            WHERE enemy_id = ? AND dungeon_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 50
        `, [enemyId, dungeonId]);
        
        return {
            enemy,
            recentBattles
        };
    }
    
    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err);
                    } else {
                        console.log('📁 Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
    
    // Utility methods
    async vacuum() {
        await this.exec("VACUUM;");
        console.log('🧹 Database vacuumed');
    }
    
    async analyze() {
        await this.exec("ANALYZE;");
        console.log('📈 Database statistics updated');
    }
    
    async getTableSizes() {
        const tables = await this.all(`
            SELECT 
                name,
                COUNT(*) as row_count
            FROM sqlite_master m
            JOIN pragma_table_info(m.name) p
            WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'
            GROUP BY name
            ORDER BY row_count DESC
        `);
        
        return tables;
    }
}

// Singleton instance
let dbInstance = null;

export function getDatabase(dbPath) {
    if (!dbInstance) {
        dbInstance = new DatabaseManager(dbPath);
    }
    return dbInstance;
}

export default DatabaseManager;