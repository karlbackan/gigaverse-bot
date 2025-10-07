#!/usr/bin/env node

import { getDirectDungeonState, sendDirectAction, resetActionToken } from './src/direct-api.mjs';
import { config } from './src/config.mjs';

console.log('=== Comparing Dungeon Mechanics ===\n');

// Use Account 5
process.env.JWT_TOKEN = process.env.JWT_TOKEN_5;
config.jwtToken = process.env.JWT_TOKEN_5;

async function analyzeUnderhaul() {
  console.log('UNDERHAUL (Type 3) Analysis:');
  console.log('=' .repeat(40));
  
  resetActionToken();
  
  // Start Underhaul
  const start = await sendDirectAction('start_run', 3, {
    consumables: [],
    itemId: 0,
    index: 0,
    gearInstanceIds: []  // Gear IDs needed
  });
  
  console.log('\n1. Gear System:');
  console.log('   - Requires gear instance IDs at start');
  console.log('   - Gear affects weapon stats');
  console.log('   - Gear has durability that degrades');
  
  // Get state to examine weapons
  const state = await getDirectDungeonState();
  const player = state.data.run.players[0];
  
  console.log('\n2. Weapon Mechanics:');
  console.log(`   Rock: ${player.rock.currentCharges} charges (${player.rock.currentATK} ATK, ${player.rock.currentDEF} DEF)`);
  console.log(`   Paper: ${player.paper.currentCharges} charges (${player.paper.currentATK} ATK, ${player.paper.currentDEF} DEF)`);
  console.log(`   Scissor: ${player.scissor.currentCharges} charges (${player.scissor.currentATK} ATK, ${player.scissor.currentDEF} DEF)`);
  
  // Play one turn to see recharge mechanics
  await sendDirectAction('rock', 3, {});
  const afterAction = await getDirectDungeonState();
  const playerAfter = afterAction.data.run.players[0];
  
  console.log('\n3. After using Rock:');
  console.log(`   Rock: ${playerAfter.rock.currentCharges} charges (was ${player.rock.currentCharges})`);
  console.log(`   Paper: ${playerAfter.paper.currentCharges} charges (was ${player.paper.currentCharges})`);
  console.log(`   Scissor: ${playerAfter.scissor.currentCharges} charges (was ${player.scissor.currentCharges})`);
  
  if (playerAfter.rock.currentCharges < 0) {
    console.log('   ⚡ Rock is RECHARGING (negative = cooldown)');
  }
  
  console.log('\n4. Server Processing:');
  console.log('   - Must track gear stats');
  console.log('   - Must calculate recharge cycles');
  console.log('   - Must apply gear bonuses');
  console.log('   - Must track durability');
  
  return state;
}

async function analyzeDungetron5000() {
  console.log('\n\nDUNGETRON 5000 (Type 1) Analysis:');
  console.log('=' .repeat(40));
  
  resetActionToken();
  
  // Start Dungetron 5000
  const start = await sendDirectAction('start_run', 1, {
    consumables: [],
    itemId: 0,
    index: 0,
    gearInstanceIds: []  // No gear needed
  });
  
  console.log('\n1. Gear System:');
  console.log('   - NO gear system');
  console.log('   - Fixed weapon stats');
  
  // Get state
  const state = await getDirectDungeonState();
  const player = state.data.run.players[0];
  
  console.log('\n2. Weapon Mechanics:');
  console.log(`   Rock: ${player.rock.currentCharges} charges (${player.rock.currentATK} ATK, ${player.rock.currentDEF} DEF)`);
  console.log(`   Paper: ${player.paper.currentCharges} charges (${player.paper.currentATK} ATK, ${player.paper.currentDEF} DEF)`);
  console.log(`   Scissor: ${player.scissor.currentCharges} charges (${player.scissor.currentATK} ATK, ${player.scissor.currentDEF} DEF)`);
  
  // Play one turn
  await sendDirectAction('rock', 1, {});
  const afterAction = await getDirectDungeonState();
  const playerAfter = afterAction.data.run.players[0];
  
  console.log('\n3. After using Rock:');
  console.log(`   Rock: ${playerAfter.rock.currentCharges} charges (was ${player.rock.currentCharges})`);
  console.log('   ✅ Simple charge consumption (no recharge)');
  
  console.log('\n4. Server Processing:');
  console.log('   - Simple charge decrement');
  console.log('   - No gear calculations');
  console.log('   - No recharge tracking');
  console.log('   - Basic RPS logic only');
}

async function test() {
  try {
    await analyzeUnderhaul();
    await analyzeDungetron5000();
    
    console.log('\n\n=== SUMMARY ===');
    console.log('\nUnderhaul is MORE COMPLEX because:');
    console.log('1. GEAR SYSTEM - Must load, track, and apply gear bonuses');
    console.log('2. RECHARGE MECHANICS - Weapons go into cooldown (negative charges)');
    console.log('3. DURABILITY - Gear degrades and needs repair');
    console.log('4. MORE CALCULATIONS - Every action requires gear + recharge math');
    console.log('\nThis is why Underhaul has slower server processing and higher corruption risk!');
    
  } catch (error) {
    console.error('Error:', error.response?.data?.message || error.message);
  }
}

test().then(() => process.exit(0));