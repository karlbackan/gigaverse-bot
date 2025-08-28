#!/usr/bin/env python3
"""
Analyze enemy adaptation patterns over time
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

def analyze_adaptation(moves: List[Tuple[int, str]]) -> Dict:
    """Analyze how an enemy's strategy has adapted over time"""
    if len(moves) < 10:
        return {'status': 'insufficient_data', 'battles': len(moves)}
    
    # Split into time periods
    total_battles = len(moves)
    period_size = max(10, total_battles // 5)  # At least 10 battles per period
    
    periods = []
    for i in range(0, total_battles, period_size):
        period_moves = [m[1] for m in moves[i:i+period_size]]
        if period_moves:
            periods.append(period_moves)
    
    # Calculate distributions for each period
    distributions = [get_distribution(period) for period in periods]
    
    # Calculate entropy for each period
    entropies = [calculate_entropy(dist) for dist in distributions]
    
    # Detect patterns
    analysis = {
        'total_battles': total_battles,
        'periods_analyzed': len(periods),
        'distributions': distributions,
        'entropies': entropies,
        'patterns': []
    }
    
    # Check for convergence to uniform (Nash equilibrium)
    latest_dist = distributions[-1] if distributions else {}
    deviation = sum(abs(latest_dist.get(m, 0) - 0.333) for m in ['rock', 'paper', 'scissor'])
    if deviation < 0.1:
        analysis['patterns'].append('converging_to_nash')
    
    # Check for increasing randomness
    if len(entropies) >= 3:
        if entropies[-1] > entropies[0] + 0.2:
            analysis['patterns'].append('increasing_randomness')
        elif entropies[-1] < entropies[0] - 0.2:
            analysis['patterns'].append('becoming_predictable')
    
    # Check for strategy shifts
    if len(distributions) >= 2:
        for i in range(1, len(distributions)):
            prev = distributions[i-1]
            curr = distributions[i]
            
            # Find biggest change
            max_change = 0
            changed_move = None
            for move in ['rock', 'paper', 'scissor']:
                change = abs(curr.get(move, 0) - prev.get(move, 0))
                if change > max_change:
                    max_change = change
                    changed_move = move
            
            if max_change > 0.2:
                direction = "increased" if curr.get(changed_move, 0) > prev.get(changed_move, 0) else "decreased"
                analysis['patterns'].append(f'period_{i}: {changed_move}_{direction}_by_{max_change:.1%}')
    
    # Check for cycling patterns
    if len(periods) >= 3:
        # Look for rock->paper->scissor cycles
        dominant_per_period = []
        for period in periods:
            counter = Counter(period)
            dominant = counter.most_common(1)[0][0] if counter else None
            dominant_per_period.append(dominant)
        
        # Check if following RPS cycle
        cycle = {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}
        cycling = 0
        for i in range(1, len(dominant_per_period)):
            if dominant_per_period[i] == cycle.get(dominant_per_period[i-1]):
                cycling += 1
        
        if cycling >= len(dominant_per_period) * 0.5:
            analysis['patterns'].append('cycling_strategy')
    
    # Determine adaptation type
    if 'converging_to_nash' in str(analysis['patterns']):
        analysis['adaptation_type'] = 'nash_convergence'
    elif 'cycling_strategy' in str(analysis['patterns']):
        analysis['adaptation_type'] = 'cycling'
    elif 'increasing_randomness' in str(analysis['patterns']):
        analysis['adaptation_type'] = 'adaptive_randomization'
    elif 'becoming_predictable' in str(analysis['patterns']):
        analysis['adaptation_type'] = 'settling_into_pattern'
    elif len(analysis['patterns']) > 2:
        analysis['adaptation_type'] = 'actively_adapting'
    else:
        analysis['adaptation_type'] = 'stable'
    
    return analysis

def main():
    # Connect to database
    conn = sqlite3.connect('data/battle-statistics.db')
    cursor = conn.cursor()
    
    # Get all enemies with significant battle history
    cursor.execute("""
        SELECT enemy_id, COUNT(*) as battle_count 
        FROM enemy_moves 
        GROUP BY enemy_id 
        HAVING battle_count >= 20
        ORDER BY battle_count DESC
    """)
    
    enemies = cursor.fetchall()
    print(f"\n{'='*80}")
    print(f"ENEMY ADAPTATION ANALYSIS - Analyzing {len(enemies)} enemies with 20+ battles")
    print(f"{'='*80}\n")
    
    adaptation_summary = defaultdict(list)
    
    for enemy_id, battle_count in enemies:
        # Get move history for this enemy
        cursor.execute("""
            SELECT turn, move 
            FROM enemy_moves 
            WHERE enemy_id = ?
            ORDER BY rowid
        """, (enemy_id,))
        
        moves = cursor.fetchall()
        
        # Analyze adaptation
        analysis = analyze_adaptation(moves)
        
        # Store summary
        adaptation_summary[analysis.get('adaptation_type', 'unknown')].append({
            'enemy_id': enemy_id,
            'battles': battle_count,
            'analysis': analysis
        })
        
        # Print detailed analysis for interesting cases
        if analysis.get('adaptation_type') in ['actively_adapting', 'cycling', 'adaptive_randomization', 'nash_convergence']:
            print(f"\n{'='*60}")
            print(f"Enemy {enemy_id} - {battle_count} battles - {analysis['adaptation_type'].upper()}")
            print(f"{'='*60}")
            
            if analysis.get('distributions'):
                print("\n📊 Move Distribution Evolution:")
                for i, dist in enumerate(analysis['distributions']):
                    period_start = i * (battle_count // len(analysis['distributions']))
                    period_end = min((i + 1) * (battle_count // len(analysis['distributions'])), battle_count)
                    print(f"  Period {i+1} (battles {period_start}-{period_end}):")
                    print(f"    Rock:    {dist.get('rock', 0):.1%}")
                    print(f"    Paper:   {dist.get('paper', 0):.1%}")
                    print(f"    Scissor: {dist.get('scissor', 0):.1%}")
                    if i < len(analysis.get('entropies', [])):
                        print(f"    Entropy: {analysis['entropies'][i]:.2f}")
            
            if analysis.get('patterns'):
                print("\n🔄 Detected Patterns:")
                for pattern in analysis['patterns']:
                    print(f"  • {pattern}")
    
    # Print summary
    print(f"\n{'='*80}")
    print("ADAPTATION TYPE SUMMARY")
    print(f"{'='*80}\n")
    
    for adapt_type, enemies_list in adaptation_summary.items():
        print(f"\n{adapt_type.upper().replace('_', ' ')} ({len(enemies_list)} enemies):")
        for enemy_data in sorted(enemies_list, key=lambda x: x['battles'], reverse=True)[:5]:
            print(f"  • Enemy {enemy_data['enemy_id']}: {enemy_data['battles']} battles")
            if enemy_data['analysis'].get('patterns'):
                for pattern in enemy_data['analysis']['patterns'][:2]:
                    print(f"      - {pattern}")
    
    # Calculate overall statistics
    cursor.execute("""
        SELECT 
            AVG(CASE WHEN move = 'rock' THEN 1 ELSE 0 END) as rock_rate,
            AVG(CASE WHEN move = 'paper' THEN 1 ELSE 0 END) as paper_rate,
            AVG(CASE WHEN move = 'scissor' THEN 1 ELSE 0 END) as scissor_rate,
            COUNT(*) as total_moves
        FROM enemy_moves
    """)
    
    overall_stats = cursor.fetchone()
    
    print(f"\n{'='*80}")
    print("OVERALL ENEMY STATISTICS")
    print(f"{'='*80}\n")
    print(f"Total moves analyzed: {overall_stats[3]}")
    print(f"Overall distribution:")
    print(f"  Rock:    {overall_stats[0]:.1%}")
    print(f"  Paper:   {overall_stats[1]:.1%}")
    print(f"  Scissor: {overall_stats[2]:.1%}")
    
    # Check for meta-trends
    cursor.execute("""
        SELECT move, COUNT(*) as count
        FROM (
            SELECT move, rowid 
            FROM enemy_moves 
            ORDER BY rowid DESC 
            LIMIT 1000
        )
        GROUP BY move
    """)
    
    recent_moves = cursor.fetchall()
    recent_total = sum(count for _, count in recent_moves)
    
    print(f"\nRecent 1000 moves distribution:")
    for move, count in recent_moves:
        print(f"  {move.capitalize():8} {count/recent_total:.1%}")
    
    conn.close()

if __name__ == "__main__":
    main()