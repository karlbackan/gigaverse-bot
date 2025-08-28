#!/usr/bin/env python3
"""
More realistic performance test with noise and imperfect detection
"""

import random
from collections import defaultdict

def get_counter(move):
    return {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}[move]

def get_result(our_move, enemy_move):
    if our_move == enemy_move:
        return 'tie'
    elif get_counter(enemy_move) == our_move:
        return 'win'
    else:
        return 'loss'

def realistic_enemy(profile, our_last, enemy_last, last_result):
    """More realistic enemy with noise"""
    moves = ['rock', 'paper', 'scissor']
    
    # Add 20% pure randomness to all enemies (noise)
    if random.random() < 0.2:
        return random.choice(moves)
    
    if profile['type'] == 'fixed':
        # 90% plays fixed, 10% random (might not be truly fixed)
        if random.random() < 0.9:
            return profile['pattern']
        return random.choice(moves)
    
    elif profile['type'] == 'counter':
        # Only counters 30-40% (not the claimed 45%)
        actual_rate = profile['rate'] * 0.8  # Reduce claimed rate
        if our_last and random.random() < actual_rate:
            return get_counter(our_last)
        return random.choice(moves)
    
    elif profile['type'] == 'copier':
        # Copies less reliably
        actual_rate = profile['rate'] * 0.75
        if our_last and random.random() < actual_rate:
            return our_last
        return random.choice(moves)
    
    else:
        return random.choice(moves)

def imperfect_detection(profile, battles_seen, our_last, enemy_last, last_result, weapon_available):
    """Imperfect detection with failures"""
    moves = ['rock', 'paper', 'scissor']
    
    # Takes longer to detect (20 battles, not 10)
    detection_quality = min(1.0, battles_seen / 20)
    
    # 30% chance our optimal counter isn't available (charges)
    if random.random() < 0.3:
        weapon_available = False
    
    # Detection confidence
    if random.random() > detection_quality:
        # Haven't detected pattern yet
        return random.choice(moves)
    
    # Misclassification chance (10%)
    if random.random() < 0.1:
        # Wrong classification
        return random.choice(moves)
    
    # Try to exploit pattern
    if profile['type'] == 'fixed':
        optimal = get_counter(profile['pattern'])
        if weapon_available:
            return optimal
        else:
            # Can't use optimal, pick random available
            return random.choice([m for m in moves if m != optimal])
    
    elif profile['type'] == 'counter' and our_last:
        # Only 70% correct second-order prediction
        if random.random() < 0.7:
            expected = get_counter(our_last)
            return get_counter(expected)
        return random.choice(moves)
    
    elif profile['type'] == 'copier' and our_last:
        if random.random() < 0.7:
            return get_counter(our_last)
        return random.choice(moves)
    
    return random.choice(moves)

def simulate_realistic(num_simulations=1000):
    """Run realistic simulations"""
    
    profiles = [
        {'type': 'fixed', 'pattern': 'rock'},
        {'type': 'fixed', 'pattern': 'paper'},
        {'type': 'counter', 'rate': 0.45},
        {'type': 'counter', 'rate': 0.40},
        {'type': 'copier', 'rate': 0.48},
        {'type': 'copier', 'rate': 0.45},
        {'type': 'random'},
        {'type': 'random'},
    ]
    
    results_without = defaultdict(int)
    results_with = defaultdict(int)
    
    for sim in range(num_simulations):
        profile = random.choice(profiles)
        battles_per_enemy = random.randint(20, 50)
        
        # Without detection
        our_last = None
        enemy_last = None
        last_result = None
        
        for i in range(battles_per_enemy):
            our_move = random.choice(['rock', 'paper', 'scissor'])
            enemy_move = realistic_enemy(profile, our_last, enemy_last, last_result)
            result = get_result(our_move, enemy_move)
            results_without[result] += 1
            
            our_last = our_move
            enemy_last = enemy_move
            last_result = result
        
        # With imperfect detection
        our_last = None
        enemy_last = None
        last_result = None
        
        for i in range(battles_per_enemy):
            weapon_available = random.random() > 0.3  # 70% chance we have the weapon
            our_move = imperfect_detection(profile, i, our_last, enemy_last, last_result, weapon_available)
            enemy_move = realistic_enemy(profile, our_last, enemy_last, last_result)
            result = get_result(our_move, enemy_move)
            results_with[result] += 1
            
            our_last = our_move
            enemy_last = enemy_move
            last_result = result
    
    return results_without, results_with

def main():
    print("\n" + "="*80)
    print("REALISTIC PERFORMANCE TEST (with noise and imperfect detection)")
    print("="*80)
    
    print("\nSimulating 1000 enemy encounters with:")
    print("- 20% random noise in enemy behavior")
    print("- 30% chance optimal counter unavailable (charges)")
    print("- 10% pattern misclassification rate")
    print("- 20 battles needed for full detection (not 10)")
    print("- Actual rates lower than observed (overfitting adjustment)")
    
    without, with_detection = simulate_realistic()
    
    total_without = sum(without.values())
    total_with = sum(with_detection.values())
    
    print("\n" + "="*60)
    print("REALISTIC RESULTS")
    print("="*60)
    
    print(f"\nWithout Detection:")
    print(f"  Wins:   {without['win']} ({without['win']/total_without*100:.1f}%)")
    print(f"  Ties:   {without['tie']} ({without['tie']/total_without*100:.1f}%)")
    print(f"  Losses: {without['loss']} ({without['loss']/total_without*100:.1f}%)")
    print(f"  Survival: {(without['win']+without['tie'])/total_without*100:.1f}%")
    
    print(f"\nWith Imperfect Detection:")
    print(f"  Wins:   {with_detection['win']} ({with_detection['win']/total_with*100:.1f}%)")
    print(f"  Ties:   {with_detection['tie']} ({with_detection['tie']/total_with*100:.1f}%)")
    print(f"  Losses: {with_detection['loss']} ({with_detection['loss']/total_with*100:.1f}%)")
    print(f"  Survival: {(with_detection['win']+with_detection['tie'])/total_with*100:.1f}%")
    
    improvement = ((with_detection['win']+with_detection['tie'])/total_with - 
                  (without['win']+without['tie'])/total_without) * 100
    
    print(f"\n🎯 REALISTIC IMPROVEMENT: {improvement:+.1f}% survival rate")
    
    print("\n" + "="*60)
    print("REALITY CHECK")
    print("="*60)
    
    print("\nOptimistic simulation claimed: +11.3% improvement")
    print(f"Realistic simulation shows: {improvement:+.1f}% improvement")
    print(f"Overfitting factor: {11.3/max(0.1, improvement):.1f}x")
    
    if improvement < 5:
        print("\n⚠️  WARNING: Detection system may not provide significant benefit")
        print("    Consider focusing on improving base ML accuracy instead")
    elif improvement < 8:
        print("\n✓  MODERATE: Detection provides some benefit but not game-changing")
        print("    Worth implementing but manage expectations")
    else:
        print("\n✓  GOOD: Detection system appears genuinely beneficial")

if __name__ == "__main__":
    main()