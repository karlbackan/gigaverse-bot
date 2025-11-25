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
                // Multi-Armed Bandit state (Thompson Sampling)
                banditArms: this.serializeMap(mlEngine.bandit.arms),
                // Note: Thompson Sampling doesn't use epsilon

                // Q-Learning state (Double DQN)
                qLearningStates: this.serializeNestedMap(mlEngine.qLearning.states),
                qLearningTargetStates: this.serializeNestedMap(mlEngine.qLearning.targetStates || new Map()),
                qLearningEpsilon: mlEngine.qLearning.epsilon,
                qLearningAlpha: mlEngine.qLearning.alpha,
                qLearningGamma: mlEngine.qLearning.gamma,
                qLearningUpdateCounter: mlEngine.qLearning.updateCounter || 0,
                qLearningTargetUpdateFreq: mlEngine.qLearning.targetUpdateFreq || 10,
                
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

                // CTW models (critical for high-accuracy Markov patterns)
                ctwModels: this.serializeCTWModels(mlEngine.ctwModels),

                // RNN models
                rnnModels: this.serializeRNNModels(mlEngine.rnnModels),

                // Iocaine Powder state
                iocaineState: this.serializeIocaine(mlEngine.iocaine),

                // Bayesian opponent models
                bayesianState: this.serializeBayesian(mlEngine.bayesian),

                // Metadata
                saveTimestamp: Date.now(),
                version: '1.3.0' // 1.3.0: Added CTW, RNN, Iocaine, Bayesian persistence
            };
            
            // Backup existing state
            if (fs.existsSync(this.stateFile)) {
                fs.copyFileSync(this.stateFile, this.backupFile);
            }
            
            // Save new state
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
            
            console.log('💾 ML state saved successfully');
            console.log(`  Bandit arms: ${Object.keys(state.banditArms).length}`);
            console.log(`  Q-states (online): ${Object.keys(state.qLearningStates).length}`);
            console.log(`  Q-states (target): ${Object.keys(state.qLearningTargetStates).length}`);
            console.log(`  Q-update counter: ${state.qLearningUpdateCounter}`);
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
            
            // Validate state version - support 1.0.0, 1.1.0, and 1.2.0
            const supportedVersions = ['1.0.0', '1.1.0', '1.2.0'];
            if (!state.version || !supportedVersions.includes(state.version)) {
                console.log('⚠️ ML state version mismatch - starting fresh');
                return false;
            }

            // Restore Multi-Armed Bandit (Thompson Sampling)
            if (state.banditArms) {
                mlEngine.bandit.arms.clear();
                for (const [strategy, armData] of Object.entries(state.banditArms)) {
                    // Handle backward compatibility with v1.0.0 (rewards format)
                    if (armData.rewards !== undefined && armData.wins === undefined) {
                        // Convert old format to new Thompson Sampling format
                        const plays = armData.plays || 0;
                        const rewards = armData.rewards || 0;
                        // Estimate wins/losses from reward rate
                        const winRate = plays > 0 ? rewards / plays : 0.5;
                        armData.wins = plays * winRate;
                        armData.losses = plays * (1 - winRate);
                        delete armData.rewards;
                        console.log(`🔄 [Thompson] Migrated ${strategy}: rewards=${rewards} -> wins=${armData.wins.toFixed(1)}, losses=${armData.losses.toFixed(1)}`);
                    }
                    // Ensure all required fields exist
                    armData.wins = armData.wins || 0;
                    armData.losses = armData.losses || 0;
                    armData.value = armData.value || 0.5;
                    armData.confidence = armData.confidence || 0;
                    mlEngine.bandit.arms.set(strategy, armData);
                }
                // Note: Thompson Sampling doesn't use epsilon
            }
            
            // Restore Q-Learning states (Double DQN)
            if (state.qLearningStates) {
                mlEngine.qLearning.states.clear();
                for (const [stateKey, actionValuesObj] of Object.entries(state.qLearningStates)) {
                    const actionValues = new Map(Object.entries(actionValuesObj));
                    mlEngine.qLearning.states.set(stateKey, actionValues);
                }
                mlEngine.qLearning.epsilon = state.qLearningEpsilon || 0.1;
                mlEngine.qLearning.alpha = state.qLearningAlpha || 0.1;
                mlEngine.qLearning.gamma = state.qLearningGamma || 0.9;

                // Restore Double DQN target network
                if (state.qLearningTargetStates) {
                    mlEngine.qLearning.targetStates.clear();
                    for (const [stateKey, actionValuesObj] of Object.entries(state.qLearningTargetStates)) {
                        const actionValues = new Map(Object.entries(actionValuesObj));
                        mlEngine.qLearning.targetStates.set(stateKey, actionValues);
                    }
                } else {
                    // Backward compatibility: copy online states to target
                    mlEngine.qLearning.targetStates = new Map();
                    for (const [state, actions] of mlEngine.qLearning.states) {
                        mlEngine.qLearning.targetStates.set(state, new Map(actions));
                    }
                    console.log('[DQN] Migrated: copied online states to target network');
                }

                // Restore Double DQN counters
                mlEngine.qLearning.updateCounter = state.qLearningUpdateCounter || 0;
                mlEngine.qLearning.targetUpdateFreq = state.qLearningTargetUpdateFreq || 10;
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

            // Restore CTW models (critical for high-accuracy Markov patterns)
            if (state.ctwModels) {
                this.deserializeCTWModels(mlEngine, state.ctwModels);
            }

            // Restore RNN models
            if (state.rnnModels) {
                this.deserializeRNNModels(mlEngine, state.rnnModels);
            }

            // Restore Iocaine state
            if (state.iocaineState) {
                this.deserializeIocaine(mlEngine, state.iocaineState);
            }

            // Restore Bayesian state
            if (state.bayesianState) {
                this.deserializeBayesian(mlEngine, state.bayesianState);
            }

            const ageHours = (Date.now() - state.saveTimestamp) / (1000 * 60 * 60);
            
            console.log('🧠 ML state loaded successfully');
            console.log(`  State age: ${ageHours.toFixed(1)} hours`);
            console.log(`  Bandit arms: ${mlEngine.bandit.arms.size}`);
            console.log(`  Q-states (online): ${mlEngine.qLearning.states.size}`);
            console.log(`  Q-states (target): ${mlEngine.qLearning.targetStates?.size || 0}`);
            console.log(`  Q-update counter: ${mlEngine.qLearning.updateCounter || 0}`);
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

    // ==================== CTW Serialization ====================
    serializeCTWModels(ctwModels) {
        if (!ctwModels) return {};
        const result = {};
        for (const [enemyId, ctw] of ctwModels) {
            result[enemyId] = {
                history: ctw.history,
                maxDepth: ctw.maxDepth,
                root: this.serializeCTWNode(ctw.root)
            };
        }
        return result;
    }

    serializeCTWNode(node) {
        if (!node) return null;
        const serialized = {
            counts: node.counts,
            totalCount: node.totalCount,
            pe: node.pe,
            pw: node.pw,
            children: {}
        };
        for (const [key, child] of Object.entries(node.children)) {
            serialized.children[key] = this.serializeCTWNode(child);
        }
        return serialized;
    }

    deserializeCTWModels(mlEngine, ctwData) {
        if (!ctwData) return;
        const { ContextTreeWeighting } = mlEngine.constructor.prototype;

        for (const [enemyId, data] of Object.entries(ctwData)) {
            // Create a new CTW and restore its state
            mlEngine.ensureCTWModel(enemyId);
            const ctw = mlEngine.ctwModels.get(enemyId);
            ctw.history = data.history || [];
            ctw.maxDepth = data.maxDepth || 8;
            if (data.root) {
                ctw.root = this.deserializeCTWNode(data.root);
            }
        }
        console.log(`  CTW models loaded: ${Object.keys(ctwData).length}`);
    }

    deserializeCTWNode(nodeData) {
        if (!nodeData) return null;
        const node = {
            counts: nodeData.counts || { rock: 0, paper: 0, scissor: 0 },
            totalCount: nodeData.totalCount || 0,
            pe: nodeData.pe || 1.0,
            pw: nodeData.pw || 1.0,
            children: {}
        };
        for (const [key, childData] of Object.entries(nodeData.children || {})) {
            node.children[key] = this.deserializeCTWNode(childData);
        }
        return node;
    }

    // ==================== RNN Serialization ====================
    serializeRNNModels(rnnModels) {
        if (!rnnModels) return {};
        const result = {};
        for (const [enemyId, rnn] of rnnModels) {
            result[enemyId] = {
                hiddenSize: rnn.hiddenSize,
                hidden: rnn.hidden,
                weightsIH: rnn.weightsIH,
                weightsHH: rnn.weightsHH,
                weightsHO: rnn.weightsHO,
                biasH: rnn.biasH,
                biasO: rnn.biasO,
                inputHistory: rnn.inputHistory || [],
                outputHistory: rnn.outputHistory || []
            };
        }
        return result;
    }

    deserializeRNNModels(mlEngine, rnnData) {
        if (!rnnData) return;

        for (const [enemyId, data] of Object.entries(rnnData)) {
            mlEngine.ensureRNNModel(enemyId);
            const rnn = mlEngine.rnnModels.get(enemyId);

            if (data.hidden) rnn.hidden = data.hidden;
            if (data.weightsIH) rnn.weightsIH = data.weightsIH;
            if (data.weightsHH) rnn.weightsHH = data.weightsHH;
            if (data.weightsHO) rnn.weightsHO = data.weightsHO;
            if (data.biasH) rnn.biasH = data.biasH;
            if (data.biasO) rnn.biasO = data.biasO;
            if (data.inputHistory) rnn.inputHistory = data.inputHistory;
            if (data.outputHistory) rnn.outputHistory = data.outputHistory;
        }
        console.log(`  RNN models loaded: ${Object.keys(rnnData).length}`);
    }

    // ==================== Iocaine Serialization ====================
    serializeIocaine(iocaine) {
        if (!iocaine) return null;
        return {
            enemyData: this.serializeMap(iocaine.enemyData)
        };
    }

    deserializeIocaine(mlEngine, iocaineData) {
        if (!iocaineData || !mlEngine.iocaine) return;

        if (iocaineData.enemyData) {
            for (const [enemyId, data] of Object.entries(iocaineData.enemyData)) {
                mlEngine.iocaine.enemyData.set(enemyId, data);
            }
        }
        console.log(`  Iocaine enemies loaded: ${Object.keys(iocaineData.enemyData || {}).length}`);
    }

    // ==================== Bayesian Serialization ====================
    serializeBayesian(bayesian) {
        if (!bayesian) return null;
        return {
            opponents: this.serializeMap(bayesian.opponents)
        };
    }

    deserializeBayesian(mlEngine, bayesianData) {
        if (!bayesianData || !mlEngine.bayesian) return;

        if (bayesianData.opponents) {
            for (const [enemyId, data] of Object.entries(bayesianData.opponents)) {
                mlEngine.bayesian.opponents.set(enemyId, data);
            }
        }
        console.log(`  Bayesian opponents loaded: ${Object.keys(bayesianData.opponents || {}).length}`);
    }
}

export default MLStatePersistence;