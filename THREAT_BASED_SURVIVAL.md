# Threat-Based Survival System Implementation

## What Was Implemented

### 1. **ThreatCalculator** (`src/threat-calculator.mjs`)
- Calculates actual damage: `Damage = max(0, EnemyATK - PlayerDEF - Shield)`
- Assesses threat level for each possible enemy move
- Identifies lethal threats (can one-shot player)
- Considers shield regeneration benefits of draws

### 2. **Enhanced UnifiedScoring** (`src/unified-scoring.mjs`)
- Added `getThreatBasedWeights()` method
- Dynamically adjusts weights based on actual threat assessment
- Integrates shield status for draw valuation

### 3. **Decision Engine Update** (`src/decision-engine.mjs`)
- Now uses threat-based weights when enemy stats available
- Falls back to simple health ratio when stats unavailable

## How It Works

### Threat Levels & Weight Adjustments

| Threat Level | Condition | Win Weight | Draw Weight | Loss Weight |
|-------------|-----------|------------|-------------|-------------|
| **LETHAL** | Can one-shot | 1.5 | 1.4 | -10 |
| **HIGH** | >50% health damage | 1.4 | 1.2 | -2 |
| **MEDIUM** | 25-50% health | 1.35 | 0.95 | -0.5 |
| **LOW** | <25% health | 1.5 | 0.6 | 0 |

### Additional Factors
- **Low Shield (<30%)**: Draw weight × 1.2 (armor regeneration)
- **Enemy Charge Limits**: Still enforced (guaranteed wins when enemy has 1 move)

## Example Scenarios

### Scenario 1: Low Threat
```
Player: 100 HP, 20 Shield
Enemy: 10-12 ATK weapons
Result: Aggressive play (Win=1.5, Draw=0.6)
```

### Scenario 2: High Threat
```
Player: 40 HP, 5 Shield  
Enemy: 30-40 ATK weapons
Result: Defensive stance (Win=1.4, Draw=1.2)
Shield bonus: Draw × 1.2 = 1.44
```

### Scenario 3: Lethal Threat
```
Player: 15 HP, 0 Shield
Enemy: 45-55 ATK weapons
Result: SURVIVAL MODE (Win=1.5, Draw=1.4, Loss=-10)
```

## Key Improvements Over Fixed Weights

### Before (Fixed Weights)
- Win × 1.3 + Draw × 1.0 always
- No consideration of actual damage
- Arbitrary health ratio thresholds
- Could choose risky moves when death imminent

### After (Threat-Based)
- Weights adjust to actual threat level
- Considers enemy ATK vs player DEF
- Values draws when they prevent death
- Goes aggressive when safe
- Shield regeneration factored in

## Expected Impact

1. **Better Survival Rate**: Should increase from 65% to 70%+
2. **Fewer Deaths**: Avoiding lethal threats properly
3. **More Wins When Safe**: Aggressive play in low threat
4. **Smart Draw Usage**: Using draws for armor regen

## Integration Status

✅ **Fully Integrated**
- ThreatCalculator class created
- UnifiedScoring enhanced with threat assessment
- DecisionEngine updated to use threat weights
- Fallback to simple weights when stats unavailable

## Next Steps

1. **Monitor Performance**: Track survival rate improvement
2. **Tune Damage Formula**: Adjust if game mechanics differ
3. **Add Combo Threats**: Consider multi-turn damage patterns
4. **Shield Break Points**: Calculate when shield will break

## The Bottom Line

**This addresses the user's key insight**: Survival decisions are now based on actual threat assessment, not arbitrary weights. The system intelligently values draws when they provide armor regeneration or prevent death, while being aggressive when the threat is low.

The bot now thinks: *"Can this enemy kill me? How much damage can they do? Do I need armor regen?"* instead of just *"What's my health percentage?"*