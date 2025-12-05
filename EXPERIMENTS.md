# Algorithm Experiments Log

## Dataset
- **Total battles**: 30,127
- **Unique opponents**: 42
- **Average battles/opponent**: ~717
- **Top opponent**: 6,651 battles

## Baseline Results (2024-12-05)

| Algorithm | Accuracy | vs Random | Notes |
|-----------|----------|-----------|-------|
| CTW (Markov-6) | 34.4% | +1.0% | Original default |
| Joint CTW | 34.4% | +1.0% | Player-enemy pairs |
| Ensemble | 34.4% | +1.0% | No improvement over CTW |
| WSLS | 33.9% | +0.6% | Win-Stay-Lose-Shift |
| Iocaine | 33.9% | +0.5% | Meta-strategy |
| RNN | 33.8% | +0.4% | Sequence learning |
| Bayesian | 33.7% | +0.4% | Type inference |
| Population CTW | 34.1% | +0.4% | Adds noise |
| Random | 33.3% | 0.0% | Baseline |

---

## Experiment 1: CTW Depth Analysis

**Hypothesis**: Different Markov depths may capture different pattern lengths.

**Result**: **DEPTH 2 IS BEST!**

| Depth | Accuracy | vs Random | Notes |
|-------|----------|-----------|-------|
| **2** | **34.83%** | **+1.5%** | **BEST - Short patterns most predictive** |
| 3 | 34.81% | +1.5% | Near best |
| 4 | 34.81% | +1.5% | Near best |
| 5 | 34.59% | +1.3% | |
| 6 | 34.40% | +1.1% | Current default |
| 7 | 34.24% | +0.9% | |
| 8 | 34.25% | +0.9% | |
| 10 | 34.22% | +0.9% | Long patterns hurt |

**Conclusion**: Reduce CTW depth from 6 to 2-3. Shorter patterns are more predictive.

---

## Experiment 2: Per-Opponent Predictability

**Hypothesis**: Some opponents are highly predictable, others are random.

**Result**: HUGE variance in predictability!

### Most Predictable (bots)
| Opponent | Battles | CTW Accuracy | Type |
|----------|---------|--------------|------|
| 1177506788 | 30 | 100.0% | Deterministic bot |
| 1508288751 | 30 | 100.0% | Deterministic bot |
| 1850439519 | 30 | 100.0% | Deterministic bot |
| 911662808 | 30 | 93.1% | Very predictable |
| 100 | 28 | 85.2% | Very predictable |

### Least Predictable (random)
| Opponent | Battles | CTW Accuracy | Type |
|----------|---------|--------------|------|
| 19 | 5 | 0.0% | Random |
| 17 | 7 | 16.7% | Random |
| 14 | 89 | 25.0% | Random |
| -1 | 1845 | 32.3% | Near-random |
| 23 | 3662 | 32.9% | Near-random |

**Statistics**:
- Average per-opponent accuracy: **43.7%** (much higher than global 34%)
- Opponents above 40%: 12
- Opponents below 33%: 10

**Conclusion**: Per-opponent models critical. Some opponents are exploitable, others are random.

---

## Experiment 3: Transition Matrix (First-Order Markov)

**Hypothesis**: Simple first-order Markov may work well.

**Result**: Nearly uniform transitions - NOT useful

| From | To Rock | To Paper | To Scissor |
|------|---------|----------|------------|
| Rock | 33.1% | 32.7% | 34.2% |
| Paper | 33.9% | 32.8% | 33.3% |
| Scissor | 34.2% | 31.7% | 34.2% |

**Accuracy**: 33.62% (+0.3% vs random)

**Conclusion**: First-order Markov not useful. Opponents don't have simple transition patterns.

---

## Experiment 4: Anti-Rotation Detection

**Hypothesis**: Some opponents cycle R->P->S or R->S->P.

**Result**: No rotation patterns detected

| Pattern | Frequency |
|---------|-----------|
| Clockwise (R->P->S) | 33.4% |
| Counter (R->S->P) | 33.3% |
| Other | 33.4% |

**Accuracy**: 33.33% (+0.0% vs random)

