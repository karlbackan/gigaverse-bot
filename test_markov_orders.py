#!/usr/bin/env python3
"""
Demonstrate why higher-order Markov chains are better when you have enough data
"""

import random

def generate_enemy_with_pattern(num_battles):
    """Generate an enemy with a Markov-3 pattern"""
    battles = []
    
    # Define a Markov-3 pattern: after rock->paper->scissor, always play rock
    pattern_context = ['rock', 'paper', 'scissor']
    pattern_response = 'rock'
    
    # Start with some random moves
    current_moves = ['rock', 'paper', 'scissor']
    
    for i in range(num_battles):
        if i < 3:
            # Initial random moves
            move = random.choice(['rock', 'paper', 'scissor'])
        else:
            # Check if last 3 moves match our pattern
            last_3 = [battles[i-3]['move'], battles[i-2]['move'], battles[i-1]['move']]
            
            if last_3 == pattern_context:
                # Follow the pattern 80% of the time (with 20% noise)
                move = pattern_response if random.random() < 0.8 else random.choice(['rock', 'paper', 'scissor'])
            else:
                # Otherwise play randomly, but sometimes create the pattern setup
                if random.random() < 0.3 and i >= 2:
                    # Try to set up the pattern
                    if battles[-2]['move'] == 'rock' and battles[-1]['move'] == 'paper':
                        move = 'scissor'  # Complete the pattern context
                    elif battles[-1]['move'] == 'rock':
                        move = 'paper'  # Start pattern
                    else:
                        move = random.choice(['rock', 'paper', 'scissor'])
                else:
                    move = random.choice(['rock', 'paper', 'scissor'])
        
        battles.append({'move': move})
    
    return battles

def detect_markov_1(battles):
    """Detect patterns using only last move (Markov-1)"""
    if len(battles) < 10:
        return None
    
    # Count transitions
    transitions = {}
    for i in range(1, len(battles)):
        prev = battles[i-1]['move']
        curr = battles[i]['move']
        key = f"{prev}->{curr}"
        transitions[key] = transitions.get(key, 0) + 1
    
    # Find most common transition
    best_transition = max(transitions.items(), key=lambda x: x[1])
    total = sum(transitions.values())
    
    if best_transition[1] / total > 0.4:  # 40% threshold
        return f"Markov-1: {best_transition[0]} occurs {best_transition[1]}/{total} times"
    return None

def detect_markov_3(battles):
    """Detect patterns using last 3 moves (Markov-3)"""
    if len(battles) < 30:
        return None
    
    # Count 4-grams
    patterns = {}
    for i in range(3, len(battles)):
        context = f"{battles[i-3]['move']}-{battles[i-2]['move']}-{battles[i-1]['move']}"
        next_move = battles[i]['move']
        key = f"{context}->{next_move}"
        patterns[key] = patterns.get(key, 0) + 1
    
    # Find most predictive pattern
    best_pattern = None
    best_ratio = 0
    
    for pattern, count in patterns.items():
        context = pattern.split('->')[0]
        # Count total occurrences of this context
        context_total = sum(c for p, c in patterns.items() if p.startswith(context))
        
        if context_total >= 5:  # Need minimum samples
            ratio = count / context_total
            if ratio > best_ratio:
                best_ratio = ratio
                best_pattern = pattern
    
    if best_ratio > 0.6:  # 60% threshold for Markov-3
        return f"Markov-3: {best_pattern} with {best_ratio:.1%} accuracy"
    return None

def main():
    print("\n" + "="*70)
    print("MARKOV ORDER COMPARISON: Why Markov-3 > Markov-1")
    print("="*70)
    
    print("\nGenerating enemy with pattern: rock->paper->scissor => rock (80% of time)")
    
    # Test with different amounts of data
    for num_battles in [20, 50, 100, 200]:
        print(f"\n--- With {num_battles} battles ---")
        
        success_markov1 = 0
        success_markov3 = 0
        
        # Run 100 simulations
        for _ in range(100):
            battles = generate_enemy_with_pattern(num_battles)
            
            m1 = detect_markov_1(battles)
            m3 = detect_markov_3(battles)
            
            if m1:
                success_markov1 += 1
            if m3:
                success_markov3 += 1
        
        print(f"Markov-1 detection rate: {success_markov1}%")
        print(f"Markov-3 detection rate: {success_markov3}%")
        
        # Show example detections
        example_battles = generate_enemy_with_pattern(num_battles)
        m1_result = detect_markov_1(example_battles)
        m3_result = detect_markov_3(example_battles)
        
        if m1_result:
            print(f"  Markov-1 found: {m1_result}")
        else:
            print(f"  Markov-1: No pattern detected")
            
        if m3_result:
            print(f"  Markov-3 found: {m3_result}")
        else:
            print(f"  Markov-3: No pattern detected")
    
    print("\n" + "="*70)
    print("CONCLUSION")
    print("="*70)
    print("""
Markov-1 problems:
- Misses the actual pattern (rock->paper->scissor->rock)
- Might detect false patterns like "scissor->rock" (part of the real pattern)
- Can't distinguish between different contexts

Markov-3 advantages:
- Correctly identifies the full sequence
- Much higher accuracy when pattern exists
- Requires more data but gives better predictions
    """)

if __name__ == "__main__":
    main()