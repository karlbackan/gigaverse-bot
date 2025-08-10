/**
 * Database-backed Statistics Engine
 * Replaces the JSON-based statistics engine with SQLite database storage
 */

import { getDatabase } from './database.mjs';
import { config } from './config.mjs';

export class DatabaseStatisticsEngine {
    constructor(dbPath = './data/battle-statistics.db') {
        this.db = getDatabase(dbPath);
        this.isInitialized = false;
        
        // Session data for immediate access
        this.sessionData = {
            startTime: Date.now(),
            battles: [],
            enemies: new Map()
        };
        
        this.currentDungeonType = 1; // Default to Dungetron 5000
        this.lastPrediction = null; // Track last prediction for validation
        
        // Initialize database connection
        this.initializeAsync();
    }
    
    async initializeAsync() {
        try {
            await this.db.initialize();
            this.isInitialized = true;
            console.log('✅ Database statistics engine initialized');
        } catch (error) {
            console.error('❌ Failed to initialize database statistics engine:', error);
        }
    }
    
    // Ensure database is ready before operations
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initializeAsync();
        }
    }
    
    async recordTurn(enemyId, turn, playerAction, enemyAction, result, playerStats, enemyStats, weaponStats, noobId, timestamp) {
        await this.ensureInitialized();
        
        try {
            // Build sequence key from recent moves
            const sequenceKey = this.buildSequenceKey(enemyId, this.currentDungeonType, playerAction, enemyAction);
            
            // Record battle in database
            const battleData = {
                enemyId: parseInt(enemyId),
                dungeonId: this.currentDungeonType,
                turn: parseInt(turn),
                timestamp: timestamp || Date.now(),
                playerMove: playerAction,
                enemyMove: enemyAction,
                result: result,
                sequenceKey: sequenceKey,
                playerHealth: playerStats?.health,
                enemyHealth: enemyStats?.health,
                playerStats: playerStats,
                enemyStats: enemyStats,
                weaponStats: weaponStats,
                noobId: noobId,
                predictionMade: this.lastPrediction,
                predictionCorrect: this.lastPrediction === enemyAction,
                confidenceLevel: this.getConfidenceLevel(enemyId)
            };
            
            await this.db.recordBattle(battleData);
            
            // Also record in session data for immediate access
            this.updateSessionData(enemyId, battleData);
            
            console.log(`📊 Recorded battle: Enemy ${enemyId} T${turn}: ${playerAction}→${enemyAction} ${result}`);
            
        } catch (error) {
            console.error('❌ Failed to record battle turn:', error);
            // Fall back to console logging if database fails
            console.log(`📊 Battle (DB FAILED): Enemy ${enemyId} T${turn}: ${playerAction}→${enemyAction} ${result}`);
        }
    }
    
    buildSequenceKey(enemyId, dungeonId, playerAction, enemyAction) {
        // Get recent moves from session data to build sequence
        const sessionEnemy = this.sessionData.enemies.get(`${enemyId}-${dungeonId}`);
        if (sessionEnemy && sessionEnemy.recentMoves && sessionEnemy.recentMoves.length > 0) {
            const lastMove = sessionEnemy.recentMoves[sessionEnemy.recentMoves.length - 1];
            return `${lastMove}-${enemyAction}`;
        }
        return null;
    }
    
    updateSessionData(enemyId, battleData) {
        const key = `${enemyId}-${battleData.dungeonId}`;
        
        if (!this.sessionData.enemies.has(key)) {
            this.sessionData.enemies.set(key, {
                id: enemyId,
                dungeonId: battleData.dungeonId,
                battles: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                recentMoves: [],
                recentBattles: []
            });
        }
        
        const enemy = this.sessionData.enemies.get(key);
        enemy.battles++;
        
        // Update win/loss from bot's perspective
        const normalizedResult = battleData.result === 'draw' ? 'tie' : battleData.result;
        if (normalizedResult === 'win') {
            enemy.losses++; // Bot won, enemy lost
        } else if (normalizedResult === 'loss') {
            enemy.wins++;   // Bot lost, enemy won
        } else if (normalizedResult === 'tie') {
            enemy.ties++;
        }
        
        // Track recent moves
        enemy.recentMoves.push(battleData.enemyMove);
        if (enemy.recentMoves.length > 10) {
            enemy.recentMoves.shift();
        }
        
        // Track recent battles
        enemy.recentBattles.push(battleData);
        if (enemy.recentBattles.length > 50) {
            enemy.recentBattles.shift();
        }
        
        this.sessionData.battles.push(battleData);
    }
    
    getConfidenceLevel(enemyId) {
        const key = `${enemyId}-${this.currentDungeonType}`;
        const enemy = this.sessionData.enemies.get(key);
        
        if (!enemy || enemy.battles < 5) {
            return 0.5; // Default confidence for new enemies
        }
        
        // Calculate confidence based on battle count and consistency
        const battleFactor = Math.min(enemy.battles / 30, 1.0); // More battles = higher confidence
        const consistency = this.calculateConsistency(enemy.recentMoves);
        
        return Math.min(battleFactor * consistency, 0.95);
    }
    
    calculateConsistency(recentMoves) {
        if (!recentMoves || recentMoves.length < 3) return 0.3;
        
        // Simple consistency measure based on move diversity
        const unique = new Set(recentMoves).size;
        const total = recentMoves.length;
        
        // Higher consistency = lower diversity (more predictable)
        return 1.0 - (unique / 3.0) * 0.7; // 0.3 to 1.0 range
    }
    
    async predictEnemyMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId) {
        await this.ensureInitialized();
        
        try {
            // Get enemy data from database
            const enemyData = await this.db.getEnemyStats(parseInt(enemyId), this.currentDungeonType);
            
            if (!enemyData.enemy || enemyData.enemy.total_battles < 3) {
                // Not enough data, use random prediction
                const moves = ['rock', 'paper', 'scissor'];
                const prediction = moves[Math.floor(Math.random() * moves.length)];
                this.lastPrediction = prediction;
                return prediction;
            }
            
            // Use multiple prediction strategies and combine them
            const predictions = await Promise.all([
                this.predictByMoveFrequency(enemyId),
                this.predictByTurnPattern(enemyId, turn),
                this.predictBySequence(enemyId),
                this.predictBySessionData(enemyId)
            ]);
            
            // Weight and combine predictions
            const finalPrediction = this.combinePredictions(predictions);
            this.lastPrediction = finalPrediction;
            
            console.log(`🎯 Predicted Enemy ${enemyId} T${turn}: ${finalPrediction} (confidence: ${this.getConfidenceLevel(enemyId).toFixed(2)})`);
            
            return finalPrediction;
            
        } catch (error) {
            console.error('❌ Prediction failed, using fallback:', error);
            
            // Fallback to session data or random
            const sessionPrediction = this.predictBySessionData(enemyId);
            this.lastPrediction = sessionPrediction;
            return sessionPrediction;
        }
    }
    
    async predictByMoveFrequency(enemyId) {
        const moves = await this.db.all(`
            SELECT move, count 
            FROM enemy_moves 
            WHERE enemy_id = ? AND dungeon_id = ?
            ORDER BY count DESC
        `, [parseInt(enemyId), this.currentDungeonType]);
        
        if (moves.length === 0) return 'rock';
        
        // Return most frequent move
        return moves[0].move;
    }
    
    async predictByTurnPattern(enemyId, turn) {
        const turnMoves = await this.db.all(`
            SELECT move, count 
            FROM enemy_moves_by_turn 
            WHERE enemy_id = ? AND dungeon_id = ? AND turn = ?
            ORDER BY count DESC
        `, [parseInt(enemyId), this.currentDungeonType, turn]);
        
        if (turnMoves.length === 0) {
            // Fallback to overall frequency
            return this.predictByMoveFrequency(enemyId);
        }
        
        return turnMoves[0].move;
    }
    
    async predictBySequence(enemyId) {
        // Get recent battle to find last enemy move
        const lastBattle = await this.db.get(`
            SELECT enemy_move 
            FROM battles 
            WHERE enemy_id = ? AND dungeon_id = ?
            ORDER BY timestamp DESC 
            LIMIT 1
        `, [parseInt(enemyId), this.currentDungeonType]);
        
        if (!lastBattle) return 'rock';
        
        // Find most common next move after this sequence
        const sequences = await this.db.all(`
            SELECT next_move, count
            FROM move_sequences 
            WHERE enemy_id = ? AND dungeon_id = ? AND sequence_key LIKE ?
            ORDER BY count DESC
        `, [parseInt(enemyId), this.currentDungeonType, `%-${lastBattle.enemy_move}`]);
        
        if (sequences.length === 0) {
            return this.predictByMoveFrequency(enemyId);
        }
        
        return sequences[0].next_move;
    }
    
    predictBySessionData(enemyId) {
        const key = `${enemyId}-${this.currentDungeonType}`;
        const enemy = this.sessionData.enemies.get(key);
        
        if (!enemy || enemy.recentMoves.length === 0) {
            const moves = ['rock', 'paper', 'scissor'];
            return moves[Math.floor(Math.random() * moves.length)];
        }
        
        // Count frequency in recent moves
        const counts = { rock: 0, paper: 0, scissor: 0 };
        enemy.recentMoves.forEach(move => counts[move]++);
        
        // Return most frequent recent move
        let maxCount = 0;
        let prediction = 'rock';
        
        for (const [move, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                prediction = move;
            }
        }
        
        return prediction;
    }
    
    combinePredictions(predictions) {
        // Simple majority vote with fallback
        const counts = { rock: 0, paper: 0, scissor: 0 };
        
        predictions.forEach(prediction => {
            if (prediction && counts[prediction] !== undefined) {
                counts[prediction]++;
            }
        });
        
        // Find most voted prediction
        let maxVotes = 0;
        let winner = 'rock';
        
        for (const [move, votes] of Object.entries(counts)) {
            if (votes > maxVotes) {
                maxVotes = votes;
                winner = move;
            }
        }
        
        return winner;
    }
    
    setCurrentDungeonType(dungeonType) {
        this.currentDungeonType = dungeonType;
        console.log(`🏛️  Statistics engine set to dungeon type: ${dungeonType}`);
    }
    
    // Compatibility method for DecisionEngine
    setDungeonType(dungeonType) {
        this.setCurrentDungeonType(dungeonType);
    }
    
    // Compatibility methods for DecisionEngine
    async predictNextMove(enemyId, turn, playerStats, enemyStats, weaponStats, noobId, possibleMoves = null) {
        await this.ensureInitialized();
        
        try {
            // Get enemy data from database
            const enemyData = await this.db.getEnemyStats(parseInt(enemyId), this.currentDungeonType);
            
            if (!enemyData.enemy || enemyData.enemy.total_battles < 3) {
                // Not enough data, return random prediction with low confidence
                return {
                    predictions: { rock: 0.33, paper: 0.33, scissor: 0.34 },
                    confidence: 0.2,
                    weaponScores: { rock: 0, paper: 0, scissor: 0 },
                    possibleMoves: possibleMoves
                };
            }
            
            // Get move frequencies from database
            const moves = await this.db.all(`
                SELECT move, count 
                FROM enemy_moves 
                WHERE enemy_id = ? AND dungeon_id = ?
                ORDER BY count DESC
            `, [parseInt(enemyId), this.currentDungeonType]);
            
            // Calculate move probabilities
            const totalMoves = moves.reduce((sum, move) => sum + move.count, 0);
            const predictions = { rock: 0, paper: 0, scissor: 0 };
            
            if (totalMoves > 0) {
                moves.forEach(move => {
                    predictions[move.move] = move.count / totalMoves;
                });
            } else {
                predictions.rock = 0.33;
                predictions.paper = 0.33;
                predictions.scissor = 0.34;
            }
            
            // Filter to only possible moves if provided
            if (possibleMoves && possibleMoves.length < 3) {
                const filteredPredictions = { rock: 0, paper: 0, scissor: 0 };
                let totalFiltered = 0;
                
                possibleMoves.forEach(move => {
                    filteredPredictions[move] = predictions[move];
                    totalFiltered += predictions[move];
                });
                
                // Normalize probabilities
                if (totalFiltered > 0) {
                    possibleMoves.forEach(move => {
                        filteredPredictions[move] = filteredPredictions[move] / totalFiltered;
                    });
                }
                
                Object.assign(predictions, filteredPredictions);
            }
            
            // Calculate weapon scores (simple counter-based scoring)
            const weaponScores = { rock: 0, paper: 0, scissor: 0 };
            
            // Score based on what beats the most likely enemy moves
            weaponScores.rock = predictions.scissor; // Rock beats scissor
            weaponScores.paper = predictions.rock;   // Paper beats rock
            weaponScores.scissor = predictions.paper; // Scissor beats paper
            
            // Calculate confidence based on data quality and consistency
            const confidence = this.getConfidenceLevel(enemyId);
            
            return {
                predictions: predictions,
                confidence: confidence,
                weaponScores: weaponScores,
                possibleMoves: possibleMoves
            };
            
        } catch (error) {
            console.error('❌ Prediction failed, using fallback:', error);
            
            // Fallback prediction
            return {
                predictions: { rock: 0.33, paper: 0.33, scissor: 0.34 },
                confidence: 0.1,
                weaponScores: { rock: 0, paper: 0, scissor: 0 },
                possibleMoves: possibleMoves
            };
        }
    }
    
    async getBattleCount(enemyId) {
        const stats = await this.getEnemyStatistics(enemyId);
        return stats.enemy ? stats.enemy.total_battles : 0;
    }
    
    async recordBattle(battleData) {
        // Convert to the format expected by recordTurn
        return await this.recordTurn(
            battleData.enemyId,
            battleData.turn,
            battleData.playerAction,
            battleData.enemyAction,
            battleData.result,
            battleData.playerStats,
            battleData.enemyStats,
            battleData.weaponStats,
            battleData.noobId,
            battleData.timestamp
        );
    }
    
    async getAnalysisReport(enemyId = null) {
        if (enemyId) {
            const stats = await this.getEnemyStatistics(enemyId);
            const weakness = await this.analyzeEnemyWeakness(enemyId);
            
            return {
                enemy: stats.enemy,
                weakness: weakness,
                battleCount: stats.enemy ? stats.enemy.total_battles : 0,
                winRate: stats.enemy ? stats.enemy.win_rate : 0,
                recentBattles: stats.recentBattles ? stats.recentBattles.slice(0, 10) : []
            };
        } else {
            // Return overall analysis
            const summary = await this.getBattleSummary();
            return {
                summary: summary.summary,
                enemies: summary.enemies,
                dungeons: summary.dungeons
            };
        }
    }
    
    saveData() {
        // Database automatically saves, so this is a no-op for compatibility
        console.log('📊 Database statistics automatically saved');
    }
    
    // Compatibility property getter for enemyStats
    get enemyStats() {
        // Return a mock structure that matches the old format for compatibility
        // This is mainly used by DecisionEngine.getFavoriteEnemyMove()
        return {
            [this.currentDungeonType]: new Map()
        };
    }
    
    async getEnemyStatistics(enemyId) {
        await this.ensureInitialized();
        
        try {
            return await this.db.getEnemyStats(parseInt(enemyId), this.currentDungeonType);
        } catch (error) {
            console.error('❌ Failed to get enemy statistics:', error);
            
            // Fallback to session data
            const key = `${enemyId}-${this.currentDungeonType}`;
            const sessionEnemy = this.sessionData.enemies.get(key);
            
            return {
                enemy: sessionEnemy || {
                    id: enemyId,
                    total_battles: 0,
                    wins: 0,
                    losses: 0,
                    ties: 0,
                    win_rate: 0
                },
                recentBattles: sessionEnemy?.recentBattles || []
            };
        }
    }
    
    async getBattleSummary() {
        await this.ensureInitialized();
        
        try {
            return await this.db.getBattleStatistics();
        } catch (error) {
            console.error('❌ Failed to get battle summary:', error);
            
            // Fallback to session data
            let totalBattles = this.sessionData.battles.length;
            let botWins = 0;
            let botLosses = 0;
            let ties = 0;
            
            this.sessionData.battles.forEach(battle => {
                if (battle.result === 'win') botWins++;
                else if (battle.result === 'loss') botLosses++;
                else if (battle.result === 'tie') ties++;
            });
            
            return {
                summary: {
                    total_battles: totalBattles,
                    bot_wins: botWins,
                    bot_losses: botLosses,
                    ties: ties,
                    bot_win_rate: totalBattles > 0 ? botWins / totalBattles : 0
                },
                lastUpdated: Date.now()
            };
        }
    }
    
    // Method to analyze and suggest enemy weaknesses
    async analyzeEnemyWeakness(enemyId) {
        const stats = await this.getEnemyStatistics(enemyId);
        
        if (!stats.enemy || stats.enemy.total_battles < 10) {
            return 'Insufficient data for analysis';
        }
        
        // Simple weakness analysis based on move frequency
        try {
            const moves = await this.db.all(`
                SELECT move, count 
                FROM enemy_moves 
                WHERE enemy_id = ? AND dungeon_id = ?
                ORDER BY count DESC
            `, [parseInt(enemyId), this.currentDungeonType]);
            
            if (moves.length > 0) {
                const dominantMove = moves[0].move;
                const counter = {
                    'rock': 'paper',
                    'paper': 'scissor', 
                    'scissor': 'rock'
                };
                
                return `Favors ${dominantMove} - counter with ${counter[dominantMove]}`;
            }
            
        } catch (error) {
            console.error('❌ Weakness analysis failed:', error);
        }
        
        return 'Pattern analysis in progress';
    }
    
    // Cleanup method
    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}

export default DatabaseStatisticsEngine;