**Conclusion**: No global rotation patterns. Skip anti-rotation strategy.

---

## Experiment 5: Recency-Weighted Predictions

**Hypothesis**: Recent moves are more predictive than old moves.

**Result**: NO DECAY IS BEST!

| Decay | Accuracy | Notes |
|-------|----------|-------|
| 0.80 | 30.83% | Too aggressive |
| 0.90 | 31.11% | |
| 0.95 | 31.35% | |
| 0.98 | 32.66% | |
| 0.99 | 33.24% | |
| **1.00** | **33.63%** | **BEST - Keep all history** |

**Conclusion**: Don't use recency decay! All historical data is valuable.

---

## Experiment 6: Conditional Patterns

**Hypothesis**: Opponent behavior changes based on last outcome.

**Result**: Small differences detected

| After | Rock | Paper | Scissor |
|-------|------|-------|---------|
| Win | 33.0% | 32.3% | 34.7% |
| Loss | 34.1% | 32.6% | 33.3% |
| Draw | 34.1% | 32.3% | 33.7% |

**Accuracy**: 34.01% (+0.7% vs random)

**Insight**: After winning, opponents slightly favor scissor (34.7%). After loss, slightly favor rock (34.1%).

---

## Experiment 7: Frequency Bias Detection

**Hypothesis**: Some opponents favor certain moves.

**Result**: Global distribution nearly uniform

| Move | Global % |
|------|----------|
| Rock | 33.74% |
| Paper | 32.38% |
| Scissor | 33.88% |

**Most Biased Opponents**:
| Opponent | Bias | Favorite |
|----------|------|----------|
| 15 | 42.6% | Scissor |
| 14 | 40.4% | Paper |
| 7 | 37.8% | Scissor |

**Accuracy**: 33.52% (+0.2% vs random)

**Conclusion**: Global frequency not useful. Per-opponent frequency may help for biased players.

---

## Experiment 8: History Match (Repeat Detection)

**Hypothesis**: Look for repeating sequences.

**Result**: Window 5 best, comparable to CTW

| Window | Accuracy | Predictions |
|--------|----------|-------------|
| 2 | 33.35% | 29,749 |
| 3 | 34.17% | 29,254 |
| 4 | 34.14% | 28,071 |
| **5** | **34.19%** | 25,772 |

**Conclusion**: History match works but CTW is better.

---

## Key Conclusions

### What Works
1. **CTW with shallow depth (2-3)** - Best single predictor at 34.8%
2. **Per-opponent learning** - Critical, some opponents 100% predictable
3. **History match (window 5)** - Good secondary signal at 34.2%
4. **Conditional patterns** - Small but consistent signal at 34.0%

### What Doesn't Work
1. **Deep CTW (6+)** - Overfitting to noise
2. **Recency decay** - Hurts performance
3. **Global frequency** - Too uniform
4. **Rotation detection** - No patterns
5. **First-order Markov** - Too simple

### Action Items
- [ ] **CHANGE CTW DEPTH FROM 6 TO 2** (immediate +0.4% improvement)
- [ ] Remove decay from CTW
- [ ] Add history match as secondary predictor
- [ ] Consider per-opponent frequency tracking for biased opponents

---

---

## Round 2 Experiments (2024-12-05)

### Experiment 9: Adaptive Depth
**Result**: 34.73% - WORSE than fixed depth 2 (34.83%)
**Conclusion**: Fixed depth 2 is optimal, don't adapt.

### Experiment 10: Multi-Depth Ensemble
**Result**: 34.77% - WORSE than depth 2
**Conclusion**: Simple depth 2 beats ensemble of multiple depths.

### Experiment 11: Streak Detection
**Result**: No significant behavior change during streaks
- On win streak: R=34.3%, P=32.3%, S=33.4%
- On lose streak: R=34.1%, P=32.6%, S=33.2%
- No streak: R=33.6%, P=32.3%, S=34.1%

**Conclusion**: Streaks don't affect behavior, skip.

### Experiment 12: Bot Detection
**Result**: Found 5 HIGHLY EXPLOITABLE BOTS

