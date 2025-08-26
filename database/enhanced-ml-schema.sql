-- Enhanced ML Data Collection Schema
-- Optimized for multi-order Markov chains, Thompson sampling, and ensemble methods

-- Multi-order sequence tracking for Markov chains
CREATE TABLE IF NOT EXISTS markov_sequences (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    order_level INTEGER NOT NULL CHECK (order_level IN (1, 2, 3)),
    sequence_pattern TEXT NOT NULL, -- e.g., "rock", "rock-paper", "rock-paper-scissor"
    next_move TEXT NOT NULL CHECK (next_move IN ('rock', 'paper', 'scissor')),
    count INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 0.0, -- What percentage of the time this pattern leads to success
    last_updated INTEGER DEFAULT (strftime('%s', 'now')),
    
    PRIMARY KEY (enemy_id, dungeon_id, order_level, sequence_pattern, next_move)
);

-- Strategy performance tracking for Thompson sampling
CREATE TABLE IF NOT EXISTS strategy_performance (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    strategy_name TEXT NOT NULL CHECK (strategy_name IN (
        'markov_1', 'markov_2', 'markov_3', 'frequency', 'turn_pattern', 
        'stats_enhanced', 'thompson_sampling', 'ensemble'
    )),
    successes INTEGER DEFAULT 0,
    failures INTEGER DEFAULT 0,
    total_predictions INTEGER DEFAULT 0,
    alpha_param REAL DEFAULT 1.0, -- Beta distribution alpha (successes + 1)
    beta_param REAL DEFAULT 1.0,  -- Beta distribution beta (failures + 1)
    confidence_level REAL DEFAULT 0.0,
    last_updated INTEGER DEFAULT (strftime('%s', 'now')),
    
    PRIMARY KEY (enemy_id, dungeon_id, strategy_name)
);

-- Enhanced prediction tracking with method details
CREATE TABLE IF NOT EXISTS prediction_details (
    battle_id INTEGER NOT NULL,
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    turn INTEGER NOT NULL,
    
    -- Prediction methods used
    markov_1_prediction TEXT CHECK (markov_1_prediction IN ('rock', 'paper', 'scissor') OR markov_1_prediction IS NULL),
    markov_1_confidence REAL DEFAULT 0.0,
    markov_2_prediction TEXT CHECK (markov_2_prediction IN ('rock', 'paper', 'scissor') OR markov_2_prediction IS NULL),
    markov_2_confidence REAL DEFAULT 0.0,
    markov_3_prediction TEXT CHECK (markov_3_prediction IN ('rock', 'paper', 'scissor') OR markov_3_prediction IS NULL),
    markov_3_confidence REAL DEFAULT 0.0,
    
    frequency_prediction TEXT CHECK (frequency_prediction IN ('rock', 'paper', 'scissor') OR frequency_prediction IS NULL),
    frequency_confidence REAL DEFAULT 0.0,
    
    stats_prediction TEXT CHECK (stats_prediction IN ('rock', 'paper', 'scissor') OR stats_prediction IS NULL),
    stats_confidence REAL DEFAULT 0.0,
    
    thompson_prediction TEXT CHECK (thompson_prediction IN ('rock', 'paper', 'scissor') OR thompson_prediction IS NULL),
    
    -- Final ensemble result
    ensemble_prediction TEXT NOT NULL CHECK (ensemble_prediction IN ('rock', 'paper', 'scissor')),
    ensemble_confidence REAL DEFAULT 0.0,
    
    -- Actual outcome
    actual_enemy_move TEXT NOT NULL CHECK (actual_enemy_move IN ('rock', 'paper', 'scissor')),
    prediction_correct INTEGER CHECK (prediction_correct IN (0, 1)),
    
    -- Enemy characteristics for this battle
    enemy_entropy REAL DEFAULT 1.5, -- Shannon entropy of enemy moves
    enemy_predictability TEXT DEFAULT 'unknown', -- 'predictable', 'random', 'adaptive'
    
    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    
    PRIMARY KEY (battle_id)
    -- Note: battle_id is a hash of the prediction context, not a direct foreign key
);

