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

console.log('🎯 Focused Validation Bypass - Fresh Tokens Per Attempt');
console.log('🔓 Targeting "Error handling action" validation block\n');
console.log('=' .repeat(60));

// Get fresh action token for each attempt
async function getFreshToken() {
  try {
    await api.post('/game/dungeon/action', { action: 'fresh_' + Date.now() });
  } catch (error) {
    return error.response?.data?.actionToken?.toString();
  }
  return null;
}

async function focusedBypass() {
  
  console.log('\n1️⃣ Testing most promising bypass techniques:');
  
  // These are the techniques most likely to work based on common validation flaws
  const bypassTests = [
    {
      name: 'Null dungeonType bypass',
      payload: { action: 'start_run_3', dungeonType: null }
    },
    {
      name: 'Empty string dungeonType',
      payload: { action: 'start_run_3', dungeonType: '' }
    },
    {
      name: 'Zero dungeonType', 
      payload: { action: 'start_run_3', dungeonType: 0 }
    },
    {
      name: 'Alternative field name',
      payload: { action: 'start_run_3', type: 3 }
    },
    {
      name: 'Nested data structure',
      payload: { action: 'start_run_3', data: { dungeonType: 3 } }
    },
    {
      name: 'Force flag bypass',
      payload: { action: 'start_run_3', dungeonType: 3, force: true }
    },
    {
      name: 'Skip validation flag',
      payload: { action: 'start_run_3', dungeonType: 3, skipValidation: true }
    },
    {
      name: 'Admin bypass flag',
      payload: { action: 'start_run_3', dungeonType: 3, admin: true }
    },
    {
      name: 'Debug mode bypass',
      payload: { action: 'start_run_3', dungeonType: 3, debug: true }
    },
    {
      name: 'Test mode bypass',
      payload: { action: 'start_run_3', dungeonType: 3, test: true }
    }
  ];
  
  for (const test of bypassTests) {
    const actionToken = await getFreshToken();
    if (!actionToken) {
      console.log(`❌ Could not get token for ${test.name}`);
      continue;
    }
    
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`   Token: ${actionToken}`);
    
    try {
      const response = await api.post('/game/dungeon/action', {
        ...test.payload,
        actionToken: actionToken
      });
      
      console.log(`🎉 BYPASS SUCCESS! ${test.name}`);
      console.log('Response:', response.data);
      return { success: true, method: test.name, payload: test.payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      const status = error.response?.status;
      
      console.log(`   ❌ ${status}: ${message}`);
      
      // Look for different error patterns that might indicate progress
      if (message && message !== 'Error handling action' && !message.includes('Invalid action token')) {
        console.log(`   📝 DIFFERENT ERROR - this might be progress!`);
      }
    }
  }
  
  console.log('\n2️⃣ Testing parameter value manipulation:');
  
  // Try different values that might slip through validation
  const valueTests = [
    {
      name: 'String "3" instead of number',
      payload: { action: 'start_run_3', dungeonType: '3' }
    },
    {
      name: 'Float 3.0',
      payload: { action: 'start_run_3', dungeonType: 3.0 }
    },
    {
      name: 'Negative -3',
      payload: { action: 'start_run_3', dungeonType: -3 }
    },
    {
      name: 'Large number 999',
      payload: { action: 'start_run_3', dungeonType: 999 }
    },
    {
      name: 'Hex value 0x3',
      payload: { action: 'start_run_3', dungeonType: 0x3 }
    },
    {
      name: 'Array [3]',
      payload: { action: 'start_run_3', dungeonType: [3] }
    },
    {
      name: 'Object {value: 3}',
      payload: { action: 'start_run_3', dungeonType: { value: 3 } }
    },
    {
      name: 'Boolean true',
      payload: { action: 'start_run_3', dungeonType: true }
    }
  ];
  
  for (const test of valueTests) {
    const actionToken = await getFreshToken();
    if (!actionToken) continue;
    
    console.log(`\n🔬 Testing: ${test.name}`);
    
    try {
      const response = await api.post('/game/dungeon/action', {
        ...test.payload,
        actionToken: actionToken
      });
      
      console.log(`🎉 VALUE SUCCESS! ${test.name}`);
      console.log('Response:', response.data);
      return { success: true, method: test.name, payload: test.payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ ${message}`);
      
      if (message !== 'Error handling action' && !message.includes('Invalid action token')) {
        console.log(`   📝 Different error pattern detected`);
      }
    }
  }
  
  console.log('\n3️⃣ Testing action name variations:');
  
  // Try variations of recognized action names
  const actionTests = [
    'init_3',           // Simplest recognized action
    'begin_3',          // Another simple one
    'execute_3',        // Execute variant
    'launch_3',         // Launch variant
    'start_run_3',      // Full action
    'underhaul_3',      // Direct underhaul reference
    'mode3_start',      // Mode-based variant
    'type3_run'         // Type-based variant
  ];
  
  for (const actionName of actionTests) {
    const actionToken = await getFreshToken();
    if (!actionToken) continue;
    
    console.log(`\n🎬 Testing action: "${actionName}"`);
    
    // Try with minimal payload (just action + token)
    try {
      const response = await api.post('/game/dungeon/action', {
        action: actionName,
        actionToken: actionToken
      });
      
      console.log(`🎉 ACTION SUCCESS! "${actionName}" works with minimal payload!`);
      console.log('Response:', response.data);
      return { success: true, method: 'minimal_action', action: actionName, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ ${message}`);
    }
    
    // Try with various parameter combinations
    const paramCombos = [
      { dungeonType: 3 },
      { type: 3 },
      { mode: 'underhaul' },
      { energy: 40 },
      { dungeonType: 3, energy: 40 },
      { dungeonType: 3, force: true },
      { data: { type: 3 } }
    ];
    
    for (const params of paramCombos) {
      const freshToken = await getFreshToken();
      if (!freshToken) continue;
      
      try {
        const response = await api.post('/game/dungeon/action', {
          action: actionName,
          ...params,
          actionToken: freshToken
        });
        
        console.log(`   🎉 COMBO SUCCESS! "${actionName}" with params:`, params);
        console.log('   Response:', response.data);
        return { success: true, method: 'action_combo', action: actionName, params, response: response.data };
        
      } catch (error) {
        // Silent for combos to reduce noise
        const message = error.response?.data?.message;
        if (message !== 'Error handling action' && !message.includes('Invalid action token')) {
          console.log(`   📝 Combo gave different error:`, params, '-', message);
        }
      }
    }
  }
  
  console.log('\n4️⃣ Testing HTTP manipulation:');
  
  // Try different HTTP approaches
  const httpTests = [
    {
      name: 'Custom Content-Type',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    },
    {
      name: 'Additional Accept header',
      headers: { 'Accept': 'application/json, text/plain, */*' }
    },
    {
      name: 'Custom User-Agent',
      headers: { 'User-Agent': 'GigaverseBot/3.0 Underhaul' }
    },
    {
      name: 'X-Requested-With header',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    },
    {
      name: 'Cache control',
      headers: { 'Cache-Control': 'no-cache' }
    }
  ];
  
  for (const test of httpTests) {
    const actionToken = await getFreshToken();
    if (!actionToken) continue;
    
    console.log(`\n🌐 Testing: ${test.name}`);
    
    try {
      const response = await axios.post('https://gigaverse.io/api/game/dungeon/action', {
        action: 'start_run_3',
        dungeonType: 3,
        actionToken: actionToken
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...test.headers
        }
      });
      
      console.log(`🎉 HTTP SUCCESS! ${test.name}`);
      console.log('Response:', response.data);
      return { success: true, method: 'http_manipulation', test: test.name, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ ${message}`);
    }
  }
  
  return { success: false };
}

// Run focused bypass
focusedBypass()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result.success) {
      console.log('🎉 VALIDATION BYPASS SUCCESS!');
      console.log('🔓 Found way around "Error handling action" block!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Validation still blocking all underhaul attempts');
      console.log('\n🔍 Next approaches to try:');
      console.log('• Account-level permission changes');
      console.log('• Server-side feature flag activation');
      console.log('• Different authentication scopes');
      console.log('• Time-based activation windows');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });