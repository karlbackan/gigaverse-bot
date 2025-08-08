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

console.log('🔍 Comparing Working vs Blocked Actions');
console.log('🎯 Find the exact difference causing validation failure\n');
console.log('=' .repeat(60));

// Get fresh action token
async function getFreshToken() {
  try {
    await api.post('/game/dungeon/action', { action: 'compare_' + Date.now() });
  } catch (error) {
    return error.response?.data?.actionToken?.toString();
  }
  return null;
}

async function compareActions() {
  
  console.log('\n1️⃣ Testing what WORKS vs what gets blocked:');
  
  // Test actions we know work vs underhaul actions
  const comparisons = [
    {
      name: 'Regular start_run (working)',
      action: 'start_run',
      dungeonType: 1,
      expectSuccess: false, // Will fail but with different error
      note: 'Should fail with game state error, not validation'
    },
    {
      name: 'Underhaul start_run (blocked)',
      action: 'start_run',
      dungeonType: 3,
      expectSuccess: false,
      note: 'Should fail with "Error handling action"'
    },
    {
      name: 'Regular start_run no type (working)',
      action: 'start_run',
      expectSuccess: false,
      note: 'Should fail with parameter error'
    },
    {
      name: 'Underhaul action (blocked)',
      action: 'start_run_3',
      expectSuccess: false,
      note: 'Should fail with "Error handling action"'
    },
    {
      name: 'Unknown action (should fail differently)',
      action: 'completely_unknown_action_123',
      expectSuccess: false,
      note: 'Should fail with "unknown action" type error'
    }
  ];
  
  for (const test of comparisons) {
    const actionToken = await getFreshToken();
    if (!actionToken) continue;
    
    console.log(`\n🧪 ${test.name}`);
    console.log(`   Action: ${test.action}${test.dungeonType ? `, dungeonType: ${test.dungeonType}` : ''}`);
    console.log(`   Expected: ${test.note}`);
    
    const payload = { action: test.action, actionToken };
    if (test.dungeonType) payload.dungeonType = test.dungeonType;
    
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`   🎉 UNEXPECTED SUCCESS!`);
      console.log('   Response:', response.data);
      return { success: true, test: test.name, payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      const status = error.response?.status;
      
      console.log(`   ❌ ${status}: ${message}`);
      console.log(`   📝 Error pattern: ${message === 'Error handling action' ? 'VALIDATION BLOCK' : 'OTHER'}`);
      
      // Look for patterns
      if (message === 'Error handling action') {
        console.log(`   🔍 This action hits the validation block we're trying to bypass`);
      } else if (message.includes('Invalid action token')) {
        console.log(`   ⚠️ Token issue - action might be recognized`);
      } else {
        console.log(`   📊 Different error - this might tell us something`);
      }
    }
  }
  
  console.log('\n2️⃣ Testing parameter combinations that bypass validation:');
  
  // Try the exact same structure as working calls but with underhaul
  const structureTests = [
    {
      name: 'Exact working structure with type 3',
      payload: { action: 'start_run', dungeonType: 3, data: {} }
    },
    {
      name: 'Minimal working structure with type 3',
      payload: { action: 'start_run', dungeonType: 3 }
    },
    {
      name: 'Working structure - no data field',
      payload: { action: 'start_run', dungeonType: 3, energy: 40 }
    },
    {
      name: 'Alternative working structure',
      payload: { action: 'start_run', type: 3, data: {} }
    },
    {
      name: 'JSON string dungeonType',
      payload: { action: 'start_run', dungeonType: '3' }
    }
  ];
  
  for (const test of structureTests) {
    const actionToken = await getFreshToken();
    if (!actionToken) continue;
    
    console.log(`\n🏗️ ${test.name}`);
    
    try {
      const response = await api.post('/game/dungeon/action', {
        ...test.payload,
        actionToken
      });
      
      console.log(`   🎉 STRUCTURE SUCCESS!`);
      console.log('   Response:', response.data);
      return { success: true, method: 'structure', test: test.name, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ ${message}`);
      
      if (message !== 'Error handling action') {
        console.log(`   📝 Different error - structure might be affecting validation`);
      }
    }
  }
  
  console.log('\n3️⃣ Testing if validation depends on game state:');
  
  // Maybe underhaul requires specific game state
  const stateTests = [
    {
      name: 'With energy parameter',
      payload: { action: 'start_run_3', energy: 40 }
    },
    {
      name: 'With explicit energy limit',
      payload: { action: 'start_run_3', energyLimit: 40 }
    },
    {
      name: 'With player state',
      payload: { action: 'start_run_3', playerReady: true }
    },
    {
      name: 'With game mode',
      payload: { action: 'start_run_3', gameMode: 'underhaul' }
    },
    {
      name: 'With session state',
      payload: { action: 'start_run_3', sessionActive: true }
    }
  ];
  
  for (const test of stateTests) {
    const actionToken = await getFreshToken();
    if (!actionToken) continue;
    
    console.log(`\n🎮 ${test.name}`);
    
    try {
      const response = await api.post('/game/dungeon/action', {
        ...test.payload,
        actionToken
      });
      
      console.log(`   🎉 STATE SUCCESS!`);
      console.log('   Response:', response.data);
      return { success: true, method: 'state', test: test.name, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ ${message}`);
    }
  }
  
  console.log('\n4️⃣ Testing sequence-based bypass:');
  
  // Maybe need to do something before underhaul works
  const sequences = [
    ['init_3', 'start_run_3'],
    ['begin_3', 'execute_3'],
    ['mode3_start', 'type3_run']
  ];
  
  for (const sequence of sequences) {
    console.log(`\n🔄 Testing sequence: ${sequence.join(' → ')}`);
    
    let sequenceToken = await getFreshToken();
    if (!sequenceToken) continue;
    
    let sequenceSuccess = true;
    let responses = [];
    
    for (const action of sequence) {
      try {
        const response = await api.post('/game/dungeon/action', {
          action: action,
          actionToken: sequenceToken
        });
        
        console.log(`   ✅ "${action}" succeeded in sequence`);
        responses.push(response.data);
        
        // Update token for next action in sequence
        if (response.data?.actionToken) {
          sequenceToken = response.data.actionToken.toString();
        }
        
      } catch (error) {
        const message = error.response?.data?.message;
        console.log(`   ❌ "${action}" failed: ${message}`);
        
        // Update token even from errors
        if (error.response?.data?.actionToken) {
          sequenceToken = error.response.data.actionToken.toString();
        }
        
        // If this isn't the "Error handling action", it might be progress
        if (message !== 'Error handling action') {
          console.log(`   📝 Different error in sequence - potential progress`);
        }
        
        sequenceSuccess = false;
        break;
      }
    }
    
    if (sequenceSuccess) {
      console.log(`   🎉 SEQUENCE SUCCESS! All actions in sequence worked!`);
      return { success: true, method: 'sequence', sequence, responses };
    }
  }
  
  console.log('\n5️⃣ Testing raw HTTP request variations:');
  
  // Try different HTTP request formats
  const actionToken = await getFreshToken();
  if (actionToken) {
    // Try form data instead of JSON
    try {
      console.log('\n📡 Testing form data format...');
      const formData = new URLSearchParams();
      formData.append('action', 'start_run_3');
      formData.append('actionToken', actionToken);
      
      const response = await axios.post('https://gigaverse.io/api/game/dungeon/action', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('🎉 FORM DATA SUCCESS!');
      console.log('Response:', response.data);
      return { success: true, method: 'form_data', response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ Form data: ${message}`);
    }
  }
  
  return { success: false };
}

// Run comparison
compareActions()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result.success) {
      console.log('🎉 BREAKTHROUGH! Found working method!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ No bypass found in comparative analysis');
      console.log('\n🔍 Key insight: "Error handling action" is consistent validation block');
      console.log('💡 This suggests server-side permission or feature flag requirement');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });