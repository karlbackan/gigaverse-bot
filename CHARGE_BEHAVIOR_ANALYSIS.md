# Charge-Based Behavior Analysis

## Key Insight
Enemy behavior likely changes based on remaining charges!

## Behavioral Patterns to Track

### 1. Conservation Behavior
```
Enemy loves rock (normally 60% usage)
But when rock charges = 1:
- Might save it (only 20% usage)
- Switches to second favorite
```

### 2. Desperation Behavior  
```
Enemy at low health + low charges:
- Might use remaining charges aggressively
- Or save for "finishing move"
```

### 3. Charge Balance Behavior
```
Smart enemies might:
- Spread usage to maintain options
- Never let any weapon hit 0
- Keep at least 1 charge in each
```

## Statistical Correlations to Track

1. **Move Probability by Charge State**
   ```
   P(rock | rock_charges=3) = 60%
   P(rock | rock_charges=2) = 50%  
   P(rock | rock_charges=1) = 20%  // Conservation!
   P(rock | rock_charges=0) = 0%   // Impossible
   ```

2. **Charge State Patterns**
   - Does enemy prefer balanced charges (1,1,1)?
   - Or depletes one weapon fully (0,3,3)?
   - Changes strategy when total charges < 5?

3. **Health-Charge Correlation**
   ```
   Low health + low charges → panic mode?
   High health + low charges → conservative?
   ```

## Implementation Ideas

### Enhanced Recording
```javascript
this.decisionEngine.recordTurn(
  enemyId,
  turn,
  action,
  enemyMove,
  result,
  playerStats,
  enemyStats,
  weaponStats,
  enemyChargeState: {  // NEW!
    rock: enemyRockCharges,
    paper: enemyPaperCharges,
    scissor: enemyScissorCharges,
    total: enemyRockCharges + enemyPaperCharges + enemyScissorCharges
  }
);
```

### Statistical Analysis
```javascript
// Track move distribution by charge level
chargePatterns: {
  "rock_at_3_charges": { rock: 0.6, paper: 0.3, scissor: 0.1 },
  "rock_at_2_charges": { rock: 0.5, paper: 0.35, scissor: 0.15 },
  "rock_at_1_charges": { rock: 0.2, paper: 0.5, scissor: 0.3 },  // Big shift!
  "rock_at_0_charges": { rock: 0, paper: 0.6, scissor: 0.4 }
}
```

## Bug Note: -1/3 Display Issue
- 0 charges showing as "-1/3" 
- Need to handle this in parsing
- Probably: `Math.max(0, reportedCharges)`

## Expected Impact
- Predict conservation behavior
- Exploit charge-based patterns  
- Additional 3-5% win rate on top of charge tracking
- Much higher confidence in predictions

This combines with charge elimination for massive advantage!