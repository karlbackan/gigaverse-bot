# Minimal Output Mode

The bot has a minimal output mode designed for statistics analysis. This mode reduces verbose logging to focus on key statistical indicators.

## Enabling Minimal Output

By default, minimal output is **enabled**. To disable it and see verbose output:

```bash
# Add to .env file
MINIMAL_OUTPUT=false
```

## Output Format

### Battle Output
```
Enemy_123 T1: rock→paper lose
Conf:75% R20/P65/S15
Enemy_123 T2: paper→rock win
Conf:82% R70/P10/S20
```

Format: `EnemyID Turn: YourMove→EnemyMove Result`
- Confidence percentage and predicted probabilities shown when available
- "No data" shown when no statistics exist for enemy

### Statistics Summary
```
Win:45% Enemies:8
Goblin_5: 23 battles, fav:rock
Seq "paper-rock"→scissor 85%
```

### Key Indicators

1. **Confidence Score** - How sure the prediction is (60%+ = high confidence)
2. **R/P/S Probabilities** - Predicted enemy move chances
3. **Win Rate** - Overall success rate
4. **Sequence Predictions** - Strong patterns found

### Analysis Command

To see full analysis report:
```bash
node src/statistics-analyzer.mjs report
```

This gives detailed breakdowns of:
- Enemy-specific patterns
- Turn-by-turn analysis
- Move sequences
- Pattern shifts over time
- Configuration recommendations

## Benefits

- **Focused View** - See only statistics indicators
- **Pattern Recognition** - Quickly identify prediction accuracy
- **Performance Tracking** - Monitor win rates in real-time
- **Clean Output** - No clutter, just data

## Switching Modes

Toggle between modes without restarting:
- Minimal mode: Best for statistics analysis
- Verbose mode: Best for debugging issues