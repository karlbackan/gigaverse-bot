# Gigaverse Bot Statistics System

## Overview

The statistics system tracks enemy behavior patterns and predicts their next moves using multiple factors:

1. **Move Sequences** - Tracks chains of moves (e.g., "rock-paper" → "scissor" 70% of the time)
2. **Turn-Specific Patterns** - Different behavior on turn 1 vs turn 5
3. **Stat Correlations** - Enemy behavior changes based on health/shield levels
4. **Time-Based Shifts** - Patterns shift with different noobId ranges
5. **Weapon Attack Stats** - Weighs moves based on your weapon damage

## How It Works

### Data Collection

Every battle turn records:
- Enemy ID and move
- Turn number
- Player and enemy stats (health, shield)
- Weapon stats (attack, defense, charges)
- Result (win/lose/draw)
- NoobId for time tracking

### Prediction Algorithm

The system uses weighted factors to predict enemy moves:

```
Weights:
- Overall patterns: 10%
- Turn-specific: 20%
- Move sequences: 40% (most important)
- Stat correlations: 15%
- NoobId patterns: 15%
```

### Confidence Score

Predictions include a confidence score based on:
- Amount of data for that enemy
- Strength of patterns found
- Sequence match quality

Only predictions with >60% confidence are used. Otherwise, it falls back to weapon stat weighting.

## Using the System

### During Gameplay

The bot automatically:
- Tracks all battle data
- Makes predictions when enough data exists
- Shows current enemy analysis in logs
- Exports statistics every 100 battles

### Analysis Tools

View comprehensive analysis:
```bash
node src/statistics-analyzer.mjs report
```

Export raw data for external analysis:
```bash
node src/statistics-analyzer.mjs export mydata.json
```

Clear all statistics:
```bash
node src/statistics-analyzer.mjs clear --confirm
```

## Configuration & Tuning

### Weight Adjustments

Edit `statistics-engine.mjs` to adjust prediction weights:

```javascript
const weights = {
  overall: 0.1,        // Overall move distribution
  turnSpecific: 0.2,   // Turn-specific patterns
  sequence: 0.4,       // Move sequences
  statCorrelation: 0.15, // Stat-based patterns
  noobIdPattern: 0.15   // Time-based shifts
};
```

### Attack Stat Weighting

Adjust how much weapon attack stats influence decisions:

```javascript
// In decision-engine.mjs
const attackWeight = 0.2; // 20% bonus for attack stats
```

### Confidence Threshold

Change when to use predictions vs random strategy:

```javascript
// In decision-engine.mjs
if (prediction && prediction.confidence > 0.6) { // 60% threshold
```

## Data Structure

Statistics are stored in `data/battle-statistics.json`:

```json
{
  "lastUpdated": 1234567890,
  "enemyStats": [
    ["enemyId", {
      "totalBattles": 50,
      "moves": {"rock": 20, "paper": 15, "scissor": 15},
      "movesByTurn": {...},
      "moveSequences": {
        "rock-paper": {"rock": 5, "paper": 2, "scissor": 10}
      },
      "statCorrelations": {...},
      "noobIdPatterns": {...}
    }]
  ]
}
```

## Performance Tips

1. **More Data = Better Predictions** - The system needs at least 10-20 battles per enemy to start making good predictions

2. **Sequence Tracking** - The most powerful predictor. Some enemies have strong patterns like always playing rock after paper-scissors.

3. **Stat Correlations** - Some enemies change behavior when low on health. The system tracks this.

4. **Time Shifts** - Enemy patterns can change over days/weeks (different noobId ranges). The system adapts.

5. **Weapon Stats** - When patterns are unclear, the system favors your strongest weapons.

## Analyzing Results

The analysis report shows:
- Win rates by weapon
- Enemy-specific patterns
- Strongest move sequences
- Pattern shifts over time
- Confidence levels

Use this data to:
- Identify which enemies are well-predicted
- Find patterns the system might miss
- Adjust weights for better performance
- Understand your win/loss patterns

## Future Improvements

Potential enhancements:
- Neural network for pattern recognition
- Multi-enemy pattern correlation
- Adaptive weight adjustment
- Real-time pattern visualization
- Cross-account data sharing