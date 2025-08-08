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

console.log('🔎 Finding the Correct Underhaul Type/Value');
console.log('❓ What dungeonType value actually works for underhaul?\n');
console.log('=' .repeat(60));

async function findUnderhaulType() {
  
  console.log('\n1️⃣ Checking available dungeons to see what types exist:');
  
  try {
    const response = await api.get('/game/dungeon/today');
    console.log('Available dungeons response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Look for underhaul or type 3 references
    const dataStr = JSON.stringify(response.data).toLowerCase();
    if (dataStr.includes('underhaul') || dataStr.includes('type') || dataStr.includes('mode')) {
      console.log('\n🎯 Found potential underhaul references in available dungeons!');
    }
    
  } catch (error) {
    console.log('❌ Could not get available dungeons:', error.message);
  }
  
  console.log('\n2️⃣ Testing every possible dungeonType value systematically:');
  
  // Test a wide range of possible values
  const typeTests = [
    // Numbers
    ...Array.from({length: 20}, (_, i) => ({ value: i, name: `Number ${i}` })),
    // Negative numbers
    { value: -1, name: 'Negative -1' },
    { value: -3, name: 'Negative -3' },
    // Strings
    { value: 'underhaul', name: 'String "underhaul"' },
    { value: 'UNDERHAUL', name: 'String "UNDERHAUL"' },
    { value: 'Underhaul', name: 'String "Underhaul"' },
    { value: 'mode3', name: 'String "mode3"' },
    { value: 'type3', name: 'String "type3"' },
    { value: 'dungeon3', name: 'String "dungeon3"' },
    { value: '3', name: 'String "3"' },
    // Special values
    { value: null, name: 'null' },
    { value: undefined, name: 'undefined' },
    { value: true, name: 'boolean true' },
    { value: false, name: 'boolean false' },
    // Arrays
    { value: [3], name: 'Array [3]' },
    { value: [1, 3], name: 'Array [1, 3]' },
    // Objects
    { value: { type: 3 }, name: 'Object {type: 3}' },
    { value: { mode: 'underhaul' }, name: 'Object {mode: "underhaul"}' }
  ];
  
  for (const test of typeTests) {
    // Get fresh action token for each test
    let actionToken = null;
    try {
      await api.post('/game/dungeon/action', { action: 'type_test_' + Date.now() });
    } catch (error) {
      actionToken = error.response?.data?.actionToken?.toString();
    }
    
    if (!actionToken) {
      console.log(`❌ Could not get token for ${test.name}`);
      continue;
    }
    
    console.log(`\n🧪 Testing dungeonType: ${JSON.stringify(test.value)} (${test.name})`);
    
    try {
      const response = await api.post('/game/dungeon/action', {
        action: 'start_run',
        dungeonType: test.value,
        data: {},
        actionToken: actionToken
      });
      
      console.log(`🎉 SUCCESS! dungeonType ${JSON.stringify(test.value)} works for underhaul!`);
      console.log('Response:', response.data);
      return { success: true, dungeonType: test.value, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      const status = error.response?.status;
      
      if (message === 'Error handling action') {
        console.log(`   ❌ Error handling action (validation block)`);
      } else if (message?.includes('Invalid action token')) {
        console.log(`   ⚠️ Token issue - might be valid type`);
      } else if (message?.includes('not found') || message?.includes('invalid')) {
        console.log(`   📝 ${message} (type not recognized)`);
      } else {
        console.log(`   📊 Different error: ${status} - ${message}`);
        
        // Any error that's NOT "Error handling action" might indicate we found something
        if (message !== 'Error handling action') {
          console.log(`   🎯 DIFFERENT ERROR - this type might be special!`);
        }
      }
    }
  }
  
  console.log('\n3️⃣ Testing if underhaul needs NO dungeonType parameter:');
  
  // Maybe underhaul doesn't use dungeonType at all
  const noDungeonTypeTests = [
    {
      name: 'No dungeonType, mode in data',
      payload: { action: 'start_run', data: { mode: 'underhaul' } }
    },
    {
      name: 'No dungeonType, type in data', 
      payload: { action: 'start_run', data: { type: 'underhaul' } }
    },
    {
      name: 'No dungeonType, underhaul flag',
      payload: { action: 'start_run', data: { underhaul: true } }
    },
    {
      name: 'No dungeonType, just action',
      payload: { action: 'start_run', data: {} }
    },
    {
      name: 'Different action, no type',
      payload: { action: 'start_underhaul', data: {} }
    }
  ];
  
  for (const test of noDungeonTypeTests) {
    let actionToken = null;
    try {
      await api.post('/game/dungeon/action', { action: 'no_type_test_' + Date.now() });
    } catch (error) {
      actionToken = error.response?.data?.actionToken?.toString();
    }
    
    if (!actionToken) continue;
    
    console.log(`\n🚫 ${test.name}:`);
    
    try {
      const response = await api.post('/game/dungeon/action', {
        ...test.payload,
        actionToken: actionToken
      });
      
      console.log(`   🎉 SUCCESS! ${test.name} works!`);
      console.log('   Response:', response.data);
      return { success: true, method: 'no_dungeon_type', test: test.name, payload: test.payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ ${message}`);
    }
  }
  
  console.log('\n4️⃣ Testing if we need to specify underhaul differently:');
  
  // Maybe it's not dungeonType but a different parameter name
  const alternativeParams = [
    { param: 'type', value: 3, name: 'type: 3' },
    { param: 'type', value: 'underhaul', name: 'type: "underhaul"' },
    { param: 'mode', value: 3, name: 'mode: 3' },
    { param: 'mode', value: 'underhaul', name: 'mode: "underhaul"' },
    { param: 'dungeonMode', value: 3, name: 'dungeonMode: 3' },
    { param: 'dungeonMode', value: 'underhaul', name: 'dungeonMode: "underhaul"' },
    { param: 'gameType', value: 3, name: 'gameType: 3' },
    { param: 'gameType', value: 'underhaul', name: 'gameType: "underhaul"' },
    { param: 'battleType', value: 'underhaul', name: 'battleType: "underhaul"' },
    { param: 'dungeonId', value: 3, name: 'dungeonId: 3' }
  ];
  
  for (const test of alternativeParams) {
    let actionToken = null;
    try {
      await api.post('/game/dungeon/action', { action: 'alt_param_test_' + Date.now() });
    } catch (error) {
      actionToken = error.response?.data?.actionToken?.toString();
    }
    
    if (!actionToken) continue;
    
    console.log(`\n🔄 Testing ${test.name}:`);
    
    const payload = {
      action: 'start_run',
      data: {},
      actionToken: actionToken
    };
    payload[test.param] = test.value;
    
    try {
      const response = await api.post('/game/dungeon/action', payload);
      
      console.log(`   🎉 SUCCESS! ${test.name} works!`);
      console.log('   Response:', response.data);
      return { success: true, method: 'alternative_param', param: test.param, value: test.value, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      console.log(`   ❌ ${message}`);
    }
  }
  
  return { success: false };
}

// Run the search
findUnderhaulType()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result.success) {
      console.log('🎉 FOUND THE CORRECT UNDERHAUL TYPE/PARAMETER!');
      console.log('✅ This is how to start underhaul!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Could not find the correct underhaul type/parameter');
      console.log('\n🤔 This suggests underhaul might:');
      console.log('• Use a completely different API endpoint');
      console.log('• Require additional authentication or permissions');
      console.log('• Need different request structure entirely');
      console.log('• Be temporarily disabled server-side');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });