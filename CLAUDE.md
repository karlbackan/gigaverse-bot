# Gigaverse Bot Project Instructions

## Account Order

The general order for accounts 1 to 5 is:

1. Account 1: 0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0 (Main Account/loki)
2. Account 2: 0x9eA5626fCEdac54de64A87243743f0CE7AaC5816 
3. Account 3: 0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963
4. Account 4: 0x2153433D4c13f72b5b10af5dF5fC93866Eea046b
5. Account 5: 0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81

These accounts are configured in the `.env` file with their corresponding JWT tokens.

## Running the Bot

| Command | Description |
|---------|-------------|
| `npm run menu` | Interactive menu (options 1-8) |
| `node run-continuous.mjs` | Non-interactive continuous mode (runs all accounts in a loop) |
| `node check-all-accounts.mjs` | Check status of all 5 accounts |

**Recommended:** Use `node run-continuous.mjs` for automated running without interactive prompts.

## Agents - Use Extensively

**IMPORTANT:** Always prefer using specialized agents over normal tool use for complex tasks. Agents have domain knowledge, can perform multi-step research, and produce better results.

### Available Agents

#### `/agents:gigaverse-algorithm-researcher`
**When to use:**
- Researching new ML/statistical algorithms for RPS prediction
- Finding academic papers on game theory, opponent modeling
- Comparing algorithms (Thompson Sampling vs UCB, LSTM vs Transformer)
- Looking up GitHub implementations of specific techniques
- Investigating competition-winning strategies (Iocaine Powder, etc.)

**Example prompts:**
- "Research Context Tree Weighting for pattern detection"
- "Find state-of-the-art opponent modeling techniques"
- "Compare regret minimization algorithms"

#### `/agents:gigaverse-algorithm-implementer`
**When to use:**
- Implementing new algorithms in the decision engine
- Adding new strategies to the multi-armed bandit
- Modifying pattern detection systems
- Adding new neural network architectures
- Refactoring ML components

**Example prompts:**
- "Implement Thompson Sampling to replace epsilon-greedy"
- "Add LSTM-based sequence prediction"
- "Implement Iocaine Powder meta-strategy"

### When to Use Agents vs Direct Tools

| Task | Use Agent | Use Direct Tools |
|------|-----------|------------------|
| Research algorithms | ✅ Researcher | ❌ |
| Implement new feature | ✅ Implementer | ❌ |
| Quick file edit | ❌ | ✅ Edit tool |
| Update JWT tokens | ❌ | ✅ Edit tool |
| Run bot | ❌ | ✅ Bash tool |
| Debug specific error | ❌ | ✅ Read + Grep |
| Explore codebase structure | ✅ Explore agent | ❌ |
| Multi-file refactoring | ✅ code-refactoring-architect | ❌ |

### Key Decision Files

When working on algorithm improvements, these are the main files:

| File | Purpose |
|------|---------|
| `src/ml-decision-engine.mjs` | Multi-Armed Bandits, Q-Learning, Neural Net |
| `src/adaptive-markov-detector.mjs` | Markov chain pattern detection |
| `src/robust-pattern-detector.mjs` | Statistical pattern detection |
| `src/unified-scoring.mjs` | Win/draw/loss scoring |
| `src/enemy-pattern-detector.mjs` | Per-enemy tracking |
| `src/threat-calculator.mjs` | Damage calculations |

### Current Algorithm Stack

- **Strategy Selection:** EXP3 (adversarial-optimal multi-armed bandit)
- **Pattern Detection:** CTW with Markov-6 depth (50.9% expected win rate)
- **Neural Network:** 2-layer feedforward (22→20→3) with charge features
- **Q-Learning:** Double DQN, tabular, discretized states
- **Opponent Modeling:** Iocaine Powder + Bayesian type inference
- **Ensemble:** Weighted combination of CTW, Bayesian, Iocaine, Neural

### Implemented Improvements

| Feature | Status | Impact |
|---------|--------|--------|
| EXP3 Strategy Selection | ✅ Done | +1-2% (adversarial-optimal) |
| Iocaine Powder Meta-Strategy | ✅ Done | High |
| Context Tree Weighting (Markov-6) | ✅ Done | +17% over random |
| Bayesian Opponent Modeling | ✅ Done | Medium |
| Charge-based Features (+7 features) | ✅ Done | +5.4% lift |
| Full Model Persistence | ✅ Done | Critical |

### Potential Future Improvements

1. **LSTM Network** - Replace SimpleRNN with LSTM for better sequence memory
2. **Joint Sequence Patterns** - Consider (player, enemy) move pairs