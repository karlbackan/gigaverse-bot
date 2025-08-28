#!/usr/bin/env python3
"""
Deeper analysis of reactive behavior with individual enemy breakdown
"""

import sqlite3
from collections import defaultdict, Counter
import statistics

def main():
    conn = sqlite3.connect('data/battle-statistics.db')
    cursor = conn.cursor()
    
    print("\n" + "="*80)
    print("INDIVIDUAL ENEMY REACTIVE BEHAVIOR ANALYSIS")
    print("="*80)
    
    # Get all enemies with sufficient data
    cursor.execute("""
        SELECT enemy_id, COUNT(*) as battles
        FROM battles
        GROUP BY enemy_id
        HAVING battles >= 20
        ORDER BY battles DESC
    """)
    enemies = cursor.fetchall()
    
    print(f"\nAnalyzing {len(enemies)} enemies with 20+ battles\n")
    
    reactive_evidence = []
    
    for enemy_id, battle_count in enemies:
        cursor.execute("""
            SELECT turn, player_move, enemy_move, result
            FROM battles
            WHERE enemy_id = ?
            ORDER BY id
        """, (enemy_id,))
        
        battles = cursor.fetchall()
        
        if len(battles) < 10:
            continue
        
        # Detailed reactive analysis
        counter_count = 0
        copy_count = 0
        opposite_count = 0
        
        # Post-loss behavior
        repeat_after_loss = 0
        switch_after_loss = 0
        total_losses = 0
        
        # Post-win behavior
        repeat_after_win = 0
        switch_after_win = 0
        total_wins = 0
        
        # Pattern detection
        patterns = defaultdict(int)
        
        for i in range(1, len(battles)):
            prev_turn = battles[i-1]
            curr_turn = battles[i]
            
            our_prev = prev_turn[1]
            enemy_prev = prev_turn[2]
            enemy_curr = curr_turn[2]
            prev_result = prev_turn[3]
            
            # Basic reactive patterns
            counter = {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}
            opposite = {'rock': 'scissor', 'paper': 'rock', 'scissor': 'paper'}
            
            if enemy_curr == counter[our_prev]:
                counter_count += 1
            elif enemy_curr == our_prev:
                copy_count += 1
            elif enemy_curr == opposite[our_prev]:
                opposite_count += 1
            
            # Result-based patterns
            if prev_result == 'loss':  # Enemy lost
                total_losses += 1
                if enemy_curr == enemy_prev:
                    repeat_after_loss += 1
                else:
                    switch_after_loss += 1
            elif prev_result == 'win':  # Enemy won (our loss)
                total_wins += 1
                if enemy_curr == enemy_prev:
                    repeat_after_win += 1
                else:
                    switch_after_win += 1
            
            # Sequence patterns
            if i >= 2:
                two_back = battles[i-2][2]
                pattern = f"{two_back}-{enemy_prev}-{enemy_curr}"
                patterns[pattern] += 1
        
        # Calculate rates
        total_transitions = len(battles) - 1
        counter_rate = counter_count / total_transitions if total_transitions > 0 else 0
        copy_rate = copy_count / total_transitions if total_transitions > 0 else 0
        opposite_rate = opposite_count / total_transitions if total_transitions > 0 else 0
        
        repeat_loss_rate = repeat_after_loss / total_losses if total_losses > 0 else 0
        switch_loss_rate = switch_after_loss / total_losses if total_losses > 0 else 0
        repeat_win_rate = repeat_after_win / total_wins if total_wins > 0 else 0
        switch_win_rate = switch_after_win / total_wins if total_wins > 0 else 0
        
        # Find most common pattern
        most_common_pattern = max(patterns.items(), key=lambda x: x[1]) if patterns else ("none", 0)
        pattern_freq = most_common_pattern[1] / max(1, len(battles) - 2)
        
        # Determine if reactive
        reactive_score = 0
        reactive_reasons = []
        
        # Strong evidence of reactivity
        if counter_rate > 0.38:  # >38% counter (5% above random)
            reactive_score += 2
            reactive_reasons.append(f"high_counter_{counter_rate:.1%}")
        elif counter_rate > 0.35:
            reactive_score += 1
            reactive_reasons.append(f"moderate_counter_{counter_rate:.1%}")
        
        if copy_rate > 0.38:
            reactive_score += 2
            reactive_reasons.append(f"high_copy_{copy_rate:.1%}")
        elif copy_rate > 0.35:
            reactive_score += 1
            reactive_reasons.append(f"moderate_copy_{copy_rate:.1%}")
        
        if repeat_loss_rate > 0.45:  # Strong tendency after loss
            reactive_score += 2
            reactive_reasons.append(f"repeat_after_loss_{repeat_loss_rate:.1%}")
        elif repeat_loss_rate > 0.40:
            reactive_score += 1
            reactive_reasons.append(f"some_repeat_after_loss_{repeat_loss_rate:.1%}")
        
        if switch_loss_rate > 0.60:  # Strong switching after loss
            reactive_score += 1
            reactive_reasons.append(f"switch_after_loss_{switch_loss_rate:.1%}")
        
        if repeat_win_rate > 0.60:  # Keep winning strategy
            reactive_score += 1
            reactive_reasons.append(f"repeat_after_win_{repeat_win_rate:.1%}")
        
        if pattern_freq > 0.15:  # Repeating pattern
            reactive_score += 1
            reactive_reasons.append(f"pattern_{most_common_pattern[0]}_{pattern_freq:.1%}")
        
        # Store evidence
        evidence = {
            'enemy_id': enemy_id,
            'battles': battle_count,
            'counter_rate': counter_rate,
            'copy_rate': copy_rate,
            'opposite_rate': opposite_rate,
            'repeat_loss_rate': repeat_loss_rate,
            'switch_loss_rate': switch_loss_rate,
            'repeat_win_rate': repeat_win_rate,
            'switch_win_rate': switch_win_rate,
            'reactive_score': reactive_score,
            'reactive_reasons': reactive_reasons,
            'is_reactive': reactive_score >= 2  # Need at least 2 points of evidence
        }
        
        reactive_evidence.append(evidence)
    
    # Sort by reactive score
    reactive_evidence.sort(key=lambda x: x['reactive_score'], reverse=True)
    
    # Print most reactive enemies
    print("TOP REACTIVE ENEMIES (Score >= 2):")
    print("="*60)
    
    for evidence in reactive_evidence:
        if evidence['reactive_score'] >= 2:
            print(f"\n🎯 Enemy {evidence['enemy_id']} (Score: {evidence['reactive_score']}, Battles: {evidence['battles']})")
            print(f"  Counter rate: {evidence['counter_rate']:.1%} (random: 33.3%)")
            print(f"  Copy rate: {evidence['copy_rate']:.1%} (random: 33.3%)")
            print(f"  After loss: Repeat {evidence['repeat_loss_rate']:.1%}, Switch {evidence['switch_loss_rate']:.1%}")
            print(f"  After win: Repeat {evidence['repeat_win_rate']:.1%}, Switch {evidence['switch_win_rate']:.1%}")
            print(f"  Evidence: {', '.join(evidence['reactive_reasons'])}")
    
    # Calculate overall statistics
    print("\n" + "="*60)
    print("STATISTICAL SUMMARY")
    print("="*60)
    
    total_reactive = sum(1 for e in reactive_evidence if e['is_reactive'])
    print(f"\nReactive enemies (score >= 2): {total_reactive}/{len(reactive_evidence)} ({total_reactive/len(reactive_evidence)*100:.1f}%)")
    
    # Distribution of counter rates
    counter_rates = [e['counter_rate'] for e in reactive_evidence]
    above_random = sum(1 for r in counter_rates if r > 0.333)
    well_above = sum(1 for r in counter_rates if r > 0.38)
    
    print(f"\nCounter rate distribution:")
    print(f"  Above 33.3% (random): {above_random}/{len(counter_rates)} ({above_random/len(counter_rates)*100:.1f}%)")
    print(f"  Above 38% (significant): {well_above}/{len(counter_rates)} ({well_above/len(counter_rates)*100:.1f}%)")
    print(f"  Mean: {statistics.mean(counter_rates)*100:.1f}%")
    print(f"  Median: {statistics.median(counter_rates)*100:.1f}%")
    print(f"  Std Dev: {statistics.stdev(counter_rates)*100:.1f}%")
    
    # Post-loss behavior
    repeat_loss_rates = [e['repeat_loss_rate'] for e in reactive_evidence]
    high_repeat = sum(1 for r in repeat_loss_rates if r > 0.40)
    
    print(f"\nPost-loss repetition:")
    print(f"  Repeat >40% after loss: {high_repeat}/{len(repeat_loss_rates)} enemies")
    print(f"  Mean repeat rate: {statistics.mean(repeat_loss_rates)*100:.1f}%")
    
    # Breakdown by score
    print(f"\nReactive score distribution:")
    score_dist = defaultdict(int)
    for e in reactive_evidence:
        score_dist[e['reactive_score']] += 1
    
    for score in sorted(score_dist.keys(), reverse=True):
        print(f"  Score {score}: {score_dist[score]} enemies")
    
    conn.close()

if __name__ == "__main__":
    main()