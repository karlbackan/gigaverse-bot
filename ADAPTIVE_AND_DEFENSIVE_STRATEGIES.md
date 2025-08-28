# Adaptive Enemy Tracking & Defensive Strategies

## The Problem
- **35% Loss Rate** (should be lowest, not highest!)
- ML only **34% accurate** (barely above random)
- Bot losing even with good survival weights (Win×1.3 + Draw×1.0)

## Root Cause Analysis
1. **Static ML**: Predicts based on historical patterns, misses adaptation
2. **Overconfidence**: Trusts bad predictions (34% accuracy) too much
3. **No Trend Analysis**: Doesn't detect when enemy changes strategy

## Solution: Two-Pronged Approach

### 1. Adaptive Enemy Tracking (`adaptive-enemy-tracker.mjs`)

**Key Innovation**: Track the **derivative** (rate of change) not just position

#### Features
- **Adaptation Speed Detection**: How fast is enemy changing? (0-1 scale)
- **Adaptation Type Classification**:
  - `static`: Repeating same patterns
  - `slow`: Gradual strategy shifts
  - `moderate`: Regular adaptation
  - `fast`: Rapid strategy changes
  - `reactive`: Countering our moves specifically
  
- **Trend Prediction**: Projects where strategy is heading
- **Momentum Tracking**: Direction and acceleration of change

#### How It Works
```javascript
// Analyzes different time windows
veryRecent: Last 5 moves   // Current strategy
recent: Last 10 moves       // Short-term pattern
medium: Last 20 moves       // Medium-term trend
historical: Older moves     // Long-term baseline

// Calculates drift between windows using KL divergence
// Predicts future based on momentum
```

#### Example Output
```
🔄 Enemy adapting fast (speed: 72%) - using trend prediction
📈 Momentum: increasing_paper
Enemy heading: R:25% P:48% S:27% (was R:33% P:33% S:34%)
```

### 2. Defensive ML Strategy (`defensive-ml-strategy.mjs`)

**Key Innovation**: When ML is unreliable, minimize maximum loss

#### Confidence Thresholds
- **<40% confidence**: Ignore predictions, play defensively
- **40-60% confidence**: Blend predictions with defensive play
- **>60% confidence**: Trust ML predictions

#### Defensive Modes
1. **Minimax Defense**: Choose move that minimizes worst-case loss
2. **Blended Defense**: Weight predictions toward uniform based on confidence
3. **Normal Play**: Use standard unified scoring when confident

### 3. Integration Points

#### Decision Engine Updates
```javascript
// 1. Get ML prediction
const prediction = await this.statisticsEngine.predictNextMove(...)

// 2. Check if enemy is adaptive
if (battleHistory.length >= 10) {
  const adaptationAnalysis = AdaptiveEnemyTracker.analyzeAdaptation(...)
  if (adaptationAnalysis.adaptationSpeed > 0.5) {
    // Override with trend prediction
    prediction.predictions = trendPrediction
  }
}

// 3. Apply defensive strategy if confidence low
const defensiveCheck = DefensiveMLStrategy.calculateDefensiveMove(...)
if (defensiveCheck) {
  scoringResult = defensiveCheck  // Use defensive play
}
```

## Expected Impact

### Immediate (with current 34% ML accuracy)
- **Reduce losses**: 35% → 30% (defensive play prevents bad decisions)
- **Increase draws**: 30% → 35% (minimax favors safe plays)
- **Survival rate**: 65% → 70%

### With Adaptive Tracking
- **Better vs adaptive enemies**: +5-10% accuracy on reactive opponents
- **Trend prediction**: Catches strategy shifts 2-3 turns earlier
- **Second-order counters**: Beats reactive enemies who counter our moves

### Combined with ML Fixes
- ML accuracy: 34% → 45% (from previous fixes)
- Adaptive detection: +5% on changing enemies
- Defensive play: +5% survival when uncertain
- **Total improvement**: 65% → 75-80% survival rate

## Strategy Selection Logic

```
IF enemy.adaptationSpeed > 0.5 AND confidence > 0.6:
  → Use trend prediction (where they're heading)
  
ELIF enemy.type == "reactive":
  → Use second-order counter (counter their counter)
  
ELIF ml.confidence < 0.4:
  → Use defensive minimax (minimize worst case)
  
ELIF ml.confidence < 0.6:
  → Use defensive blend (partial trust)
  
ELSE:
  → Use normal ML + unified scoring
```

## Key Insights

1. **Enemies aren't static**: Many adapt to our patterns
2. **ML lag**: Historical data misses recent strategy shifts
3. **Confidence matters**: Bad predictions worse than no predictions
4. **Survival first**: When uncertain, minimize losses over maximizing wins

## Monitoring Metrics

```sql
-- Check adaptation detection rate
SELECT COUNT(*) as adaptive_enemies
FROM battles 
WHERE method LIKE 'adaptive_%';

-- Check defensive play usage
SELECT method, COUNT(*) as uses, 
  AVG(CASE WHEN result != 'loss' THEN 1 ELSE 0 END) as survival_rate
FROM battles
WHERE method LIKE 'defensive_%'
GROUP BY method;

-- Compare strategies
SELECT 
  CASE 
    WHEN method LIKE 'adaptive_%' THEN 'Adaptive'
    WHEN method LIKE 'defensive_%' THEN 'Defensive'
    ELSE 'Normal ML'
  END as strategy,
  COUNT(*) as battles,
  ROUND(100.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
  ROUND(100.0 * SUM(CASE WHEN result != 'loss' THEN 1 ELSE 0 END) / COUNT(*), 1) as survival_rate
FROM battles
GROUP BY strategy;
```

## Bottom Line

This addresses the core issue: **"Why are we losing 35% when draws are valuable?"**

Answer: We were trusting bad ML predictions (34% accuracy) even when the enemy was adapting or our confidence was low.

Solution: 
1. Detect and predict adaptation (trend-based)
2. Play defensively when uncertain (minimax)
3. Only trust ML when confident and enemy is predictable

The bot now thinks: *"Is the enemy changing? Where are they heading? How confident am I? Should I play safe?"* instead of blindly following historical patterns.