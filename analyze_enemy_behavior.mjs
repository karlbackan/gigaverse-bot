#!/usr/bin/env node
/**
 * Analyze raw enemy behavior patterns
 */

import { OptimizedDatabaseStatisticsEngine } from './src/database-statistics-engine-optimized.mjs';

async function analyzeEnemyBehavior() {
    console.log('=' .repeat(70));
    console.log('ENEMY BEHAVIOR ANALYSIS');
    console.log('=' .repeat(70));
    
    const engine = new OptimizedDatabaseStatisticsEngine('./data/battle-statistics.db');
    
    try {
        await engine.initializeAsync();
        
        // Get enemies with sufficient data
        const enemies = await engine.db.all(`
            SELECT enemy_id, COUNT(*) as battle_count
            FROM battles
            GROUP BY enemy_id
            HAVING battle_count >= 50
            ORDER BY battle_count DESC
            LIMIT 10
        `, []);
        
        console.log(`\nAnalyzing ${enemies.length} enemies with 50+ battles:\n`);
        
        for (const enemy of enemies) {
            console.log(`\nEnemy ${enemy.enemy_id} (${enemy.battle_count} battles):`);
            console.log('-'.repeat(50));
            
            const battles = await engine.getBattleHistory(enemy.enemy_id, 200);
            
            if (!battles || battles.length === 0) continue;
            
            // 1. Overall distribution
            const counts = { rock: 0, paper: 0, scissor: 0 };
            battles.forEach(b => counts[b.enemyMove]++);
            const total = battles.length;
            
            console.log('\n📊 Overall distribution:');
            console.log(`  Rock:    ${counts.rock}/${total} (${(counts.rock/total*100).toFixed(1)}%)`);
            console.log(`  Paper:   ${counts.paper}/${total} (${(counts.paper/total*100).toFixed(1)}%)`);
            console.log(`  Scissor: ${counts.scissor}/${total} (${(counts.scissor/total*100).toFixed(1)}%)`);
            
            // 2. Check for bias
            const maxProb = Math.max(counts.rock, counts.paper, counts.scissor) / total;
            if (maxProb > 0.4) {
                console.log(`  ⚠️ BIAS DETECTED: ${maxProb > 0.5 ? 'STRONG' : 'MODERATE'}`);
            }
            
            // 3. Check for patterns over time
            console.log('\n📈 Pattern evolution (every 20 battles):');
            for (let i = 0; i < battles.length; i += 20) {
                const window = battles.slice(i, Math.min(i + 20, battles.length));
                const windowCounts = { rock: 0, paper: 0, scissor: 0 };
                window.forEach(b => windowCounts[b.enemyMove]++);
                const windowTotal = window.length;
                
                const dominant = Object.entries(windowCounts)
                    .sort((a, b) => b[1] - a[1])[0];
                
                console.log(`  Battles ${i+1}-${i+windowTotal}: ${dominant[0]} (${(dominant[1]/windowTotal*100).toFixed(0)}%)`);
            }
            
            // 4. Check for response patterns
            const responses = { 
                afterWin: { rock: 0, paper: 0, scissor: 0, total: 0 },
                afterLoss: { rock: 0, paper: 0, scissor: 0, total: 0 },
                afterTie: { rock: 0, paper: 0, scissor: 0, total: 0 }
            };
            
            for (let i = 1; i < battles.length; i++) {
                const prevResult = battles[i-1].result;
                const currentMove = battles[i].enemyMove;
                
                if (prevResult === 'win') {
                    // Enemy lost
                    responses.afterLoss[currentMove]++;
                    responses.afterLoss.total++;
                } else if (prevResult === 'loss') {
                    // Enemy won
                    responses.afterWin[currentMove]++;
                    responses.afterWin.total++;
                } else {
                    responses.afterTie[currentMove]++;
                    responses.afterTie.total++;
                }
            }
            
            console.log('\n🎮 Response patterns:');
            
            if (responses.afterWin.total > 5) {
                const afterWinDominant = Object.entries(responses.afterWin)
                    .filter(([k, v]) => k !== 'total')
                    .sort((a, b) => b[1] - a[1])[0];
                console.log(`  After winning: ${afterWinDominant[0]} (${(afterWinDominant[1]/responses.afterWin.total*100).toFixed(0)}%)`);
            }
            
            if (responses.afterLoss.total > 5) {
                const afterLossDominant = Object.entries(responses.afterLoss)
                    .filter(([k, v]) => k !== 'total')
                    .sort((a, b) => b[1] - a[1])[0];
                console.log(`  After losing:  ${afterLossDominant[0]} (${(afterLossDominant[1]/responses.afterLoss.total*100).toFixed(0)}%)`);
            }
            
            // 5. Check for counter patterns
            let counterCount = 0;
            let copyCount = 0;
            const counters = { rock: 'paper', paper: 'scissor', scissor: 'rock' };
            
            for (let i = 1; i < battles.length; i++) {
                const ourPrevious = battles[i-1].ourMove;
                const theirCurrent = battles[i].enemyMove;
                
                if (counters[ourPrevious] === theirCurrent) {
                    counterCount++;
                }
                if (ourPrevious === theirCurrent) {
                    copyCount++;
                }
            }
            
            const counterRate = counterCount / (battles.length - 1);
            const copyRate = copyCount / (battles.length - 1);
            
            console.log('\n🔄 Special patterns:');
            if (counterRate > 0.4) {
                console.log(`  ⚠️ COUNTER PATTERN: ${(counterRate*100).toFixed(0)}% of the time`);
            }
            if (copyRate > 0.4) {
                console.log(`  ⚠️ COPY PATTERN: ${(copyRate*100).toFixed(0)}% of the time`);
            }
            
            // 6. Win/loss statistics
            const results = { win: 0, loss: 0, tie: 0 };
            battles.forEach(b => results[b.result]++);
            
            console.log('\n📊 Battle outcomes:');
            console.log(`  Our wins:   ${results.win}/${total} (${(results.win/total*100).toFixed(1)}%)`);
            console.log(`  Our losses: ${results.loss}/${total} (${(results.loss/total*100).toFixed(1)}%)`);
            console.log(`  Ties:       ${results.tie}/${total} (${(results.tie/total*100).toFixed(1)}%)`);
            
            const winRate = results.win / total;
            if (winRate < 0.3) {
                console.log('  ❌ LOSING BADLY - Need better strategy!');
            } else if (winRate > 0.4) {
                console.log('  ✅ WINNING - Current strategy working!');
            }
        }
        
        await engine.close();
        console.log('\n✅ Analysis complete!');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        await engine.close();
    }
}

analyzeEnemyBehavior().catch(console.error);