| Enemy | Predictability | Repeat Rate | Battles |
|-------|----------------|-------------|---------|
| 1177506788 | 96.7% | 83.3% | 30 |
| 1508288751 | 96.7% | 83.3% | 30 |
| 1850439519 | 96.7% | 83.3% | 30 |
| 911662808 | 90.0% | 83.3% | 30 |
| 100 | 75.0% | 0.0% | 28 |

**Action**: Mark these as known bots for exploitation.

### Experiment 13: Time Patterns
**Result**: Uniform distribution across all turn ranges
- Early (1-10): uniform
- Mid (11-50): uniform
- Late (51+): slight rock bias but only 45 samples

**Conclusion**: No time-based exploitation possible.

### Experiment 14: Counter Detection
**Result**: NO counter-playing detected
- Countered: 33.7%
- Same: 33.3%
- Beaten: 33.0%

**Conclusion**: Opponents don't adapt to our moves. We can be predictable if needed.

---

## Updated Action Items

### Implemented
- [x] Changed CTW depth from 6 to 3 (+0.5% improvement)
- [x] Removed decay from CTW

### Pending
- [ ] Tag known bot opponents for special handling
- [ ] Consider 2-gram patterns (after "paper,scissor" -> rock 37%)

---

## Round 3 Experiments (2024-12-05)

### Experiment 15: Lag-N Patterns
**Result**: Lag-2 and Lag-3 both at 34.55%
**Conclusion**: What they played 2-3 moves ago is predictive, but not better than CTW.

### Experiment 16: Majority Voting
**Result**: 34.72% - worse than best individual predictor
**Key finding**: CTW-3 (34.90%) beats CTW-2 (34.72%)!
**Action**: Updated CTW to use depth 3.

### Experiment 17: Double Move (2-gram) Patterns
**Result**: 34.68% accuracy
**Best patterns**:
- After "paper,scissor" -> rock (37%)
- After "paper,paper" -> rock (36.7%)
- After "paper,rock" -> scissor (36.3%)

### Experiment 18: Joint Player-Enemy Sequence
**Result**: 33.77% - not useful
**Conclusion**: Pure enemy patterns better than joint patterns.

### Experiment 19: Optimal Fixed Strategy
**Result**: Always play rock = 33.88% win rate
**Conclusion**: Slight scissor bias in opponents, but not exploitable.

---

## Round 4 Experiments (2024-12-05)

### Experiment 20: Confidence-Based Fallback
**Result**: 34.78% with threshold 0.35 - WORSE than pure CTW
**Conclusion**: Fallback hurts. Trust CTW always.

### Experiment 21: N-gram Ensemble
**Result**: 34.11% - much worse than CTW
**Conclusion**: N-grams not competitive with CTW.

### Experiment 22: CTW + N-gram Hybrid
**Result**: Pure CTW (1.0/0.0) best at 34.90%
**Conclusion**: Adding n-grams dilutes CTW signal.

### Experiment 23: Per-Opponent Optimal Strategy
**Result**: CTW wins for 17/24 opponents (71%)
**Key finding**: Some opponents (7/24) better predicted by frequency
- Enemy 7: Freq 35.8% vs CTW 34.1%
- Enemy 26: Freq 33.4% vs CTW 33.3%

**Potential**: Could use frequency for specific opponents, but gains marginal.

---

## Round 5 Experiments (2024-12-05)

### Experiment 24: Recent Window CTW
**Result**: Using ALL history is best (34.90%)
| Window | Accuracy |
|--------|----------|
| 10 | 32.75% |
| 50 | 34.33% |
| 100 | 34.04% |
| all | **34.90%** |

**Conclusion**: Don't limit history. All data is valuable.

### Experiment 25: Pattern Strength Filter (KEY FINDING!)
**Result**: Higher confidence = much higher accuracy!

| Threshold | Accuracy | Coverage |
|-----------|----------|----------|
| 0.33 | 34.90% | 100% |
| 0.40 | 35.78% | 52% |
| 0.50 | 36.50% | 15% |
| 0.55 | 37.96% | 10% |
| **0.60** | **38.85%** | **7%** |

