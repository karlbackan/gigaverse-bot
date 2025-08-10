-- Battle Statistics Database Schema
-- Replaces the battle-statistics.json file with a proper relational database

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Main dungeons table
CREATE TABLE dungeons (
    id INTEGER PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    total_battles INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Enemy statistics table  
CREATE TABLE enemies (
    id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    total_battles INTEGER DEFAULT 0,
    
    -- Core win/loss statistics (from bot's perspective)
    wins INTEGER DEFAULT 0,        -- Enemy wins (bot losses)
    losses INTEGER DEFAULT 0,      -- Enemy losses (bot wins) 
    ties INTEGER DEFAULT 0,        -- Draw/tie results
    win_rate REAL DEFAULT 0.0,     -- Enemy win rate
    
    -- Analysis fields
    prediction_accuracy REAL DEFAULT 0.0,
    predictability_score REAL DEFAULT 0.0,
    adaptability_rating INTEGER DEFAULT 50,
    dominant_strategy TEXT,
    exploitable_weakness TEXT,
    confidence_level REAL DEFAULT 0.0,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    PRIMARY KEY (id, dungeon_id),
    FOREIGN KEY (dungeon_id) REFERENCES dungeons(id)
);

-- Individual battle records
CREATE TABLE battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    turn INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    
    -- Battle details
    player_move TEXT NOT NULL CHECK (player_move IN ('rock', 'paper', 'scissor')),
    enemy_move TEXT NOT NULL CHECK (enemy_move IN ('rock', 'paper', 'scissor')),
    result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'tie')),
    
    -- Sequence tracking
    sequence_key TEXT,
    previous_move TEXT CHECK (previous_move IN ('rock', 'paper', 'scissor') OR previous_move IS NULL),
    
    -- Game state
    player_health INTEGER,
    enemy_health INTEGER,
    player_stats TEXT, -- JSON blob for player stats
    enemy_stats TEXT,  -- JSON blob for enemy stats
    weapon_stats TEXT, -- JSON blob for weapon stats
    noob_id INTEGER,
    
    -- Analysis fields
    prediction_made TEXT CHECK (prediction_made IN ('rock', 'paper', 'scissor') OR prediction_made IS NULL),
    prediction_correct BOOLEAN,
    confidence_level REAL,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    FOREIGN KEY (enemy_id, dungeon_id) REFERENCES enemies(id, dungeon_id)
);

-- Move frequency tracking by enemy
CREATE TABLE enemy_moves (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    move TEXT NOT NULL CHECK (move IN ('rock', 'paper', 'scissor')),
    count INTEGER DEFAULT 0,
    
    PRIMARY KEY (enemy_id, dungeon_id, move),
    FOREIGN KEY (enemy_id, dungeon_id) REFERENCES enemies(id, dungeon_id)
);

-- Move frequency by turn number
CREATE TABLE enemy_moves_by_turn (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    turn INTEGER NOT NULL,
    move TEXT NOT NULL CHECK (move IN ('rock', 'paper', 'scissor')),
    count INTEGER DEFAULT 0,
    
    PRIMARY KEY (enemy_id, dungeon_id, turn, move),
    FOREIGN KEY (enemy_id, dungeon_id) REFERENCES enemies(id, dungeon_id)
);

-- Move sequences tracking
CREATE TABLE move_sequences (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    sequence_key TEXT NOT NULL, -- e.g., "rock-paper", "paper-scissor"
    next_move TEXT NOT NULL CHECK (next_move IN ('rock', 'paper', 'scissor')),
    count INTEGER DEFAULT 0,
    
    PRIMARY KEY (enemy_id, dungeon_id, sequence_key, next_move),
    FOREIGN KEY (enemy_id, dungeon_id) REFERENCES enemies(id, dungeon_id)
);

-- Turn performance tracking
CREATE TABLE turn_performance (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    turn INTEGER NOT NULL,
    wins INTEGER DEFAULT 0,    -- Enemy wins at this turn
    losses INTEGER DEFAULT 0,  -- Enemy losses at this turn
    ties INTEGER DEFAULT 0,    -- Ties at this turn
    total INTEGER DEFAULT 0,   -- Total battles at this turn
    
    PRIMARY KEY (enemy_id, dungeon_id, turn),
    FOREIGN KEY (enemy_id, dungeon_id) REFERENCES enemies(id, dungeon_id)
);

-- Weapon effectiveness tracking  
CREATE TABLE weapon_effectiveness (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    weapon_key TEXT NOT NULL,
    rock_count INTEGER DEFAULT 0,
    paper_count INTEGER DEFAULT 0,
    scissor_count INTEGER DEFAULT 0,
    win_count INTEGER DEFAULT 0,   -- Enemy wins with this weapon
    loss_count INTEGER DEFAULT 0,  -- Enemy losses with this weapon
    
    PRIMARY KEY (enemy_id, dungeon_id, weapon_key),
    FOREIGN KEY (enemy_id, dungeon_id) REFERENCES enemies(id, dungeon_id)
);

-- Recent battle history (sliding window)
CREATE TABLE recent_battles (
    enemy_id INTEGER NOT NULL,
    dungeon_id INTEGER NOT NULL,
    battle_data TEXT NOT NULL, -- JSON blob with battle details
    timestamp INTEGER NOT NULL,
    
    PRIMARY KEY (enemy_id, dungeon_id, timestamp),
    FOREIGN KEY (enemy_id, dungeon_id) REFERENCES enemies(id, dungeon_id)
);

-- System metadata
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Indexes for performance
CREATE INDEX idx_battles_enemy_dungeon ON battles(enemy_id, dungeon_id);
CREATE INDEX idx_battles_timestamp ON battles(timestamp);
CREATE INDEX idx_battles_turn ON battles(turn);
CREATE INDEX idx_enemies_dungeon ON enemies(dungeon_id);
CREATE INDEX idx_dungeons_last_seen ON dungeons(last_seen);
CREATE INDEX idx_recent_battles_timestamp ON recent_battles(timestamp);

-- Initialize metadata
INSERT INTO metadata (key, value) VALUES 
    ('schema_version', '1.0'),
    ('created_at', strftime('%s', 'now') * 1000),
    ('migration_source', 'battle-statistics.json');

-- Views for common queries

-- Enemy summary view
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
LEFT JOIN enemy_moves sm ON e.id = sm.enemy_id AND e.dungeon_id = sm.dungeon_id AND sm.move = 'scissor';

-- Battle statistics summary
CREATE VIEW battle_summary AS
SELECT 
    COUNT(*) as total_battles,
    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as bot_wins,
    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as bot_losses,
    SUM(CASE WHEN result = 'tie' THEN 1 ELSE 0 END) as ties,
    AVG(CASE WHEN result = 'win' THEN 1.0 ELSE 0.0 END) as bot_win_rate,
    MIN(timestamp) as first_battle,
    MAX(timestamp) as last_battle
FROM battles;