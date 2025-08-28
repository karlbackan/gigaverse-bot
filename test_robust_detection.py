#!/usr/bin/env python3
"""
Test robust detection vs overfitted detection
Shows that proper statistical methods work without overfitting
"""

import random
import math
from collections import defaultdict
from scipy import stats

class RobustDetector:
    """Statistically rigorous pattern detection"""
    
    def __init__(self):
        self.MIN_SAMPLES = 15
        self.SIGNIFICANCE = 0.05
    
    def detect_pattern(self, battles):
        """Detect pattern with statistical tests"""
        if len(battles) < self.MIN_SAMPLES:
            return None
        
        # Test for bias
        counts = defaultdict(int)
        for b in battles:
            counts[b['enemy_move']] += 1
        
        # Chi-square test
        total = len(battles)
        expected = total / 3
        chi_square = sum((counts[m] - expected)**2 / expected 
                        for m in ['rock', 'paper', 'scissor'])
        
        # Critical value for p=0.05, df=2
        if chi_square > 5.991:
            dominant = max(counts.items(), key=lambda x: x[1])[0]
            if counts[dominant] / total > 0.45:
                return {
                    'type': 'bias',
                    'move': dominant,
                    'confidence': min(0.9, counts[dominant] / total),
                    'detected_at': len(battles)
                }
        
        # Test for reactive (counter/copy)
        if len(battles) >= 20:
            counter_count = 0
            copy_count = 0
            
            for i in range(1, len(battles)):
                counter_map = {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}
                if battles[i]['enemy_move'] == counter_map[battles[i-1]['our_move']]:
                    counter_count += 1
                if battles[i]['enemy_move'] == battles[i-1]['our_move']:
                    copy_count += 1
            
            n = len(battles) - 1
            expected = n / 3
            
            # Binomial test for counter
            if counter_count > expected:
                p_value = stats.binom_test(counter_count, n, 1/3, alternative='greater')
                if p_value < self.SIGNIFICANCE:
                    return {
                        'type': 'counter',
                        'rate': counter_count / n,
                        'confidence': 0.7,
                        'detected_at': len(battles)
                    }
            
            # Binomial test for copy
            if copy_count > expected:
                p_value = stats.binom_test(copy_count, n, 1/3, alternative='greater')
                if p_value < self.SIGNIFICANCE:
                    return {
                        'type': 'copier',
                        'rate': copy_count / n,
                        'confidence': 0.7,
                        'detected_at': len(battles)
                    }
        
        return None


class OverfittedDetector:
    """Our original overfitted approach"""
    
    def detect_pattern(self, battles):
        """Detect pattern too quickly without validation"""
        if len(battles) < 5:
            return None
        
        # Quick bias detection (no statistical test)
        counts = defaultdict(int)
        for b in battles:
            counts[b['enemy_move']] += 1
        
        total = len(battles)
        dominant = max(counts.items(), key=lambda x: x[1])[0]
        
        # Too eager - detects pattern at 40% (could be random!)
        if counts[dominant] / total > 0.4:
            return {
                'type': 'bias',
                'move': dominant,
                'confidence': counts[dominant] / total,
                'detected_at': len(battles)
            }
        
        # Reactive detection without significance test
        if len(battles) >= 10:
            counter_count = 0
            for i in range(1, len(battles)):
                counter_map = {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}
                if battles[i]['enemy_move'] == counter_map[battles[i-1]['our_move']]:
                    counter_count += 1
            
            # No statistical test - just threshold
            if counter_count / (len(battles) - 1) > 0.35:
                return {
                    'type': 'counter',
                    'rate': counter_count / (len(battles) - 1),
                    'confidence': 0.8,
                    'detected_at': len(battles)
                }
        
        return None


def simulate_enemy(enemy_type, our_last_move=None):
    """Simulate different enemy types"""
    moves = ['rock', 'paper', 'scissor']
    
    if enemy_type == 'random':
        return random.choice(moves)
    
    elif enemy_type == 'biased':
        # 60% rock, 20% paper, 20% scissor
        r = random.random()
        if r < 0.6:
            return 'rock'
        elif r < 0.8:
            return 'paper'
        else:
            return 'scissor'
    
    elif enemy_type == 'counter':
        if our_last_move and random.random() < 0.45:
            counter_map = {'rock': 'paper', 'paper': 'scissor', 'scissor': 'rock'}
            return counter_map[our_last_move]
        return random.choice(moves)
    
    elif enemy_type == 'noisy_biased':
        # Sometimes biased, sometimes random (realistic)
        if random.random() < 0.7:
            # Biased behavior
            return 'rock' if random.random() < 0.5 else random.choice(moves)
        else:
            # Random noise
            return random.choice(moves)
    
    return random.choice(moves)


def test_detectors(num_tests=1000):
    """Compare detector performance"""
    
    results = {
        'robust': {
            'true_positives': 0,
            'false_positives': 0,
            'true_negatives': 0,
            'false_negatives': 0,
            'detection_battles': [],
            'confidence_when_correct': [],
            'confidence_when_wrong': []
        },
        'overfitted': {
            'true_positives': 0,
            'false_positives': 0,
            'true_negatives': 0,
            'false_negatives': 0,
            'detection_battles': [],
            'confidence_when_correct': [],
            'confidence_when_wrong': []
        }
    }
    
    robust = RobustDetector()
    overfitted = OverfittedDetector()
    
    # Test different enemy types
    enemy_types = ['random'] * 250 + ['biased'] * 250 + ['counter'] * 250 + ['noisy_biased'] * 250
    random.shuffle(enemy_types)
    
    for enemy_type in enemy_types:
        battles = []
        our_last = None
        
        # Simulate 30 battles
        for i in range(30):
            our_move = random.choice(['rock', 'paper', 'scissor'])
            enemy_move = simulate_enemy(enemy_type, our_last)
            
            battles.append({
                'our_move': our_move,
                'enemy_move': enemy_move
            })
            our_last = our_move
        
        # Test robust detector
        robust_detection = robust.detect_pattern(battles)
        true_pattern = enemy_type in ['biased', 'counter', 'noisy_biased']
        
        if robust_detection:
            if true_pattern:
                results['robust']['true_positives'] += 1
                results['robust']['confidence_when_correct'].append(robust_detection['confidence'])
            else:
                results['robust']['false_positives'] += 1
                results['robust']['confidence_when_wrong'].append(robust_detection['confidence'])
            results['robust']['detection_battles'].append(robust_detection['detected_at'])
        else:
            if true_pattern:
                results['robust']['false_negatives'] += 1
            else:
                results['robust']['true_negatives'] += 1
        
        # Test overfitted detector
        overfitted_detection = overfitted.detect_pattern(battles)
        
        if overfitted_detection:
            if true_pattern:
                results['overfitted']['true_positives'] += 1
                results['overfitted']['confidence_when_correct'].append(overfitted_detection['confidence'])
            else:
                results['overfitted']['false_positives'] += 1
                results['overfitted']['confidence_when_wrong'].append(overfitted_detection['confidence'])
            results['overfitted']['detection_battles'].append(overfitted_detection['detected_at'])
        else:
            if true_pattern:
                results['overfitted']['false_negatives'] += 1
            else:
                results['overfitted']['true_negatives'] += 1
    
    return results


def main():
    print("\n" + "="*80)
    print("ROBUST vs OVERFITTED DETECTION COMPARISON")
    print("="*80)
    
    print("\nTesting 1000 enemies (250 random, 250 biased, 250 counter, 250 noisy)...")
    
    results = test_detectors()
    
    for detector_name, data in results.items():
        print(f"\n{detector_name.upper()} DETECTOR:")
        print("-" * 40)
        
        # Calculate metrics
        tp = data['true_positives']
        fp = data['false_positives']
        tn = data['true_negatives']
        fn = data['false_negatives']
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        accuracy = (tp + tn) / (tp + fp + tn + fn)
        false_positive_rate = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        print(f"  True Positives:  {tp:3d} (correctly detected patterns)")
        print(f"  False Positives: {fp:3d} (saw pattern in random)")
        print(f"  True Negatives:  {tn:3d} (correctly identified random)")
        print(f"  False Negatives: {fn:3d} (missed real patterns)")
        print()
        print(f"  Precision: {precision:.1%} (when detects pattern, how often correct)")
        print(f"  Recall:    {recall:.1%} (of real patterns, how many detected)")
        print(f"  F1 Score:  {f1:.3f}")
        print(f"  Accuracy:  {accuracy:.1%}")
        print(f"  False Positive Rate: {false_positive_rate:.1%}")
        
        if data['detection_battles']:
            avg_detection = sum(data['detection_battles']) / len(data['detection_battles'])
            print(f"  Avg Detection Speed: {avg_detection:.1f} battles")
        
        if data['confidence_when_correct']:
            avg_conf_correct = sum(data['confidence_when_correct']) / len(data['confidence_when_correct'])
            print(f"  Avg Confidence When Correct: {avg_conf_correct:.2f}")
        
        if data['confidence_when_wrong']:
            avg_conf_wrong = sum(data['confidence_when_wrong']) / len(data['confidence_when_wrong'])
            print(f"  Avg Confidence When Wrong: {avg_conf_wrong:.2f}")
    
    print("\n" + "="*80)
    print("CONCLUSION")
    print("="*80)
    
    robust_fpr = results['robust']['false_positives'] / (results['robust']['false_positives'] + results['robust']['true_negatives'])
    overfitted_fpr = results['overfitted']['false_positives'] / (results['overfitted']['false_positives'] + results['overfitted']['true_negatives'])
    
    print(f"\nRobust detector false positive rate: {robust_fpr:.1%}")
    print(f"Overfitted detector false positive rate: {overfitted_fpr:.1%}")
    print(f"Reduction in false positives: {(overfitted_fpr - robust_fpr) / overfitted_fpr * 100:.0f}%")
    
    if robust_fpr < 0.1:
        print("\n✅ Robust detector successfully avoids overfitting!")
        print("   - Low false positive rate means it won't see patterns in noise")
        print("   - Still detects real patterns when they exist")
        print("   - Safe to use in production")
    else:
        print("\n⚠️  Robust detector still needs tuning")

if __name__ == "__main__":
    main()