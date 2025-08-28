#!/usr/bin/env python3
"""
Deep analysis of enemy move patterns and adaptation over time
"""

import sqlite3
import json
from collections import defaultdict, Counter
from typing import Dict, List, Tuple
import math

def calculate_entropy(distribution: Dict[str, float]) -> float:
    """Calculate Shannon entropy of a distribution"""
    entropy = 0
    for prob in distribution.values():
        if prob > 0:
            entropy -= prob * math.log2(prob)
    return entropy

def get_distribution(moves: List[str]) -> Dict[str, float]:
    """Get probability distribution of moves"""
    if not moves:
        return {'rock': 0.33, 'paper': 0.33, 'scissor': 0.34}
    
    counter = Counter(moves)
    total = len(moves)
    return {
        'rock': counter.get('rock', 0) / total,
        'paper': counter.get('paper', 0) / total,
        'scissor': counter.get('scissor', 0) / total
    }

def detect_patterns(moves: List[str]) -> Dict:
    """Detect various patterns in move sequences"""
    patterns = {
        'sequences': [],
        'cycles': [],
        'biases': []
    }
    
    if len(moves) < 3:
        return patterns
    
    # Look for repeating sequences
    for seq_len in [2, 3, 4]:
        if len(moves) >= seq_len * 2:
            sequences = defaultdict(int)
            for i in range(len(moves) - seq_len + 1):
                seq = '-'.join(moves[i:i+seq_len])
                sequences[seq] += 1
            
            # Find most common sequences
            for seq, count in sorted(sequences.items(), key=lambda x: x[1], reverse=True)[:3]:
                if count >= 2:
                    patterns['sequences'].append({
                        'pattern': seq,
                        'count': count,
                        'frequency': count / (len(moves) - seq_len + 1)
                    })
    
    # Check for cycling (rock->paper->scissor->rock)
    cycle_count = 0
    counter_cycle = 0
    for i in range(1, len(moves)):
        if moves[i] == {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}.get(moves[i-1]):
            cycle_count += 1
        if moves[i] == {'rock': 'scissor', 'paper': 'rock', 'scissor': 'paper'}.get(moves[i-1]):
            counter_cycle += 1
    
    if cycle_count > len(moves) * 0.4:
        patterns['cycles'].append('forward_cycle')
    if counter_cycle > len(moves) * 0.4:
        patterns['cycles'].append('reverse_cycle')
    
    # Check for strong biases
    dist = get_distribution(moves)
    for move, prob in dist.items():
        if prob > 0.45:
            patterns['biases'].append(f'heavy_{move}_bias_{prob:.1%}')
        elif prob < 0.20:
            patterns['biases'].append(f'avoids_{move}_{prob:.1%}')
    
    return patterns

