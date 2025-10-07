#!/usr/bin/env node

/**
 * Diagnostic script to investigate "Error handling action" root cause
 * Tests various scenarios to identify what triggers the error
 */

import 'dotenv/config';
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${process.env.JWT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

console.log('🔬 Diagnosing "Error handling action" issue\n');

// Get current dungeon state
async function getDungeonState() {
  const response = await api.get('/game/dungeon/state');
  return response.data;
}

// Get equipped gear IDs
async function getEquippedGearIds(address) {
  try {
    const response = await api.get(`/gear/instances/${address}`);
    const gearEntities = response.data?.entities || [];
    const equippedGear = gearEntities.filter(gear => gear.EQUIPPED_TO_SLOT_CID > -1);
    return equippedGear.map(gear => gear.docId);
  } catch (error) {
    console.error('Failed to get equipped gear:', error.message);
    return [];
  }
}

// Test 1: Token age analysis
async function testTokenAge() {
  console.log('📊 TEST 1: Token Age Analysis');
  console.log('Testing if tokens expire after certain time...\n');

  const state = await getDungeonState();
  if (!state?.data?.run) {
    console.log('❌ No active dungeon - cannot test\n');
    return;
  }

  const entity = state.data.entity;
  const dungeonType = parseInt(entity.ID_CID);

  // Send an action to get a token
  console.log('Sending initial action to get token...');
  const initialAction = await api.post('/game/dungeon/action', {
    action: 'rock',
    dungeonType: dungeonType,
    dungeonId: dungeonType,
    data: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: [] }
  });

  const token = initialAction.data?.actionToken;
  const tokenTimestamp = parseInt(token);
  console.log(`✅ Got token: ${token}`);
  console.log(`   Token timestamp: ${new Date(tokenTimestamp).toISOString()}`);

  // Test token at different delays
  const delays = [1000, 3000, 5000, 7000, 10000, 15000]; // 1s, 3s, 5s, 7s, 10s, 15s

  for (const delay of delays) {
    const state2 = await getDungeonState();
    if (!state2?.data?.run) {
      console.log('⚠️  Dungeon ended - stopping test\n');
      break;
    }

    console.log(`\nWaiting ${delay}ms before using token...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    const now = Date.now();
    const tokenAge = now - tokenTimestamp;

    try {
      const response = await api.post('/game/dungeon/action', {
        action: 'paper',
        dungeonType: dungeonType,
        dungeonId: dungeonType,
        data: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: [] },
        actionToken: token.toString()
      });

      console.log(`✅ Success with ${tokenAge}ms old token`);
      console.log(`   New token: ${response.data?.actionToken}`);
      break; // Exit on success
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`❌ Failed with ${tokenAge}ms old token: ${message}`);

      if (message === 'Error handling action') {
        console.log('🎯 FOUND: "Error handling action" occurs with token age ~' + tokenAge + 'ms');
      }
    }
  }

  console.log('\n');
}

// Test 2: Missing fields analysis
async function testMissingFields() {
  console.log('📊 TEST 2: Missing Fields Analysis');
  console.log('Testing if missing/empty fields cause the error...\n');

  const state = await getDungeonState();
  if (!state?.data?.run) {
    console.log('❌ No active dungeon - cannot test\n');
    return;
  }

  const entity = state.data.entity;
  const dungeonType = parseInt(entity.ID_CID);
  const address = process.env.WALLET_ADDRESS || '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0';
  const gearIds = await getEquippedGearIds(address);

  console.log(`Dungeon type: ${dungeonType}`);
  console.log(`Equipped gear: ${gearIds.length} items`);

  // Test variations
  const variations = [
    { name: 'With gear IDs', payload: { gearInstanceIds: gearIds } },
    { name: 'Empty gear array', payload: { gearInstanceIds: [] } },
    { name: 'No gear field', payload: {} },
    { name: 'With all fields', payload: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: gearIds } },
  ];

  for (const variant of variations) {
    const state2 = await getDungeonState();
    if (!state2?.data?.run) {
      console.log('⚠️  Dungeon ended - stopping test\n');
      break;
    }

    console.log(`\nTesting: ${variant.name}`);

    try {
      const response = await api.post('/game/dungeon/action', {
        action: 'scissor',
        dungeonType: dungeonType,
        dungeonId: dungeonType,
        data: variant.payload
      });

      console.log(`✅ Success with "${variant.name}"`);
      console.log(`   Token: ${response.data?.actionToken}`);
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`❌ Failed with "${variant.name}": ${message}`);

      if (message === 'Error handling action') {
        console.log('🎯 FOUND: "Error handling action" occurs with: ' + variant.name);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n');
}

// Test 3: Token reuse analysis
async function testTokenReuse() {
  console.log('📊 TEST 3: Token Reuse Analysis');
  console.log('Testing if reusing same token causes issues...\n');

  const state = await getDungeonState();
  if (!state?.data?.run) {
    console.log('❌ No active dungeon - cannot test\n');
    return;
  }

  const entity = state.data.entity;
  const dungeonType = parseInt(entity.ID_CID);

  // Get initial token
  console.log('Getting initial token...');
  const response1 = await api.post('/game/dungeon/action', {
    action: 'rock',
    dungeonType: dungeonType,
    dungeonId: dungeonType,
    data: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: [] }
  });

  const token1 = response1.data?.actionToken?.toString();
  console.log(`✅ Token 1: ${token1}\n`);

  // Try using it immediately
  console.log('Test 1: Using token immediately (should work)');
  try {
    const response2 = await api.post('/game/dungeon/action', {
      action: 'paper',
      dungeonType: dungeonType,
      dungeonId: dungeonType,
      data: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: [] },
      actionToken: token1
    });
    const token2 = response2.data?.actionToken?.toString();
    console.log(`✅ Success - got new token: ${token2}\n`);

    // Try using old token again
    console.log('Test 2: Reusing old token (should fail?)');
    try {
      await api.post('/game/dungeon/action', {
        action: 'scissor',
        dungeonType: dungeonType,
        dungeonId: dungeonType,
        data: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: [] },
        actionToken: token1 // Reuse old token
      });
      console.log(`⚠️  Unexpectedly succeeded with reused token\n`);
    } catch (error) {
      console.log(`❌ Failed with reused token: ${error.response?.data?.message}`);
      console.log('🎯 Confirmed: Cannot reuse old tokens\n');
    }

  } catch (error) {
    console.log(`❌ Failed: ${error.response?.data?.message}\n`);
  }

  console.log('\n');
}

// Test 4: Rapid succession analysis
async function testRapidActions() {
  console.log('📊 TEST 4: Rapid Action Analysis');
  console.log('Testing if sending actions too quickly causes issues...\n');

  const state = await getDungeonState();
  if (!state?.data?.run) {
    console.log('❌ No active dungeon - cannot test\n');
    return;
  }

  const entity = state.data.entity;
  const dungeonType = parseInt(entity.ID_CID);

  const delays = [0, 100, 500, 1000, 2000]; // Test different delays

  for (const delay of delays) {
    const state2 = await getDungeonState();
    if (!state2?.data?.run) {
      console.log('⚠️  Dungeon ended - stopping test\n');
      break;
    }

    console.log(`Testing with ${delay}ms delay between actions...`);

    try {
      // First action
      const response1 = await api.post('/game/dungeon/action', {
        action: 'rock',
        dungeonType: dungeonType,
        dungeonId: dungeonType,
        data: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: [] }
      });
      const token = response1.data?.actionToken?.toString();

      // Wait
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Second action with token
      const response2 = await api.post('/game/dungeon/action', {
        action: 'paper',
        dungeonType: dungeonType,
        dungeonId: dungeonType,
        data: { consumables: [], itemId: 0, index: 0, isJuiced: false, gearInstanceIds: [] },
        actionToken: token
      });

      console.log(`✅ Success with ${delay}ms delay\n`);
    } catch (error) {
      console.log(`❌ Failed with ${delay}ms delay: ${error.response?.data?.message}\n`);

      if (error.response?.data?.message === 'Error handling action') {
        console.log('🎯 FOUND: Issue occurs with ' + delay + 'ms delay\n');
      }
    }
  }

  console.log('\n');
}

// Run all tests
async function runDiagnostics() {
  try {
    await testTokenAge();
    // Uncomment to run other tests:
    // await testMissingFields();
    // await testTokenReuse();
    // await testRapidActions();

    console.log('✅ Diagnostics complete');
  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
  }
}

runDiagnostics();
