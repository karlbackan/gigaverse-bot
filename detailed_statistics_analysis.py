#!/usr/bin/env python3
"""
Detailed statistical analysis showing evidence for enemy adaptation conclusions
"""

import sqlite3
import json
from collections import defaultdict, Counter
from typing import Dict, List, Tuple
import math
import statistics

def main():
    conn = sqlite3.connect('data/battle-statistics.db')
    cursor = conn.cursor()
    
    print("\n" + "="*80)
    print("DETAILED STATISTICAL EVIDENCE FOR ENEMY ADAPTATION")
    print("="*80)
    
    # 1. REACTIVE BEHAVIOR EVIDENCE
    print("\n" + "="*60)
    print("1. REACTIVE BEHAVIOR STATISTICS")
    print("="*60)
    
    # Get all battles with sufficient history
    cursor.execute("""
        SELECT enemy_id, COUNT(*) as battles
        FROM battles
        GROUP BY enemy_id
        HAVING battles >= 15
        ORDER BY battles DESC
    """)
    enemies = cursor.fetchall()
    total_enemies = len(enemies)
    
    reactive_enemies = []
    counter_rates = []
    copy_rates = []
    post_loss_patterns = defaultdict(lambda: defaultdict(int))
    
    for enemy_id, battle_count in enemies:
        cursor.execute("""
            SELECT turn, player_move, enemy_move, result
            FROM battles
            WHERE enemy_id = ?
            ORDER BY id
        """, (enemy_id,))
        
        battles = cursor.fetchall()
        
        if len(battles) < 2:
            continue
            
        # Calculate counter rate
        counter_count = 0
        copy_count = 0
        valid_transitions = 0
        
        for i in range(1, len(battles)):
            our_prev = battles[i-1][1]  # Our previous move
            enemy_curr = battles[i][2]  # Enemy's current move
            
            # Check if enemy counters our previous
            counter = {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}
            if enemy_curr == counter[our_prev]:
                counter_count += 1
            
            # Check if enemy copies
            if enemy_curr == our_prev:
                copy_count += 1
            
            valid_transitions += 1
        
        if valid_transitions > 0:
            counter_rate = counter_count / valid_transitions
            copy_rate = copy_count / valid_transitions
            counter_rates.append(counter_rate)
            copy_rates.append(copy_rate)
            
            # Check post-loss behavior
            for i in range(1, len(battles)):
                if battles[i-1][3] == 'loss':  # Enemy lost
                    enemy_prev = battles[i-1][2]
                    enemy_next = battles[i][2]
                    
                    if enemy_next == enemy_prev:
                        post_loss_patterns[enemy_id]['repeats'] += 1
                    elif enemy_next == counter[enemy_prev]:
                        post_loss_patterns[enemy_id]['switches_to_counter'] += 1
                    else:
                        post_loss_patterns[enemy_id]['other'] += 1
                    post_loss_patterns[enemy_id]['total'] += 1
            
            # Mark as reactive if shows significant patterns
            is_reactive = (counter_rate > 0.35 or  # Above random (33.3%)
                          copy_rate > 0.35 or
                          (post_loss_patterns[enemy_id]['repeats'] / max(1, post_loss_patterns[enemy_id]['total']) > 0.4))
            
            if is_reactive:
                reactive_enemies.append({
                    'id': enemy_id,
                    'counter_rate': counter_rate,
                    'copy_rate': copy_rate,
                    'post_loss_repeat': post_loss_patterns[enemy_id]['repeats'] / max(1, post_loss_patterns[enemy_id]['total'])
                })
    
    print(f"\nTotal enemies analyzed: {total_enemies}")
    print(f"Reactive enemies found: {len(reactive_enemies)} ({len(reactive_enemies)/total_enemies*100:.1f}%)")
    
    print("\n📊 Counter Rate Statistics (Expected random: 33.3%):")
    print(f"  Mean counter rate: {statistics.mean(counter_rates)*100:.1f}%")
    print(f"  Median counter rate: {statistics.median(counter_rates)*100:.1f}%")
    print(f"  Enemies above random (>33.3%): {sum(1 for r in counter_rates if r > 0.333)} ({sum(1 for r in counter_rates if r > 0.333)/len(counter_rates)*100:.1f}%)")
    
    print("\n📊 Copy Rate Statistics (Expected random: 33.3%):")
    print(f"  Mean copy rate: {statistics.mean(copy_rates)*100:.1f}%")
    print(f"  Median copy rate: {statistics.median(copy_rates)*100:.1f}%")
    
    print("\n📊 Post-Loss Behavior:")
    repeat_rates = []
    for enemy_id, patterns in post_loss_patterns.items():
        if patterns['total'] > 5:  # Sufficient data
            repeat_rate = patterns['repeats'] / patterns['total']
            repeat_rates.append(repeat_rate)
    
    if repeat_rates:
        print(f"  Mean repeat rate after loss: {statistics.mean(repeat_rates)*100:.1f}%")
        print(f"  Enemies that repeat >40% after loss: {sum(1 for r in repeat_rates if r > 0.4)} enemies")
    
    # 2. ADAPTATION OVER TIME EVIDENCE
    print("\n" + "="*60)
    print("2. STRATEGY EVOLUTION STATISTICS")
    print("="*60)
    
    enemies_with_shifts = 0
    distribution_changes = []
    entropy_changes = []
    
    for enemy_id, battle_count in enemies[:10]:  # Top 10 enemies
        cursor.execute("""
            SELECT turn, player_move, enemy_move, result
            FROM battles
            WHERE enemy_id = ?
            ORDER BY id
        """, (enemy_id,))
        
        battles = cursor.fetchall()
        
        if len(battles) < 20:
            continue
        
        # Split into first and last third
        first_third = battles[:len(battles)//3]
        last_third = battles[2*len(battles)//3:]
        
        # Calculate distributions
        first_dist = Counter([b[2] for b in first_third])
        last_dist = Counter([b[2] for b in last_third])
        
        first_total = sum(first_dist.values())
        last_total = sum(last_dist.values())
        
        # Calculate changes
        for move in ['rock', 'paper', 'scissor']:
            first_prob = first_dist[move] / first_total if first_total > 0 else 0.333
            last_prob = last_dist[move] / last_total if last_total > 0 else 0.333
            change = abs(last_prob - first_prob)
            distribution_changes.append(change)
            
            if change > 0.15:  # Significant change
                enemies_with_shifts += 1
                print(f"\nEnemy {enemy_id}: {move} changed from {first_prob:.1%} to {last_prob:.1%} (Δ={change:.1%})")
                break
    
    print(f"\n📊 Distribution Change Statistics:")
    print(f"  Mean absolute change per move: {statistics.mean(distribution_changes)*100:.1f}%")
    print(f"  Max change observed: {max(distribution_changes)*100:.1f}%")
    print(f"  Enemies with >15% shift in any move: {enemies_with_shifts}")
    
    # 3. PERFORMANCE TRENDS
    print("\n" + "="*60)
    print("3. PERFORMANCE TREND STATISTICS")
    print("="*60)
    
    improving_enemies = 0
    declining_enemies = 0
    performance_changes = []
    
    for enemy_id, battle_count in enemies:
        cursor.execute("""
            SELECT turn, player_move, enemy_move, result
            FROM battles
            WHERE enemy_id = ?
            ORDER BY id
        """, (enemy_id,))
        
        battles = cursor.fetchall()
        
        if len(battles) < 20:
            continue
        
        # Calculate win rates (from enemy perspective)
        first_half = battles[:len(battles)//2]
        second_half = battles[len(battles)//2:]
        
        first_wins = sum(1 for b in first_half if b[3] == 'loss')  # Our loss = enemy win
        second_wins = sum(1 for b in second_half if b[3] == 'loss')
        
        first_rate = first_wins / len(first_half) if first_half else 0
        second_rate = second_wins / len(second_half) if second_half else 0
        
        change = second_rate - first_rate
        performance_changes.append(change)
        
        if change > 0.1:
            improving_enemies += 1
        elif change < -0.1:
            declining_enemies += 1
    
    print(f"\n📊 Enemy Performance Changes (First Half vs Second Half):")
    print(f"  Improving (>10% better): {improving_enemies} enemies")
    print(f"  Declining (>10% worse): {declining_enemies} enemies")
    print(f"  Stable (±10%): {total_enemies - improving_enemies - declining_enemies} enemies")
    print(f"  Mean performance change: {statistics.mean(performance_changes)*100:+.1f}%")
    
    # 4. PATTERN FREQUENCY ANALYSIS
    print("\n" + "="*60)
    print("4. SEQUENTIAL PATTERN ANALYSIS")
    print("="*60)
    
    # Look for 2-move and 3-move patterns
    two_patterns = defaultdict(int)
    three_patterns = defaultdict(int)
    total_sequences = 0
    
    cursor.execute("""
        SELECT enemy_id, enemy_move
        FROM battles
        ORDER BY enemy_id, id
        LIMIT 1000
    """)
    
    current_enemy = None
    enemy_sequence = []
    
    for enemy_id, move in cursor.fetchall():
        if enemy_id != current_enemy:
            # Process previous enemy's sequences
            if len(enemy_sequence) >= 2:
                for i in range(len(enemy_sequence) - 1):
                    pattern = f"{enemy_sequence[i]}-{enemy_sequence[i+1]}"
                    two_patterns[pattern] += 1
                    total_sequences += 1
                
                for i in range(len(enemy_sequence) - 2):
                    pattern = f"{enemy_sequence[i]}-{enemy_sequence[i+1]}-{enemy_sequence[i+2]}"
                    three_patterns[pattern] += 1
            
            current_enemy = enemy_id
            enemy_sequence = [move]
        else:
            enemy_sequence.append(move)
    
    print("\n📊 Most Common 2-Move Patterns:")
    for pattern, count in sorted(two_patterns.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  {pattern}: {count} times ({count/total_sequences*100:.1f}%)")
    
    # Check for cycling
    forward_cycle = two_patterns['rock-paper'] + two_patterns['paper-scissor'] + two_patterns['scissor-rock']
    reverse_cycle = two_patterns['rock-scissor'] + two_patterns['paper-rock'] + two_patterns['scissor-paper']
    
    print(f"\n📊 Cycling Behavior:")
    print(f"  Forward cycle (R→P→S→R): {forward_cycle} transitions")
    print(f"  Reverse cycle (R→S→P→R): {reverse_cycle} transitions")
    print(f"  Cycle ratio: {forward_cycle/max(1,reverse_cycle):.2f}:1")
    
    # 5. STATISTICAL SIGNIFICANCE TESTS
    print("\n" + "="*60)
    print("5. STATISTICAL SIGNIFICANCE")
    print("="*60)
    
    # Chi-square test for counter rate
    expected_counter = 0.333
    observed_above = sum(1 for r in counter_rates if r > expected_counter)
    expected_above = len(counter_rates) * 0.5  # If random, 50% would be above
    
    chi_square = (observed_above - expected_above) ** 2 / expected_above
    
    print(f"\n📊 Chi-Square Test for Counter Behavior:")
    print(f"  Expected enemies above 33.3%: {expected_above:.0f}")
    print(f"  Observed enemies above 33.3%: {observed_above}")
    print(f"  Chi-square value: {chi_square:.2f}")
    print(f"  Significant? {'YES' if chi_square > 3.84 else 'NO'} (p<0.05 if χ² > 3.84)")
    
    # Calculate confidence intervals
    if counter_rates:
        mean_counter = statistics.mean(counter_rates)
        std_counter = statistics.stdev(counter_rates) if len(counter_rates) > 1 else 0
        ci_95 = 1.96 * std_counter / math.sqrt(len(counter_rates))
        
        print(f"\n📊 95% Confidence Interval for Counter Rate:")
        print(f"  Mean: {mean_counter*100:.1f}%")
        print(f"  95% CI: [{(mean_counter-ci_95)*100:.1f}%, {(mean_counter+ci_95)*100:.1f}%]")
        print(f"  Random expectation: 33.3%")
        print(f"  Conclusion: {'NOT RANDOM' if (mean_counter-ci_95) > 0.333 else 'Could be random'}")
    
    conn.close()

if __name__ == "__main__":
    main()