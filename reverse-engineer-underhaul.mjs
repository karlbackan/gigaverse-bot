#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.JWT_TOKEN_1;
let currentActionToken = null;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

console.log('🕵️ Reverse Engineering Underhaul API Access');
console.log('⚠️  Limited to 40 energy consumption\n');
console.log('=' .repeat(60));

// Get fresh action token first
async function getActionToken() {
  try {
    await api.post('/game/dungeon/action', { action: 'get_token' });
  } catch (error) {
    if (error.response?.data?.actionToken) {
      currentActionToken = error.response.data.actionToken.toString();
      console.log(`🔑 Got action token: ${currentActionToken}`);
      return true;
    }
  }
  return false;
}

async function reverseEngineerUnderhaul() {
  
  // Get action token first
  if (!await getActionToken()) {
    console.log('❌ Could not get action token');
    return;
  }
  
  // 1. Test different API versions
  console.log('\n1️⃣ Testing API version variations:');
  
  const versionPaths = [
    '/v1/game/dungeon/action',
    '/v2/game/dungeon/action', 
    '/v3/game/dungeon/action',
    '/api/v1/game/dungeon/action',
    '/api/v2/game/dungeon/action',
    '/beta/game/dungeon/action',
    '/test/game/dungeon/action',
    '/dev/game/dungeon/action'
  ];
  
  for (const path of versionPaths) {
    try {
      const response = await axios.post(`https://gigaverse.io${path}`, 
        { action: 'start_underhaul', actionToken: currentActionToken },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      console.log(`✅ Version path works: ${path}`);
      console.log('Response:', response.data);
      return { method: 'API Version', path, response: response.data };
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`📝 ${path}: Bad Request - might be close!`);
      }
    }
  }
  
  // 2. Test query parameters  
  console.log('\n2️⃣ Testing query parameters:');
  
  const queryParams = [
    '?mode=underhaul',
    '?type=underhaul', 
    '?underhaul=true',
    '?version=3',
    '?beta=true',
    '?energy=40',
    '?dungeon_type=3',
    '?game_mode=underhaul'
  ];
  
  for (const query of queryParams) {
    try {
      const response = await api.post(`/game/dungeon/action${query}`, {
        action: 'start_run',
        actionToken: currentActionToken
      });
      console.log(`✅ Query param works: ${query}`);
      console.log('Response:', response.data);
      return { method: 'Query Params', query, response: response.data };
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`📝 Query ${query}: Bad Request`);
      }
    }
  }
  
  // 3. Test special headers
  console.log('\n3️⃣ Testing special headers:');
  
  const headerCombos = [
    { 'X-Game-Mode': 'underhaul' },
    { 'X-Dungeon-Type': '3' },
    { 'X-Energy-Limit': '40' },
    { 'X-Beta-Access': 'true' },
    { 'X-API-Version': 'v2' },
    { 'Game-Type': 'underhaul' },
    { 'Dungeon-Mode': 'underhaul' },
    { 'User-Agent': 'GigaverseBot/2.0 Underhaul' },
    { 'X-Requested-With': 'XMLHttpRequest' },
    { 'X-Client-Version': '2.0.0' }
  ];
  
  for (const headers of headerCombos) {
    try {
      const response = await api.post('/game/dungeon/action', 
        { action: 'start_run', actionToken: currentActionToken },
        { headers: { ...api.defaults.headers, ...headers } }
      );
      console.log(`✅ Special header works:`, headers);
      console.log('Response:', response.data);
      return { method: 'Special Headers', headers, response: response.data };
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`📝 Header works but bad request:`, Object.keys(headers)[0]);
      }
    }
  }
  
  // 4. Test different action sequences
  console.log('\n4️⃣ Testing action sequences:');
  
  const sequences = [
    // Maybe need to initialize underhaul first
    [{ action: 'init_underhaul' }, { action: 'start_run' }],
    [{ action: 'switch_mode', mode: 'underhaul' }, { action: 'start_run' }],
    [{ action: 'set_dungeon_type', dungeonType: 3 }, { action: 'start_run' }],
    [{ action: 'enter_underhaul_mode' }, { action: 'start_run' }],
    [{ action: 'activate_underhaul' }, { action: 'start_run' }]
  ];
  
  for (const sequence of sequences) {
    try {
      console.log(`🔄 Testing sequence: ${sequence.map(s => s.action).join(' → ')}`);
      
      // Execute sequence
      let lastResponse = null;
      for (const step of sequence) {
        const payload = { ...step, actionToken: currentActionToken };
        const response = await api.post('/game/dungeon/action', payload);
        lastResponse = response.data;
        
        // Update token for next step
        if (response.data?.actionToken) {
          currentActionToken = response.data.actionToken.toString();
        }
      }
      
      console.log(`✅ Sequence works!`);
      console.log('Final response:', lastResponse);
      return { method: 'Action Sequence', sequence, response: lastResponse };
      
    } catch (error) {
      const message = error.response?.data?.message;
      if (message && !message.includes('Invalid action token')) {
        console.log(`📝 Sequence partially works: ${message}`);
      }
      
      // Update token even from errors
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  // 5. Test encoded/obfuscated actions
  console.log('\n5️⃣ Testing encoded action names:');
  
  const encodedActions = [
    'start_run_3',      // Maybe type is in action name
    'underhaul_3',      // Underhaul + type
    'mode3_start',      // Mode 3 start
    'type3_run',        // Type 3 run
    'start_dungeon_3',  // Explicit dungeon 3
    'run_underhaul_3',  // Run underhaul type 3
    'begin_3',          // Simple begin type 3
    'launch_3',         // Launch type 3
    'execute_3',        // Execute type 3
    'init_3'            // Initialize type 3
  ];
  
  for (const action of encodedActions) {
    try {
      const response = await api.post('/game/dungeon/action', {
        action: action,
        actionToken: currentActionToken
      });
      console.log(`✅ Encoded action works: "${action}"`);
      console.log('Response:', response.data);
      return { method: 'Encoded Action', action, response: response.data };
    } catch (error) {
      if (error.response?.status === 400) {
        const message = error.response?.data?.message;
        if (message && !message.includes('Invalid action token')) {
          console.log(`📝 Action "${action}": ${message}`);
        }
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  // 6. Test different payload structures
  console.log('\n6️⃣ Testing payload structure variations:');
  
  const payloadVariations = [
    // Maybe underhaul uses completely different structure
    {
      cmd: 'start_underhaul',
      token: currentActionToken
    },
    {
      command: 'start',
      type: 'underhaul', 
      actionToken: currentActionToken
    },
    {
      request: 'start_dungeon',
      parameters: { type: 3 },
      actionToken: currentActionToken
    },
    {
      action: 'start_run',
      config: { underhaul: true, energy: 40 },
      actionToken: currentActionToken
    },
    {
      action: 'start_run',
      metadata: { dungeonType: 3, mode: 'underhaul' },
      actionToken: currentActionToken  
    }
  ];
  
  for (const payload of payloadVariations) {
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`✅ Payload variation works:`, Object.keys(payload));
      console.log('Response:', response.data);
      return { method: 'Payload Variation', payload, response: response.data };
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`📝 Payload variation: ${error.response?.data?.message}`);
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  // 7. Test with energy specification
  console.log('\n7️⃣ Testing with explicit energy limits:');
  
  const energyPayloads = [
    { action: 'start_run', dungeonType: 3, energy: 40, actionToken: currentActionToken },
    { action: 'start_run', dungeonType: 3, energyLimit: 40, actionToken: currentActionToken },
    { action: 'start_run', dungeonType: 3, maxEnergy: 40, actionToken: currentActionToken },
    { action: 'start_underhaul', energy: 40, actionToken: currentActionToken },
    { action: 'start_underhaul', energySpend: 40, actionToken: currentActionToken }
  ];
  
  for (const payload of energyPayloads) {
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`✅ Energy specification works!`, payload);
      console.log('Response:', response.data);
      return { method: 'Energy Specification', payload, response: response.data };
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`📝 Energy payload: ${error.response?.data?.message}`);
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  return null;
}

// Run reverse engineering
reverseEngineerUnderhaul()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result) {
      console.log('🎉 BREAKTHROUGH! Found working method:');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n🚀 This is how the other user accessed Underhaul!');
    } else {
      console.log('❌ No working method found in this session');
      console.log('\n💡 The other user might have used:');
      console.log('1. Different timing (server-side feature toggle)');  
      console.log('2. Special account permissions');
      console.log('3. Different API endpoints we haven\'t found');
      console.log('4. Client-side modifications');
      console.log('5. WebSocket or real-time protocols');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });