#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.JWT_TOKEN_1;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

console.log('🧪 Testing What Actually Works vs "Error handling action"');
console.log('❓ Maybe we\'re missing something specific, not server-wide block\n');
console.log('=' .repeat(60));

async function testWhatWorks() {
  
  console.log('\n1️⃣ Testing actions that should definitely work:');
  
  // Get fresh action token
  let actionToken = null;
  try {
    await api.post('/game/dungeon/action', { action: 'get_token_test' });
  } catch (error) {
    actionToken = error.response?.data?.actionToken?.toString();
    console.log(`🔑 Got action token: ${actionToken}`);
  }
  
  if (!actionToken) {
    console.log('❌ Could not get action token');
    return;
  }
  
  // Test actions that should work based on our existing bot code
  const knownActions = [
    { action: 'get_state', name: 'Get game state' },
    { action: 'get_inventory', name: 'Get inventory' },
    { action: 'get_status', name: 'Get status' },
    { action: 'check_state', name: 'Check state' },
    { action: 'ping', name: 'Ping test' },
    { action: 'test', name: 'Test action' }
  ];
  
  for (const test of knownActions) {
    try {
      const response = await api.post('/game/dungeon/action', {
        action: test.action,
        actionToken: actionToken
      });
      
      console.log(`✅ ${test.name} WORKS!`);
      console.log('Response:', response.data);
      
      // Update token
      if (response.data?.actionToken) {
        actionToken = response.data.actionToken.toString();
      }
      
      return { success: true, workingAction: test.action, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`❌ ${test.name}: ${message}`);
      
      // Update token even from errors
      if (error.response?.data?.actionToken) {
        actionToken = error.response.data.actionToken.toString();
      }
      
      // If we get something OTHER than "Error handling action", that's interesting
      if (message && message !== 'Error handling action') {
        console.log(`📝 Different error - "${test.action}" might be valid but need different params`);
      }
    }
  }
  
  console.log('\n2️⃣ Testing what our existing bot actually uses:');
  
  // Check what actions our existing bot code uses that work
  const botActions = [
    { action: 'start_run', dungeonType: 1, name: 'Start regular dungeon (what bot uses)' },
    { action: 'get_enemy', name: 'Get enemy info' },
    { action: 'attack', target: 'enemy', name: 'Attack enemy' },
    { action: 'move', direction: 'forward', name: 'Move forward' },
    { action: 'loot', name: 'Loot action' },
    { action: 'heal', name: 'Heal action' }
  ];
  
  for (const test of botActions) {
    // Get fresh token for each test
    try {
      await api.post('/game/dungeon/action', { action: 'fresh_token_' + test.name });
    } catch (error) {
      if (error.response?.data?.actionToken) {
        actionToken = error.response.data.actionToken.toString();
      }
    }
    
    const payload = { action: test.action, actionToken };
    if (test.dungeonType) payload.dungeonType = test.dungeonType;
    if (test.target) payload.target = test.target;
    if (test.direction) payload.direction = test.direction;
    
    try {
      const response = await api.post('/game/dungeon/action', payload);
      
      console.log(`✅ ${test.name} WORKS!`);
      console.log('Payload:', payload);
      console.log('Response:', response.data);
      
      // This tells us the exact format that works!
      return { success: true, workingAction: test, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`❌ ${test.name}: ${message}`);
      
      if (error.response?.data?.actionToken) {
        actionToken = error.response.data.actionToken.toString();
      }
      
      // Analyze different error patterns
      if (message === 'Error handling action') {
        console.log(`   🔍 Gets validation block - server recognizes but blocks`);
      } else if (message.includes('Invalid action token')) {
        console.log(`   ⚠️ Token issue - action itself might be valid`);
      } else if (message.includes('not in dungeon') || message.includes('game state')) {
        console.log(`   📝 GAME STATE ERROR - action is valid but wrong state!`);
      } else if (message.includes('invalid') || message.includes('unknown')) {
        console.log(`   ❌ Action not recognized by server`);
      } else {
        console.log(`   📊 Different error: "${message}" - this tells us something`);
      }
    }
  }
  
  console.log('\n3️⃣ Testing if we need to be IN a dungeon first:');
  
  // Maybe we need to get into the proper game state first
  const stateActions = [
    { action: 'enter_dungeon', name: 'Enter dungeon' },
    { action: 'join_game', name: 'Join game' },
    { action: 'start_session', name: 'Start session' },
    { action: 'init_game', name: 'Initialize game' },
    { action: 'begin_game', name: 'Begin game' }
  ];
  
  for (const test of stateActions) {
    try {
      await api.post('/game/dungeon/action', { action: 'state_token_' + test.name });
    } catch (error) {
      if (error.response?.data?.actionToken) {
        actionToken = error.response.data.actionToken.toString();
      }
    }
    
    try {
      const response = await api.post('/game/dungeon/action', {
        action: test.action,
        actionToken: actionToken
      });
      
      console.log(`✅ ${test.name} WORKS - might be the key!`);
      console.log('Response:', response.data);
      
      // Update token
      if (response.data?.actionToken) {
        actionToken = response.data.actionToken.toString();
      }
      
      // Now try underhaul with this new game state
      console.log('   🎯 Now testing underhaul with new game state...');
      
      try {
        const underhaulResponse = await api.post('/game/dungeon/action', {
          action: 'start_run_3',
          actionToken: actionToken
        });
        
        console.log('   🎉 UNDERHAUL WORKS AFTER STATE CHANGE!');
        console.log('   Response:', underhaulResponse.data);
        return { success: true, method: 'state_first', stateAction: test.action, response: underhaulResponse.data };
        
      } catch (error) {
        const message = error.response?.data?.message;
        console.log(`   ❌ Underhaul still blocked: ${message}`);
        
        if (message !== 'Error handling action') {
          console.log(`   📝 But different error - progress!`);
        }
      }
      
    } catch (error) {
      const message = error.response?.data?.message;
      if (message !== 'Error handling action') {
        console.log(`📝 ${test.name}: ${message} (not the validation block)`);
      }
      
      if (error.response?.data?.actionToken) {
        actionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  console.log('\n4️⃣ Testing current dungeon state:');
  
  // Check what our current state actually is
  try {
    const stateResponse = await api.get('/game/dungeon/state');
    console.log('Current dungeon state:', stateResponse.data);
    
    // If we're already in a dungeon, try underhaul
    if (stateResponse.data && stateResponse.data !== 'not in dungeon') {
      console.log('🎮 We\'re already in a game - trying underhaul...');
      
      try {
        const underhaulResponse = await api.post('/game/dungeon/action', {
          action: 'start_run_3',
          actionToken: actionToken
        });
        
        console.log('🎉 UNDERHAUL WORKS IN CURRENT STATE!');
        console.log('Response:', underhaulResponse.data);
        return { success: true, method: 'current_state', response: underhaulResponse.data };
        
      } catch (error) {
        console.log(`❌ Still blocked in current state: ${error.response?.data?.message}`);
      }
    }
    
  } catch (error) {
    console.log('Could not get dungeon state:', error.message);
  }
  
  return { success: false };
}

// Run the test
testWhatWorks()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result.success) {
      console.log('🎉 FOUND WHAT WORKS!');
      console.log('🔑 This shows us the pattern for success!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('🤔 Need to dig deeper into what "Error handling action" means');
      console.log('\n💡 Key insight: If even basic actions fail with this error,');
      console.log('   then it might really be a server-side issue.');
      console.log('   But if some actions work, we know the pattern to follow.');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });