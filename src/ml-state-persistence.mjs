/**
 * ML State Persistence Manager
 * Saves and loads ML model states to/from database for continuity between sessions
 */

import fs from 'fs';
import path from 'path';

export class MLStatePersistence {
    constructor(dbPath = './data/battle-statistics.db') {
        this.dbPath = dbPath;
        this.stateFile = dbPath.replace('.db', '-ml-state.json');
        this.backupFile = dbPath.replace('.db', '-ml-state-backup.json');
    }
    
    async saveMLState(mlEngine) {
        try {
            const state = {
                // Multi-Armed Bandit state
                banditArms: this.serializeMap(mlEngine.bandit.arms),
                banditEpsilon: mlEngine.bandit.epsilon,
                
                // Q-Learning state
                qLearningStates: this.serializeNestedMap(mlEngine.qLearning.states),
                qLearningEpsilon: mlEngine.qLearning.epsilon,
                qLearningAlpha: mlEngine.qLearning.alpha,
                qLearningGamma: mlEngine.qLearning.gamma,
                
                // Opponent models
                opponentModels: this.serializeMap(mlEngine.opponentModels),
                
                // Neural network weights
                neuralNetWeights: {
                    weightsIH: mlEngine.neuralNet.weightsIH,
                    weightsHO: mlEngine.neuralNet.weightsHO,
                    biasH: mlEngine.neuralNet.biasH,
                    biasO: mlEngine.neuralNet.biasO,
                    momentumIH: mlEngine.neuralNet.momentumIH,
                    momentumHO: mlEngine.neuralNet.momentumHO,
                    momentumBH: mlEngine.neuralNet.momentumBH,
                    momentumBO: mlEngine.neuralNet.momentumBO
                },
                
                // Meta-learning state
                metaLearning: {
                    opponentTypes: this.serializeMap(mlEngine.metaLearning.opponentTypes),
                    strategyEffectiveness: this.serializeMap(mlEngine.metaLearning.strategyEffectiveness),
                    typeClassifierWeights: mlEngine.metaLearning.typeClassifier.weights
                },
                
                // Battle history (keep last 200 for memory efficiency)
                battleHistory: mlEngine.battleHistory.slice(-200),
                
                // Metadata
                saveTimestamp: Date.now(),
                version: '1.0.0'
            };
            
            // Backup existing state
            if (fs.existsSync(this.stateFile)) {
                fs.copyFileSync(this.stateFile, this.backupFile);
            }
            
            // Save new state
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
            
            console.log('💾 ML state saved successfully');
            console.log(`  Bandit arms: ${Object.keys(state.banditArms).length}`);
            console.log(`  Q-states: ${Object.keys(state.qLearningStates).length}`);
            console.log(`  Opponent models: ${Object.keys(state.opponentModels).length}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to save ML state:', error);
            return false;
        }
    }
    
    async loadMLState(mlEngine) {
        try {
            if (!fs.existsSync(this.stateFile)) {
                console.log('📁 No saved ML state found - starting fresh');
                return false;
            }
            
            const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            
            // Validate state version
            if (!state.version || state.version !== '1.0.0') {
                console.log('⚠️ ML state version mismatch - starting fresh');
                return false;
            }
            
            // Restore Multi-Armed Bandit
            if (state.banditArms) {
                mlEngine.bandit.arms.clear();
                for (const [strategy, armData] of Object.entries(state.banditArms)) {
                    mlEngine.bandit.arms.set(strategy, armData);
                }
                mlEngine.bandit.epsilon = state.banditEpsilon || 0.1;
            }
            
            // Restore Q-Learning states
            if (state.qLearningStates) {
                mlEngine.qLearning.states.clear();
                for (const [stateKey, actionValuesObj] of Object.entries(state.qLearningStates)) {
                    const actionValues = new Map(Object.entries(actionValuesObj));
                    mlEngine.qLearning.states.set(stateKey, actionValues);
                }
                mlEngine.qLearning.epsilon = state.qLearningEpsilon || 0.1;
                mlEngine.qLearning.alpha = state.qLearningAlpha || 0.1;
                mlEngine.qLearning.gamma = state.qLearningGamma || 0.9;
            }
            
            // Restore opponent models
            if (state.opponentModels) {
                mlEngine.opponentModels.clear();
                for (const [enemyId, model] of Object.entries(state.opponentModels)) {
                    mlEngine.opponentModels.set(enemyId, model);
                }
            }
            
            // Restore neural network weights
            if (state.neuralNetWeights) {
                const weights = state.neuralNetWeights;
                mlEngine.neuralNet.weightsIH = weights.weightsIH || mlEngine.neuralNet.weightsIH;
                mlEngine.neuralNet.weightsHO = weights.weightsHO || mlEngine.neuralNet.weightsHO;
                mlEngine.neuralNet.biasH = weights.biasH || mlEngine.neuralNet.biasH;
                mlEngine.neuralNet.biasO = weights.biasO || mlEngine.neuralNet.biasO;
                mlEngine.neuralNet.momentumIH = weights.momentumIH || mlEngine.neuralNet.momentumIH;
                mlEngine.neuralNet.momentumHO = weights.momentumHO || mlEngine.neuralNet.momentumHO;
                mlEngine.neuralNet.momentumBH = weights.momentumBH || mlEngine.neuralNet.momentumBH;
                mlEngine.neuralNet.momentumBO = weights.momentumBO || mlEngine.neuralNet.momentumBO;
            }
            
            // Restore meta-learning
            if (state.metaLearning) {
                if (state.metaLearning.opponentTypes) {
                    mlEngine.metaLearning.opponentTypes.clear();
                    for (const [enemyId, type] of Object.entries(state.metaLearning.opponentTypes)) {
                        mlEngine.metaLearning.opponentTypes.set(enemyId, type);
                    }
                }
                
                if (state.metaLearning.strategyEffectiveness) {
                    mlEngine.metaLearning.strategyEffectiveness.clear();
                    for (const [opponentType, effectiveness] of Object.entries(state.metaLearning.strategyEffectiveness)) {
                        mlEngine.metaLearning.strategyEffectiveness.set(opponentType, effectiveness);
                    }
                }
                
                if (state.metaLearning.typeClassifierWeights) {
                    mlEngine.metaLearning.typeClassifier.weights = state.metaLearning.typeClassifierWeights;
                }
            }
            
            // Restore battle history
            if (state.battleHistory) {
                mlEngine.battleHistory = state.battleHistory;
            }
            
            const ageHours = (Date.now() - state.saveTimestamp) / (1000 * 60 * 60);
            
            console.log('🧠 ML state loaded successfully');
            console.log(`  State age: ${ageHours.toFixed(1)} hours`);
            console.log(`  Bandit arms: ${mlEngine.bandit.arms.size}`);
            console.log(`  Q-states: ${mlEngine.qLearning.states.size}`);
            console.log(`  Opponent models: ${mlEngine.opponentModels.size}`);
            console.log(`  Battle history: ${mlEngine.battleHistory.length} battles`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to load ML state:', error);
            
            // Try to restore from backup
            if (fs.existsSync(this.backupFile)) {
                console.log('🔄 Attempting to restore from backup...');
                try {
                    fs.copyFileSync(this.backupFile, this.stateFile);
                    return await this.loadMLState(mlEngine);
                } catch (backupError) {
                    console.error('❌ Backup restoration also failed:', backupError);
                }
            }
            
            return false;
        }
    }
    
    // Utility methods for serialization
    serializeMap(map) {
        const obj = {};
        for (const [key, value] of map.entries()) {
            obj[key] = value;
        }
        return obj;
    }
    
    serializeNestedMap(map) {
        const obj = {};
        for (const [key, nestedMap] of map.entries()) {
            obj[key] = this.serializeMap(nestedMap);
        }
        return obj;
    }
    
    // Clean up old state files
    cleanupOldStates(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days default
        try {
            if (fs.existsSync(this.stateFile)) {
                const stats = fs.statSync(this.stateFile);
                const age = Date.now() - stats.mtime.getTime();
                
                if (age > maxAge) {
                    fs.unlinkSync(this.stateFile);
                    console.log('🧹 Cleaned up old ML state file');
                }
            }
            
            if (fs.existsSync(this.backupFile)) {
                const stats = fs.statSync(this.backupFile);
                const age = Date.now() - stats.mtime.getTime();
                
                if (age > maxAge) {
                    fs.unlinkSync(this.backupFile);
                    console.log('🧹 Cleaned up old ML backup file');
                }
            }
            
        } catch (error) {
            console.error('⚠️ Error during cleanup:', error);
        }
    }
    
    // Get state file info
    getStateInfo() {
        try {
            if (!fs.existsSync(this.stateFile)) {
                return { exists: false };
            }
            
            const stats = fs.statSync(this.stateFile);
            const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            
            return {
                exists: true,
                size: stats.size,
                lastModified: stats.mtime,
                saveTimestamp: state.saveTimestamp,
                version: state.version,
                banditArms: Object.keys(state.banditArms || {}).length,
                qStates: Object.keys(state.qLearningStates || {}).length,
                opponentModels: Object.keys(state.opponentModels || {}).length,
                battleHistory: (state.battleHistory || []).length
            };
            
        } catch (error) {
            return { exists: true, error: error.message };
        }
    }
}

export default MLStatePersistence;