**Key insight**: When CTW is confident (>60%), it's 38.85% accurate!
Could use Nash equilibrium fallback for low-confidence rounds.

### Experiment 26: Opponent Volatility
**Result**: Average 4.45% volatility between halves
- Enemy 15: 19% -> 44% (strategy improved)
- Enemy 30: 38% -> 24% (strategy degraded)

**Conclusion**: Some opponents adapt, but overall stable.

### Experiment 27: Win Rate (Bottom Line)
**Result**: **1.93% net advantage** over random
- Win rate: 34.90%
- Loss rate: 32.97%
- Draw rate: 32.13%

**This is the actual money metric!**

### Experiment 28: Nash Fallback Test
**Result**: Nash fallback HURTS performance!

| Threshold | Win Rate | Net Advantage | CTW Used |
|-----------|----------|---------------|----------|
| 0.33 (pure CTW) | 34.90% | **1.93%** | 100% |
| 0.35 | 34.73% | 1.59% | 94% |
| 0.40 | 34.79% | 1.69% | 52% |
| 0.45 | 34.32% | 1.36% | 26% |
| 0.50 | 33.28% | 0.08% | 15% |

**Conclusion**: Pure CTW is optimal. Even low-confidence CTW beats random.
The high accuracy at high confidence (38.85%) is offset by losing edge on low-confidence rounds.

---

## FINAL SUMMARY

### Best Configuration (Implemented)
- **CTW depth 3** (34.90% accuracy)
- **No decay** (all history valuable)
- **Pure CTW** (no fallback)
- **Net advantage: 1.93%** over random

### Experiments Completed: 28
All findings documented and committed.

---

## Experiment History

| Date | Experiment | Result | Action |
|------|-----------|--------|--------|
| 2024-12-05 | CTW Depth | Depth 3 best (34.90%) | **IMPLEMENTED** |
| 2024-12-05 | Per-Opponent | 43.7% avg | Keep per-opponent |
| 2024-12-05 | Transition | 33.6% | Skip |
| 2024-12-05 | Anti-Rotation | 33.3% | Skip |
| 2024-12-05 | Recency | No decay best | **IMPLEMENTED** |
| 2024-12-05 | Conditional | 34.0% | Consider |
| 2024-12-05 | Frequency | 33.5% | Skip global |
| 2024-12-05 | History Match | 34.2% | Consider |
| 2024-12-05 | Adaptive Depth | 34.7% | Skip - fixed better |
| 2024-12-05 | Multi-Depth Ens | 34.8% | Skip - single better |
| 2024-12-05 | Streaks | No effect | Skip |
| 2024-12-05 | Bot Detection | 5 bots found | Tag for exploit |
| 2024-12-05 | Time Patterns | Uniform | Skip |
| 2024-12-05 | Counter Play | Not detected | Skip |
| 2024-12-05 | Bot Exploitation | 5 bots, 85.5% avg acc | Tag for exploit |
| 2024-12-05 | 2-gram Patterns | 35.3% win, 2.94% net | **BREAKTHROUGH** |
| 2024-12-05 | Opponent Clustering | 5 clusters | Cluster-specific |
| 2024-12-05 | Temporal Stability | Static beats adaptive | Patterns stable |
| 2024-12-05 | Cross-Transfer | Local > Global | Per-opponent wins |
| 2024-12-05 | Hybrid CTW+Freq | No improvement | Skip |
| 2024-12-05 | N-gram Depth | 2-gram optimal | **IMPLEMENTED** |
| 2024-12-05 | CTW+2gram Ensemble | 2.70% net (20/80 mix) | **IMPLEMENTED** |

---

## Round 6 Experiments (2024-12-05)

### Experiment 29: Bot Detection & Exploitation
**Result**: 5 deterministic bots identified

| Enemy | Accuracy | Repeat% | Cycle% | Battles |
|-------|----------|---------|--------|---------|
| 1177506788 | 100.0% | 100% | 0% | 30 |
| 1508288751 | 100.0% | 100% | 0% | 30 |
| 1850439519 | 100.0% | 100% | 0% | 30 |
| 911662808 | 93.1% | 0% | 100% | 30 |
| 1611154793 | 34.5% | 24% | 55% | 30 |

