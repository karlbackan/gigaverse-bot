#!/usr/bin/env python3
"""
Comprehensive analysis of enemy behavior patterns and adaptation over time
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
    return entropy / math.log2(3)  # Normalize to 0-1 for RPS

def get_distribution(moves: List[str]) -> Dict[str, float]:
    """Get probability distribution of moves"""
    if not moves:
        return {'rock': 0.333, 'paper': 0.333, 'scissor': 0.334}
    
    counter = Counter(moves)
    total = len(moves)
    return {
        'rock': counter.get('rock', 0) / total,
        'paper': counter.get('paper', 0) / total,
        'scissor': counter.get('scissor', 0) / total
    }

def detect_reaction_patterns(battles: List[Tuple]) -> Dict:
    """Detect if enemy is reacting to our moves"""
    if len(battles) < 10:
        return {'reactive': False, 'patterns': []}
    
    patterns = []
    
    # Check if enemy counters our previous move
    counter_reactions = 0
    copy_reactions = 0
    
    for i in range(1, len(battles)):
        our_prev = battles[i-1][1]  # Our previous move
        enemy_curr = battles[i][2]  # Enemy's current move
        
        # Check if enemy plays counter to our previous
        counter = {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}
        if enemy_curr == counter[our_prev]:
            counter_reactions += 1
        
        # Check if enemy copies our previous
        if enemy_curr == our_prev:
            copy_reactions += 1
    
    reaction_rate = counter_reactions / (len(battles) - 1)
    copy_rate = copy_reactions / (len(battles) - 1)
    
    if reaction_rate > 0.4:
        patterns.append(f'counters_our_moves_{reaction_rate:.1%}')
    if copy_rate > 0.4:
        patterns.append(f'copies_our_moves_{copy_rate:.1%}')
    
    # Check if enemy reacts to losses
    loss_reactions = defaultdict(int)
    total_losses = 0
    
    for i in range(1, len(battles)):
        if battles[i-1][3] == 'loss':  # Enemy lost previous
            total_losses += 1
            enemy_prev = battles[i-1][2]
            enemy_curr = battles[i][2]
            
            if enemy_curr == counter[enemy_prev]:
                loss_reactions['switches_to_counter'] += 1
            elif enemy_curr == enemy_prev:
                loss_reactions['repeats_move'] += 1
            else:
                loss_reactions['random_switch'] += 1
    
    if total_losses > 5:
        for reaction, count in loss_reactions.items():
            rate = count / total_losses
            if rate > 0.4:
                patterns.append(f'after_loss_{reaction}_{rate:.1%}')
    
    return {
        'reactive': len(patterns) > 0,
        'patterns': patterns,
        'counter_rate': reaction_rate,
        'copy_rate': copy_rate
    }

def analyze_enemy_adaptation(enemy_id: int, battles: List[Tuple]) -> Dict:
    """Deep analysis of how an enemy adapts over time"""
    
    if len(battles) < 15:
        return {
            'enemy_id': enemy_id,
            'status': 'insufficient_data',
            'total_battles': len(battles)
        }
    
    # Extract move sequences
    enemy_moves = [b[2] for b in battles]  # enemy_move column
    our_moves = [b[1] for b in battles]    # player_move column
    results = [b[3] for b in battles]      # result column
    
    # Split into time periods
    period_size = max(10, len(battles) // 4)
    periods = []
    for i in range(0, len(battles), period_size):
        period_battles = battles[i:i+period_size]
        if period_battles:
            periods.append({
                'battles': period_battles,
                'enemy_moves': [b[2] for b in period_battles],
                'our_moves': [b[1] for b in period_battles],
                'results': [b[3] for b in period_battles]
            })
    
    # Analyze each period
    period_analyses = []
    for i, period in enumerate(periods):
        dist = get_distribution(period['enemy_moves'])
        entropy = calculate_entropy(dist)
        
        # Win rate from enemy perspective
        enemy_wins = period['results'].count('loss')  # Our loss = enemy win
        win_rate = enemy_wins / len(period['results']) if period['results'] else 0
        
        period_analyses.append({
            'period': i + 1,
            'distribution': dist,
            'entropy': entropy,
            'win_rate': win_rate,
            'dominant_move': max(dist.items(), key=lambda x: x[1])[0],
            'battles': len(period['battles'])
        })
    
    # Detect adaptation patterns
    adaptation_signs = []
    
    if len(period_analyses) >= 2:
        # Check for distribution changes
        first_dist = period_analyses[0]['distribution']
        last_dist = period_analyses[-1]['distribution']
        
        for move in ['rock', 'paper', 'scissor']:
            change = last_dist[move] - first_dist[move]
            if abs(change) > 0.15:
                direction = "increased" if change > 0 else "decreased"
                adaptation_signs.append(f'{move}_{direction}_{abs(change):.1%}')
        
        # Check entropy trend
        entropy_change = period_analyses[-1]['entropy'] - period_analyses[0]['entropy']
        if entropy_change > 0.15:
            adaptation_signs.append('becoming_unpredictable')
        elif entropy_change < -0.15:
            adaptation_signs.append('becoming_predictable')
        
        # Check win rate trend
        win_rate_change = period_analyses[-1]['win_rate'] - period_analyses[0]['win_rate']
        if win_rate_change > 0.15:
            adaptation_signs.append('improving_performance')
        elif win_rate_change < -0.15:
            adaptation_signs.append('declining_performance')
        
        # Check for strategy shifts
        if period_analyses[0]['dominant_move'] != period_analyses[-1]['dominant_move']:
            adaptation_signs.append(f"shifted_from_{period_analyses[0]['dominant_move']}_to_{period_analyses[-1]['dominant_move']}")
    
    # Check for reactive patterns
    reaction_analysis = detect_reaction_patterns(battles)
    
    # Classify adaptation type
    adaptation_type = 'stable'
    if reaction_analysis['reactive']:
        adaptation_type = 'reactive'
    elif 'becoming_unpredictable' in str(adaptation_signs):
        adaptation_type = 'defensive_randomization'
    elif 'improving_performance' in str(adaptation_signs) and len(adaptation_signs) >= 2:
        adaptation_type = 'learning'
    elif len(adaptation_signs) >= 3:
        adaptation_type = 'actively_adapting'
    elif len(adaptation_signs) >= 1:
        adaptation_type = 'gradually_shifting'
    
    return {
        'enemy_id': enemy_id,
        'total_battles': len(battles),
        'periods': period_analyses,
        'adaptation_signs': adaptation_signs,
        'adaptation_type': adaptation_type,
        'reactive_patterns': reaction_analysis['patterns'],
        'counter_rate': reaction_analysis['counter_rate'],
        'copy_rate': reaction_analysis['copy_rate']
    }

def main():
    conn = sqlite3.connect('data/battle-statistics.db')
    cursor = conn.cursor()
    
    print("\n" + "="*80)
    print("ENEMY BEHAVIOR AND ADAPTATION ANALYSIS")
    print("="*80)
    
    # Get enemies with sufficient battle history
    cursor.execute("""
        SELECT enemy_id, COUNT(*) as battle_count
        FROM battles
        GROUP BY enemy_id
        HAVING battle_count >= 15
        ORDER BY battle_count DESC
    """)
    
    enemies = cursor.fetchall()
    print(f"\nAnalyzing {len(enemies)} enemies with 15+ battles\n")
    
    # Store analyses
    all_analyses = []
    adaptation_types = defaultdict(list)
    
    for enemy_id, battle_count in enemies:
        # Get battle history
        cursor.execute("""
            SELECT turn, player_move, enemy_move, result
            FROM battles
            WHERE enemy_id = ?
            ORDER BY id
        """, (enemy_id,))
        
        battles = cursor.fetchall()
        
        # Analyze adaptation
        analysis = analyze_enemy_adaptation(enemy_id, battles)
        all_analyses.append(analysis)
        adaptation_types[analysis['adaptation_type']].append(analysis)
    
    # Print detailed analyses for interesting enemies
    interesting_types = ['reactive', 'learning', 'actively_adapting', 'defensive_randomization']
    
    for adapt_type in interesting_types:
        if adapt_type in adaptation_types and adaptation_types[adapt_type]:
            print("\n" + "="*70)
            print(f"{adapt_type.upper().replace('_', ' ')} ENEMIES")
            print("="*70)
            
            # Show top 3 examples
            for analysis in sorted(adaptation_types[adapt_type], 
                                 key=lambda x: x['total_battles'], 
                                 reverse=True)[:3]:
                
                print(f"\n📊 Enemy {analysis['enemy_id']} ({analysis['total_battles']} battles)")
                
                # Show period evolution
                if analysis['periods']:
                    print("\n  Period |  Rock  | Paper | Scissor | Entropy | Win Rate")
                    print("  -------|--------|-------|---------|---------|----------")
                    for p in analysis['periods']:
                        print(f"    {p['period']:2d}    | {p['distribution']['rock']:5.1%} | "
                              f"{p['distribution']['paper']:5.1%} | {p['distribution']['scissor']:7.1%} | "
                              f"{p['entropy']:7.2f} | {p['win_rate']:8.1%}")
                
                # Show key patterns
                if analysis['adaptation_signs']:
                    print("\n  🔄 Adaptation Signs:")
                    for sign in analysis['adaptation_signs'][:3]:
                        print(f"    • {sign.replace('_', ' ')}")
                
                if analysis['reactive_patterns']:
                    print("\n  ⚡ Reactive Patterns:")
                    for pattern in analysis['reactive_patterns'][:2]:
                        print(f"    • {pattern.replace('_', ' ')}")
    
    # Print summary statistics
    print("\n" + "="*80)
    print("ADAPTATION TYPE SUMMARY")
    print("="*80)
    
    for adapt_type, enemies_list in sorted(adaptation_types.items(), 
                                          key=lambda x: len(x[1]), 
                                          reverse=True):
        if enemies_list:
            avg_battles = sum(e['total_battles'] for e in enemies_list) / len(enemies_list)
            print(f"\n{adapt_type.upper().replace('_', ' ')}: {len(enemies_list)} enemies "
                  f"(avg {avg_battles:.0f} battles)")
            
            # Show characteristics
            if adapt_type == 'reactive':
                avg_counter = sum(e['counter_rate'] for e in enemies_list) / len(enemies_list)
                print(f"  • Average counter rate: {avg_counter:.1%}")
            
            # Show top enemy
            top_enemy = max(enemies_list, key=lambda x: x['total_battles'])
            print(f"  • Most data: Enemy {top_enemy['enemy_id']} ({top_enemy['total_battles']} battles)")
            
            if top_enemy['adaptation_signs']:
                print(f"    - {top_enemy['adaptation_signs'][0].replace('_', ' ')}")
    
    # Overall meta-analysis
    print("\n" + "="*80)
    print("META-ANALYSIS: How Enemies Adapt")
    print("="*80)
    
    # Count specific adaptation patterns
    pattern_counts = defaultdict(int)
    for analysis in all_analyses:
        for sign in analysis['adaptation_signs']:
            if 'increased' in sign or 'decreased' in sign:
                move = sign.split('_')[0]
                direction = 'increased' if 'increased' in sign else 'decreased'
                pattern_counts[f'{move}_{direction}'] += 1
        
        for pattern in analysis['reactive_patterns']:
            if 'counters_our_moves' in pattern:
                pattern_counts['reactive_counter'] += 1
            if 'copies_our_moves' in pattern:
                pattern_counts['reactive_copy'] += 1
    
    print("\nMost Common Adaptation Patterns:")
    for pattern, count in sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
        percentage = (count / len(all_analyses)) * 100
        print(f"  • {pattern.replace('_', ' ')}: {count} enemies ({percentage:.0f}%)")
    
    # Performance correlation
    improving = len([a for a in all_analyses if 'improving_performance' in str(a['adaptation_signs'])])
    declining = len([a for a in all_analyses if 'declining_performance' in str(a['adaptation_signs'])])
    
    print(f"\nPerformance Trends:")
    print(f"  • Improving over time: {improving} enemies ({improving/len(all_analyses)*100:.0f}%)")
    print(f"  • Declining over time: {declining} enemies ({declining/len(all_analyses)*100:.0f}%)")
    print(f"  • Stable performance: {len(all_analyses)-improving-declining} enemies")
    
    conn.close()

if __name__ == "__main__":
    main()