def analyze_enemy_evolution(enemy_id: int, moves: List[Tuple[int, str, str]]) -> Dict:
    """Analyze how a specific enemy's strategy evolves"""
    
    if len(moves) < 10:
        return {
            'enemy_id': enemy_id,
            'status': 'insufficient_data',
            'total_moves': len(moves)
        }
    
    # Split into early, middle, and late game
    third = len(moves) // 3
    early_moves = [m[1] for m in moves[:third]]
    middle_moves = [m[1] for m in moves[third:third*2]]
    late_moves = [m[1] for m in moves[third*2:]]
    
    # Also split by every 10 moves for granular analysis
    windows = []
    for i in range(0, len(moves), 10):
        window = [m[1] for m in moves[i:i+10]]
        if window:
            windows.append(window)
    
    # Calculate distributions
    early_dist = get_distribution(early_moves)
    middle_dist = get_distribution(middle_moves)
    late_dist = get_distribution(late_moves)
    
    # Calculate entropy evolution
    window_entropies = [calculate_entropy(get_distribution(w)) for w in windows]
    
    # Detect adaptation
    adaptation_signs = []
    
    # Check for distribution shifts
    for move in ['rock', 'paper', 'scissor']:
        early_to_mid = middle_dist[move] - early_dist[move]
        mid_to_late = late_dist[move] - middle_dist[move]
        
        if abs(early_to_mid) > 0.15:
            direction = "increased" if early_to_mid > 0 else "decreased"
            adaptation_signs.append(f'{move}_{direction}_early_to_mid_{abs(early_to_mid):.1%}')
        
        if abs(mid_to_late) > 0.15:
            direction = "increased" if mid_to_late > 0 else "decreased"
            adaptation_signs.append(f'{move}_{direction}_mid_to_late_{abs(mid_to_late):.1%}')
    
    # Check entropy trend
    if len(window_entropies) >= 3:
        entropy_trend = window_entropies[-1] - window_entropies[0]
        if entropy_trend > 0.3:
            adaptation_signs.append('becoming_more_random')
        elif entropy_trend < -0.3:
            adaptation_signs.append('becoming_more_predictable')
    
    # Detect pattern changes
    early_patterns = detect_patterns(early_moves)
    late_patterns = detect_patterns(late_moves)
    
    # Classify adaptation type
    if len(adaptation_signs) == 0:
        adaptation_type = 'stable'
    elif 'becoming_more_random' in str(adaptation_signs):
        adaptation_type = 'defensive_adaptation'
    elif 'becoming_more_predictable' in str(adaptation_signs):
        adaptation_type = 'settling_pattern'
    elif len(adaptation_signs) >= 2:
        adaptation_type = 'active_adaptation'
    else:
        adaptation_type = 'minor_adjustment'
    
    return {
        'enemy_id': enemy_id,
        'total_moves': len(moves),
        'distributions': {
            'early': early_dist,
            'middle': middle_dist,
            'late': late_dist
        },
        'entropy_evolution': {
            'early': calculate_entropy(early_dist),
            'middle': calculate_entropy(middle_dist),
            'late': calculate_entropy(late_dist),
            'trend': 'increasing' if window_entropies and window_entropies[-1] > window_entropies[0] else 'decreasing'
        },
        'patterns': {
            'early': early_patterns,
            'late': late_patterns
        },
        'adaptation_signs': adaptation_signs,
        'adaptation_type': adaptation_type
    }

def main():
    conn = sqlite3.connect('data/battle-statistics.db')
    cursor = conn.cursor()
    
    print("\n" + "="*80)
    print("COMPREHENSIVE ENEMY PATTERN AND ADAPTATION ANALYSIS")
    print("="*80)
    
    # Get enemies with sufficient data
    cursor.execute("""
        SELECT enemy_id, COUNT(*) as move_count
        FROM enemy_moves_by_turn
        GROUP BY enemy_id
        HAVING move_count >= 15
        ORDER BY move_count DESC
    """)
    
    enemies = cursor.fetchall()
    print(f"\nAnalyzing {len(enemies)} enemies with 15+ recorded moves\n")
    
    # Categorize enemies by adaptation type
    adaptation_categories = defaultdict(list)
    
    for enemy_id, move_count in enemies:
        # Get detailed move history
        cursor.execute("""
            SELECT turn, enemy_move, player_move
            FROM enemy_moves_by_turn
            WHERE enemy_id = ?
            ORDER BY rowid
        """, (enemy_id,))
        
        moves = cursor.fetchall()
        
        # Analyze evolution
        analysis = analyze_enemy_evolution(enemy_id, moves)
        adaptation_categories[analysis['adaptation_type']].append(analysis)
        
        # Print detailed analysis for interesting cases
        if analysis['adaptation_type'] in ['active_adaptation', 'defensive_adaptation']:
            print("="*60)
            print(f"ENEMY {enemy_id} - {move_count} moves - {analysis['adaptation_type'].upper()}")
            print("="*60)
            
            print("\n📊 Strategy Evolution:")
            print("         Rock    Paper   Scissor  Entropy")
            print(f"Early:   {analysis['distributions']['early']['rock']:.1%}    "
                  f"{analysis['distributions']['early']['paper']:.1%}    "
                  f"{analysis['distributions']['early']['scissor']:.1%}     "
                  f"{analysis['entropy_evolution']['early']:.2f}")
            print(f"Middle:  {analysis['distributions']['middle']['rock']:.1%}    "
                  f"{analysis['distributions']['middle']['paper']:.1%}    "
                  f"{analysis['distributions']['middle']['scissor']:.1%}     "
                  f"{analysis['entropy_evolution']['middle']:.2f}")
            print(f"Late:    {analysis['distributions']['late']['rock']:.1%}    "
                  f"{analysis['distributions']['late']['paper']:.1%}    "
                  f"{analysis['distributions']['late']['scissor']:.1%}     "
                  f"{analysis['entropy_evolution']['late']:.2f}")
            
            print(f"\n🔄 Adaptation Signs:")
            for sign in analysis['adaptation_signs']:
                print(f"  • {sign.replace('_', ' ')}")
            
            if analysis['patterns']['early'].get('sequences'):
                print(f"\n📝 Early Patterns:")
                for seq in analysis['patterns']['early']['sequences'][:2]:
                    print(f"  • {seq['pattern']}: {seq['count']} times ({seq['frequency']:.1%})")
            
            if analysis['patterns']['late'].get('sequences'):
                print(f"\n📝 Late Patterns:")
                for seq in analysis['patterns']['late']['sequences'][:2]:
                    print(f"  • {seq['pattern']}: {seq['count']} times ({seq['frequency']:.1%})")
            
            print()
    
    # Print summary
    print("\n" + "="*80)
    print("ADAPTATION TYPE SUMMARY")
    print("="*80)
    
    for adapt_type in ['active_adaptation', 'defensive_adaptation', 'settling_pattern', 'minor_adjustment', 'stable']:
        enemies_list = adaptation_categories.get(adapt_type, [])
        if enemies_list:
            print(f"\n{adapt_type.upper().replace('_', ' ')} ({len(enemies_list)} enemies):")
            
            # Show top examples
            for enemy in sorted(enemies_list, key=lambda x: x['total_moves'], reverse=True)[:3]:
                print(f"  Enemy {enemy['enemy_id']}: {enemy['total_moves']} moves")
                
                # Show key characteristic
                if enemy['adaptation_signs']:
                    print(f"    • {enemy['adaptation_signs'][0].replace('_', ' ')}")
                
                # Show distribution shift
                early_rock = enemy['distributions']['early']['rock']
                late_rock = enemy['distributions']['late']['rock']
                early_paper = enemy['distributions']['early']['paper']
                late_paper = enemy['distributions']['late']['paper']
                early_scissor = enemy['distributions']['early']['scissor']
                late_scissor = enemy['distributions']['late']['scissor']
                
                max_shift_move = None
                max_shift = 0
                
                if abs(late_rock - early_rock) > max_shift:
                    max_shift = abs(late_rock - early_rock)
                    max_shift_move = f"Rock: {early_rock:.0%}→{late_rock:.0%}"
                if abs(late_paper - early_paper) > max_shift:
                    max_shift = abs(late_paper - early_paper)
                    max_shift_move = f"Paper: {early_paper:.0%}→{late_paper:.0%}"
                if abs(late_scissor - early_scissor) > max_shift:
                    max_shift = abs(late_scissor - early_scissor)
                    max_shift_move = f"Scissor: {early_scissor:.0%}→{late_scissor:.0%}"
                
                if max_shift_move and max_shift > 0.1:
                    print(f"    • Biggest shift: {max_shift_move}")
    
    # Overall statistics
    cursor.execute("""
        SELECT 
            COUNT(DISTINCT enemy_id) as unique_enemies,
            COUNT(*) as total_moves,
            AVG(CASE WHEN enemy_move = 'rock' THEN 1 ELSE 0 END) as rock_rate,
            AVG(CASE WHEN enemy_move = 'paper' THEN 1 ELSE 0 END) as paper_rate,
            AVG(CASE WHEN enemy_move = 'scissor' THEN 1 ELSE 0 END) as scissor_rate
        FROM enemy_moves_by_turn
    """)
    
    stats = cursor.fetchone()
    
    print("\n" + "="*80)
    print("OVERALL STATISTICS")
    print("="*80)
    print(f"Unique enemies: {stats[0]}")
    print(f"Total moves analyzed: {stats[1]}")
    print(f"Overall distribution: Rock {stats[2]:.1%}, Paper {stats[3]:.1%}, Scissor {stats[4]:.1%}")
    
    conn.close()

if __name__ == "__main__":
    main()