**Conclusion**: CTW already exploits these perfectly. No special handling needed.

### Experiment 30: 2-Gram Pattern Exploitation
**Result**: **BREAKTHROUGH!** 35.32% win, 2.94% net advantage

| Pattern | Next Move | Probability |
|---------|-----------|-------------|
| paper,scissor | rock | 37.0% |
| paper,paper | rock | 36.7% |
| paper,rock | scissor | 36.3% |
| rock,scissor | scissor | 35.3% |
| rock,rock | paper | 35.2% |

**Key insight**: Universal patterns across all opponents!

### Experiment 31: Opponent Clustering
**Result**: 5 behavior clusters identified

| Cluster | Opponents | Battles | Avg Accuracy |
|---------|-----------|---------|--------------|
| random | 16 | 17,335 | 32.8% |
| biased | 2 | 143 | 29.7% |
| patterned | 1 | 30 | 93.1% |
| repeater | 3 | 90 | 100.0% |
| other | 7 | 12,358 | 36.3% |

**Conclusion**: Most opponents (~56%) are near-random. Focus on exploiting the ~30% patterned players.

### Experiment 32: Temporal Stability
**Result**: Static model (36.29% win, 6.45% net) BEATS adaptive (35.95%, 3.23%)!

**Key insight**: Patterns are VERY stable over time. Historical data is reliable.

### Experiment 33: Cross-Opponent Transfer
**Result**: Local (35.37%) > Global (34.57%)

**Conclusion**: Per-opponent learning is critical. Global model helps cold-start only.

### Experiment 34: Hybrid CTW + Frequency
**Result**: No improvement over pure CTW at any switch point.

---

## Round 7 Experiments (2024-12-05)

### Experiment 35: N-gram Depth Analysis (Proper Incremental)
**Result**: 2-gram optimal at 2.49% net with 100% coverage

| Depth | Net Advantage | Coverage |
|-------|---------------|----------|
| 1 | 0.78% | 100% |
| **2** | **2.49%** | **100%** |
| 3 | 1.80% | 100% |
| 4 | 2.38% | 99% |
| 5 | 1.92% | 96% |

**Conclusion**: 2-gram is optimal balance of pattern strength and coverage.

### Experiment 36: Per-Opponent vs Global N-gram
**Result**: Global WINS for n-grams (unlike CTW)

| Model | Net Advantage |
|-------|---------------|
| Global 2-gram | 2.49% |
| Per-opponent 2-gram | 1.96% |

**Key insight**: N-gram patterns are UNIVERSAL. Unlike CTW (which benefits from per-opponent), 2-grams work better globally.

### Experiment 37: CTW + 2-gram Ensemble (Proper)
**Result**: **20/80 CTW/2-gram ensemble achieves 2.70% net!**

| Weighting | Net Advantage |
|-----------|---------------|
| Pure CTW | 1.90% |
| Pure 2-gram | 2.50% |
| 80/20 CTW | 1.89% |
| 50/50 | 1.95% |
| **20/80 2-gram** | **2.70%** |

**Implemented**: 20/80 CTW + Global 2-gram ensemble

---

## UPDATED FINAL SUMMARY

### Best Configuration (Implemented)
- **CTW depth 3** (per-opponent Markov patterns)
- **Global 2-gram** (universal cross-opponent patterns)
- **20/80 CTW/2-gram ensemble** for prediction
- **No decay** (all history valuable)
- **Net advantage: 2.70%** over random (vs previous 1.93%)

### Improvement
- Previous net: 1.93%
- New net: 2.70%
- **Improvement: +40%!**

### Key Discoveries
1. 2-gram patterns are UNIVERSAL (work across all opponents)
2. CTW patterns are per-opponent specific
3. Combining both captures complementary signals
4. Patterns are temporally stable (historical data reliable)
5. Most opponents (~56%) are near-random, but ~30% are exploitable
