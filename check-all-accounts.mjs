#!/usr/bin/env node

import { config } from './src/config.mjs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

console.log('=== COMPREHENSIVE API INVESTIGATION FOR ALL ACCOUNTS ===\n');

const accounts = [
  { name: 'Account 1', token: process.env.JWT_TOKEN_1, address: '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0' },
  { name: 'Account 2', token: process.env.JWT_TOKEN_2, address: '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816' },
  { name: 'Account 3', token: process.env.JWT_TOKEN_3, address: '0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963' },
  { name: 'Account 4', token: process.env.JWT_TOKEN_4, address: '0x2153433D4c13f72b5b10af5dDF5fC93866Eea046b' },
  { name: 'Account 5', token: process.env.JWT_TOKEN_5, address: '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81' }
];

async function analyzeAccount(account) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${account.name} (${account.address})`);
  console.log('='.repeat(60));

  const api = axios.create({
    baseURL: 'https://gigaverse.io/api',
    headers: {
      'Authorization': `Bearer ${account.token}`,
      'Content-Type': 'application/json'
    }
  });

  const results = {
    hasActiveDungeon: false,
    activeDungeonType: null,
    startPayloads: [],
    actionPayloads: [],
    corruption: []
  };

  // 1. Check for active dungeon
  console.log('\n1. Checking for active dungeon...');
  try {
    const stateResponse = await api.get('/game/dungeon/state');
    const state = stateResponse.data;

    if (state.data?.run) {
      results.hasActiveDungeon = true;
      results.activeDungeonType = state.data.entity?.ID_CID;
      console.log(`✅ Has active dungeon: Type ${results.activeDungeonType}`);
      console.log(`   Room ${state.data.entity.ROOM_NUM_CID}, Enemy ${state.data.entity.ENEMY_CID}`);

      // Try to continue with minimal payload
      console.log('\n   Testing minimal payload on active dungeon...');
      try {
        const actionResponse = await api.post('/game/dungeon/action', {
          action: 'rock',
          dungeonType: parseInt(results.activeDungeonType),
          dungeonId: parseInt(results.activeDungeonType),
          data: {}
        });
        console.log('   ✅ Minimal payload works!');
        results.actionPayloads.push({ type: 'minimal', success: true });
      } catch (error) {
        console.log(`   ❌ Minimal payload failed: ${error.response?.data?.message}`);
        results.actionPayloads.push({ type: 'minimal', success: false, error: error.response?.data?.message });
        results.corruption.push(error.response?.data?.message);
      }
    } else {
      console.log('❌ No active dungeon');
    }
  } catch (error) {
    console.log(`Error checking state: ${error.message}`);
  }

  // 2. Test different start_run payloads (only if no active dungeon)
  if (!results.hasActiveDungeon) {
    console.log('\n2. Testing different start_run payloads...');

    const testPayloads = [
      {
        name: 'Empty data object',
        payload: {
          action: 'start_run',
          dungeonType: 3,
          dungeonId: 3,
          data: {}
        }
      },
      {
        name: 'With consumables array',
        payload: {
          action: 'start_run',
          dungeonType: 3,
          dungeonId: 3,
          data: {
            consumables: []
          }
        }
      },
      {
        name: 'With full structure (no gear)',
        payload: {
          action: 'start_run',
          dungeonType: 3,
          dungeonId: 3,
          data: {
            consumables: [],
            itemId: 0,
            index: 0
          }
        }
      }
    ];

    for (const test of testPayloads) {
      console.log(`\n   Testing: ${test.name}`);
      try {
        const response = await api.post('/game/dungeon/action', test.payload);
        console.log('   ✅ SUCCESS!');
        results.startPayloads.push({ name: test.name, success: true });

        // If successful, immediately retreat to clean up
        try {
          await api.post('/game/dungeon/action', {
            action: 'retreat',
            dungeonType: 3,
            dungeonId: 3,
            data: {}
          });
          console.log('   (Cleaned up with retreat)');
        } catch (e) {
          // Ignore retreat errors
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        break; // Only test one successful payload
      } catch (error) {
        console.log(`   ❌ Failed: ${error.response?.data?.message}`);
        results.startPayloads.push({ name: test.name, success: false, error: error.response?.data?.message });
        if (error.response?.data?.message === 'Error handling action') {
          results.corruption.push(test.name);
        }
      }
    }
  }

  // 3. Timing analysis - rapid vs delayed requests
  console.log('\n3. Testing timing sensitivity...');
  if (!results.hasActiveDungeon) {
    // Start a dungeon
    try {
      await api.post('/game/dungeon/action', {
        action: 'start_run',
        dungeonType: 3,
        dungeonId: 3,
        data: {}
      });

      // Test rapid fire (no delay)
      console.log('   Testing rapid fire (5 actions, no delay)...');
      let rapidSuccess = 0;
      let rapidFail = 0;
      for (let i = 0; i < 5; i++) {
        try {
          await api.post('/game/dungeon/action', {
            action: 'rock',
            dungeonType: 3,
            dungeonId: 3,
            data: {}
          });
          rapidSuccess++;
        } catch (error) {
          rapidFail++;
          if (error.response?.data?.message === 'Error handling action') {
            console.log(`   ❌ Got corruption on action ${i + 1}`);
            results.corruption.push(`Rapid fire action ${i + 1}`);
            break;
          }
        }
      }
      console.log(`   Rapid fire: ${rapidSuccess} success, ${rapidFail} failed`);

      // Clean up
      try {
        await api.post('/game/dungeon/action', {
          action: 'retreat',
          dungeonType: 3,
          dungeonId: 3,
          data: {}
        });
      } catch (e) {}

    } catch (error) {
      console.log(`   Couldn't start dungeon for timing test: ${error.response?.data?.message}`);
    }
  }

  return results;
}

async function runAnalysis() {
  const allResults = {};

  for (const account of accounts) {
    const results = await analyzeAccount(account);
    allResults[account.name] = results;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between accounts
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  for (const [name, results] of Object.entries(allResults)) {
    console.log(`\n${name}:`);
    console.log(`  Active dungeon: ${results.hasActiveDungeon ? `Yes (Type ${results.activeDungeonType})` : 'No'}`);
    console.log(`  Corruption events: ${results.corruption.length}`);
    if (results.corruption.length > 0) {
      console.log(`  Corruption at: ${results.corruption.join(', ')}`);
    }
  }
}

runAnalysis().then(() => {
  console.log('\n=== Analysis Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
