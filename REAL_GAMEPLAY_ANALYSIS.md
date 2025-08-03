# Real Gameplay Statistics Analysis

Based on **1,026 battles** across all 16 enemies from approximately 18 minutes of gameplay.

## Key Findings

### 1. Battle Distribution
- **Most Encountered**: Enemy 9 (76 battles)
- **Least Encountered**: Enemy 16 (49 battles) 
- **Average**: 64 battles per enemy
- **Fairly Even Distribution**: All enemies faced between 49-76 times

### 2. Enemy Move Preferences

**Rock-Biased Enemies** (Play Rock for Win):
- Enemy 16: **46%** rock (strongest bias)
- Enemy 4: 38% rock
- Enemy 6: 38% rock  
- Enemy 5: 36% rock
- Enemy 15: 36% rock

**Paper-Biased Enemies** (Play Scissor for Win):
- Enemy 3: 40% paper
- Enemy 10: 39% paper
- Enemy 9: 36% paper
- Enemy 12: 35% paper
- Enemy 7: 34% paper

**Scissor-Biased Enemies** (Play Rock for Win):
- Enemy 13: **43%** scissor
- Enemy 2: 41% scissor
- Enemy 8: 37% scissor
- Enemy 14: 36% scissor
- Enemy 11: 35% scissor

**Balanced Enemy**:
- Enemy 1: 33% each (perfectly balanced)

### 3. Strategic Insights

**Best Default Strategies by Enemy**:
```
Enemies 1-3:   Mixed (1), Rock (2), Scissor (3)
Enemies 4-6:   Paper (all prefer Rock)
Enemies 7-10:  Scissor (most prefer Paper)
Enemies 11-13: Rock (most prefer Scissor)
Enemies 14-16: Rock (14 scissor), Paper (15-16 rock)
```

### 4. Pattern Detection Examples

**Enemy 2** shows sequence patterns:
- After "scissor-scissor": Often plays paper (50%)
- After "rock-scissor": Strongly prefers scissor (83%)

**Enemy 16** shows turn-based bias:
- Turn 4: Never plays scissor (60% rock, 40% paper)
- Turn 5: Never plays paper (55% rock, 45% scissor)

### 5. Confidence Levels

With 49-76 battles per enemy, the bot now has:
- **Low Confidence** (30%): Basic move distribution known
- **Medium Confidence** (60%): Some sequence patterns detected
- **High Confidence** (80%+): Will develop with more battles

### 6. Recommendations

1. **Enemy 16**: Always avoid scissor (46% rock bias)
2. **Enemy 13**: Always avoid paper (43% scissor bias)  
3. **Enemy 1**: No clear strategy (perfectly balanced)
4. **More Data Needed**: ~100+ battles per enemy for strong pattern detection

### 7. Time Investment
- 1,026 battles in 18 minutes = **~57 battles/minute**
- At this rate: ~2 minutes per enemy to reach 100 battles
- Full pattern detection for all enemies: ~30 minutes of gameplay