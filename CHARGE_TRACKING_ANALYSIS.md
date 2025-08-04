# Enemy Charge Tracking - Critical Missing Feature

## The Oversight

We completely missed that enemies have the same charge constraints as players:
- 3 charges per weapon (rock, paper, scissor)
- Consume 1 charge per use
- Recharge 1 per turn for unused weapons

## Impact Analysis

### Current System
- Predicts based on patterns: ~60-80% confidence
- Assumes all 3 moves always possible
- Win rate: ~30-40%

### With Charge Tracking
If we track enemy charges, we can:

1. **Eliminate Impossible Moves**
   - Enemy used rock 3 times? Rock = 0 charges, IMPOSSIBLE
   - Reduces prediction space from 3 to 2 or even 1 option
   - Confidence could reach 100% in some situations

2. **Force Predictable Situations**
   ```
   Turn 1: Enemy uses rock (rock: 2, paper: 3, scissor: 3)
   Turn 2: Enemy uses rock (rock: 1, paper: 3, scissor: 3)
   Turn 3: Enemy uses rock (rock: 0, paper: 3, scissor: 3)
   Turn 4: Enemy MUST use paper or scissor!
   ```

3. **Strategic Charge Depletion**
   - If enemy favors rock (60% usage)
   - We can predict when they'll run out
   - Force them into suboptimal moves

## Example Scenario

Enemy pattern: Loves rock (60%), sometimes paper (30%), rarely scissor (10%)

**Without charge tracking:**
- Turn 4: We predict 60% rock, 30% paper, 10% scissor
- We play paper (to beat rock)
- Enemy actually can't use rock! Uses paper instead
- We lose

**With charge tracking:**
- Turn 4: We KNOW rock is impossible (0 charges)
- We predict 75% paper, 25% scissor
- We play scissor
- We win!

## Implementation Requirements

1. Track enemy move history within each battle
2. Calculate current enemy charges based on usage
3. Filter predictions to only include possible moves
4. Boost confidence when options are limited

## Expected Impact

- **Win rate improvement**: +5-10% minimum
- **Confidence improvement**: Many 100% confidence situations
- **Strategic advantage**: Force enemies into bad positions

This is potentially MORE impactful than all 5 robustness improvements combined!