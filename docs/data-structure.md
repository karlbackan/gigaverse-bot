# Gigaverse Bot Data Structure

## Overview
The bot maintains separate statistics for two dungeon types:
- **Dungetron 5000** (ID: 1) - 16 unique enemies
- **Underhaul** (ID: 3) - 16 completely different enemies

## File: `data/battle-statistics.json`

```json
{
  "lastUpdated": 1754404090459,
  "dungeonStats": {
    "1": [...],  // Dungetron 5000 enemy data
    "3": [...]   // Underhaul enemy data
  },
  "moveSequencesByDungeon": {
    "1": [...],  // Dungetron 5000 move sequences
    "3": [...]   // Underhaul move sequences
  }
}
```

## Enemy Data Structure

Each enemy in `dungeonStats[dungeonType]` contains:

```json
{
  "enemyId": {
    "firstSeen": 1754346062562,      // Timestamp when first encountered
    "lastSeen": 1754403214372,       // Timestamp of last battle
    "totalBattles": 55,              // Total number of battles against this enemy
    
    "moves": {                       // Overall move distribution
      "rock": 19,
      "paper": 19,
      "scissor": 17
    },
    
    "movesByTurn": {                 // Move distribution by turn number
      "1": { "rock": 13, "paper": 14, "scissor": 13 },
      "2": { "rock": 6, "paper": 3, "scissor": 4 },
      "3": { "rock": 0, "paper": 2, "scissor": 0 }
    },
    
    "moveSequences": {               // What enemy plays after specific sequences
      "rock-paper": { "rock": 3, "paper": 0, "scissor": 3 },
      "paper-scissor": { "rock": 5, "paper": 0, "scissor": 1 },
      // ... more sequences
    },
    
    "statCorrelations": {            // Moves based on health states
      "p100_e100": { "rock": 19, "paper": 19, "scissor": 17 },
      // p = player health %, e = enemy health %
    },
    
    "noobIdPatterns": {              // Time-based patterns (account age)
      "76000": { "rock": 19, "paper": 19, "scissor": 17 }
      // Grouped by ranges of 100
    },
    
    "recentBattles": [               // Last 100 battles for recency weighting
      {
        "turn": 1,
        "move": "rock",
        "timestamp": 1754346062562,
        "sequenceKey": "paper-rock"
      }
    ],
    
    "chargePatterns": {              // Enemy behavior by charge state
      "no_rock": { "rock": 0, "paper": 5, "scissor": 3 },
      "critical_low": { "rock": 2, "paper": 1, "scissor": 1 },
      "r3_p2_s1": { "rock": 4, "paper": 2, "scissor": 1 }
      // Special patterns for conservation strategies
    }
  }
}
```

## Move Sequences Structure

The `moveSequencesByDungeon[dungeonType]` tracks the last 3 moves for each enemy:

```json
{
  "enemyId": ["rock", "paper", "scissor"]  // Last 3 moves in order
}
```

## Key Differences Between Modes

### Dungetron 5000 (ID: 1)
- 16 standard enemies
- Regular mode (40 energy) or Juiced mode (80-120 energy)
- Enemy IDs: 1-16 (typically)
- Daily limit: Varies based on mode

### Underhaul (ID: 3)
- 16 completely different enemies
- Always Juiced mode (120 energy)
- Enemy IDs: Different set (detected at runtime)
- Daily limit: 9 attempts
- Requires checkpoint 2 to be unlocked

## Statistics Engine Usage

The statistics engine automatically:
1. Detects current dungeon type from API responses
2. Stores data in the appropriate dungeon section
3. Only uses data from the current dungeon type for predictions
4. Maintains complete separation between the two enemy sets

## Example Data Flow

1. **Battle Starts**: Dungeon type detected from `entity.DUNGEON_TYPE_CID`
2. **Statistics Set**: `statisticsEngine.setDungeonType(dungeonType)`
3. **Data Recorded**: Battle data saved to `dungeonStats[dungeonType][enemyId]`
4. **Predictions Made**: Only uses data from current dungeon type
5. **Auto-Save**: Every 10 battles, data is persisted to disk