-- Enemy weapon statistics for correlation analysis
CREATE TABLE IF NOT EXISTS enemy_weapon_stats (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    encounter_id INTEGER NOT NULL, -- Which encounter with this enemy (resets per run)
    
    -- Weapon stats at time of encounter
    rock_attack INTEGER DEFAULT 0,
    rock_defense INTEGER DEFAULT 0,
    paper_attack INTEGER DEFAULT 0,
    paper_defense INTEGER DEFAULT 0,
    scissor_attack INTEGER DEFAULT 0,
    scissor_defense INTEGER DEFAULT 0,
    
    -- Calculated correlations
    attack_preference_correlation REAL DEFAULT 0.0, -- How much attack stats correlate with move usage
    defense_preference_correlation REAL DEFAULT 0.0,
    total_attack_power INTEGER DEFAULT 0,
    dominant_weapon TEXT, -- Which weapon has highest attack
    
    -- Move usage in this encounter
    rock_usage_count INTEGER DEFAULT 0,
    paper_usage_count INTEGER DEFAULT 0,
    scissor_usage_count INTEGER DEFAULT 0,
    
    first_seen_timestamp INTEGER,
    last_updated INTEGER DEFAULT (strftime('%s', 'now')),
    
    PRIMARY KEY (enemy_id, dungeon_id, encounter_id)
);

-- Pre-calculated entropy and predictability metrics
CREATE TABLE IF NOT EXISTS enemy_entropy_cache (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    
    -- Shannon entropy calculation
    current_entropy REAL DEFAULT 1.5,
    entropy_trend TEXT DEFAULT 'stable', -- 'increasing', 'decreasing', 'stable'
    
    -- Predictability classification
    predictability_score REAL DEFAULT 0.5, -- 0 = completely random, 1 = completely predictable
    classification TEXT DEFAULT 'unknown', -- 'predictable', 'semi-predictable', 'random', 'adaptive'
    
    -- Move distribution
    rock_frequency REAL DEFAULT 0.33,
    paper_frequency REAL DEFAULT 0.33,
    scissor_frequency REAL DEFAULT 0.34,
    
    -- Pattern strength
    strongest_pattern TEXT, -- Most common sequence pattern
    pattern_strength REAL DEFAULT 0.0, -- How strong the patterns are
    
    -- Cache metadata
    total_battles INTEGER DEFAULT 0,
    last_calculated INTEGER DEFAULT (strftime('%s', 'now')),
    cache_valid INTEGER DEFAULT 1, -- 0 = needs recalculation
    
    PRIMARY KEY (enemy_id, dungeon_id)
);

-- Algorithm performance tracking for A/B testing and optimization
CREATE TABLE IF NOT EXISTS algorithm_performance (
    algorithm_name TEXT NOT NULL,
    enemy_category TEXT NOT NULL, -- 'predictable', 'random', 'adaptive', 'new'
    dungeon_id INTEGER NOT NULL,
    
    -- Performance metrics
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    accuracy_rate REAL DEFAULT 0.0,
    
    -- Confidence calibration
    avg_confidence REAL DEFAULT 0.0,
    confidence_accuracy REAL DEFAULT 0.0, -- How well confidence predicts actual success
    
    -- Time-based performance
    recent_accuracy REAL DEFAULT 0.0, -- Last 100 predictions
    performance_trend TEXT DEFAULT 'stable', -- 'improving', 'declining', 'stable'
    
    last_updated INTEGER DEFAULT (strftime('%s', 'now')),
    
    PRIMARY KEY (algorithm_name, enemy_category, dungeon_id)
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_markov_sequences_lookup ON markov_sequences(enemy_id, dungeon_id, order_level);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_lookup ON strategy_performance(enemy_id, dungeon_id, strategy_name);
CREATE INDEX IF NOT EXISTS idx_prediction_details_analysis ON prediction_details(enemy_id, dungeon_id, prediction_correct);
CREATE INDEX IF NOT EXISTS idx_weapon_stats_correlation ON enemy_weapon_stats(enemy_id, dungeon_id, dominant_weapon);
CREATE INDEX IF NOT EXISTS idx_entropy_cache_lookup ON enemy_entropy_cache(enemy_id, dungeon_id, classification);
CREATE INDEX IF NOT EXISTS idx_algorithm_performance_category ON algorithm_performance(algorithm_name, enemy_category);

-- Views for common ML queries
CREATE VIEW IF NOT EXISTS enemy_ml_summary AS
SELECT 
    e.id as enemy_id,
    e.dungeon_id,
    e.total_battles,
    ec.current_entropy,
    ec.classification,
    ec.predictability_score,
    ews.dominant_weapon,
    ews.attack_preference_correlation,
    sp.alpha_param,
    sp.beta_param
FROM enemies e
LEFT JOIN enemy_entropy_cache ec ON e.id = ec.enemy_id AND e.dungeon_id = ec.dungeon_id
LEFT JOIN enemy_weapon_stats ews ON e.id = ews.enemy_id AND e.dungeon_id = ews.dungeon_id
LEFT JOIN strategy_performance sp ON e.id = sp.enemy_id AND e.dungeon_id = sp.dungeon_id AND sp.strategy_name = 'ensemble';