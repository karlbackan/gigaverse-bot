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

console.log('🔍 Analyzing Working Dungeon Endpoint Pattern\n');
console.log('=' .repeat(60));

async function analyzeDungeonPattern() {
  
  console.log('\n1️⃣ Testing regular dungeon endpoint structure:');
  
  // Test the known working endpoint with different variations
  const dungeonPaths = [
    '/game/dungeon/action',
    '/dungeon/action',
    '/game/dungeon',
    '/dungeon',
    '/game/dungeons/action',
    '/dungeons/action'
  ];
  
  for (const path of dungeonPaths) {
    console.log(`\n📍 Testing: ${path}`);
    
    // Try with minimal payload first to see response
    try {
      const response = await api.post(path, { action: 'test' });
      console.log(`✅ ${path} responds! Status: ${response.status}`);
      console.log('Response:', response.data);
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message;
      
      if (status === 400 && message) {
        console.log(`📝 ${path} works but needs proper params: ${message}`);
        if (error.response?.data?.actionToken) {
          console.log(`   Action token provided: ${error.response.data.actionToken}`);
        }
      } else if (status === 404) {
        console.log(`❌ ${path}: Not found`);
      } else if (status === 405) {
        console.log(`🔄 ${path}: Method not allowed`);
      } else {
        console.log(`❓ ${path}: ${status} - ${message}`);
      }
    }
  }
  
  console.log('\n2️⃣ Testing what makes dungeon endpoint work:');
  
  // Now test what makes it actually work
  let actionToken = null;
  
  // Get action token first
  try {
    await api.post('/game/dungeon/action', { action: 'dummy' });
  } catch (error) {
    if (error.response?.data?.actionToken) {
      actionToken = error.response.data.actionToken.toString();
      console.log(`Got action token: ${actionToken}`);
    }
  }
  
  // Test different dungeon types on the working endpoint
  const testTypes = [1, 2, 3, 4, 5];
  
  for (const type of testTypes) {
    console.log(`\n🧪 Testing dungeonType ${type}:`);
    
    const payload = {
      action: 'start_run',
      dungeonType: type,
      actionToken: actionToken
    };
    
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`✅ Type ${type} works! Response:`, response.data);
      
      // Update action token
      if (response.data?.actionToken) {
        actionToken = response.data.actionToken.toString();
      }
      
      return { workingType: type, payload, response: response.data };
      
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message;
      
      console.log(`❌ Type ${type}: ${status} - ${message}`);
      
      // Update token even from errors
      if (error.response?.data?.actionToken) {
        actionToken = error.response.data.actionToken.toString();
      }
      
      // Analyze error messages for clues
      if (message && message.toLowerCase().includes('type')) {
        console.log('   📝 Type-related error - this type might not exist');
      }
      if (message && message.toLowerCase().includes('underhaul')) {
        console.log('   🎯 Underhaul mentioned in error!');
      }
    }
  }
  
  console.log('\n3️⃣ Applying pattern to Underhaul endpoints:');
  
  // Now apply what we learned to potential underhaul paths
  const underhaulVariations = [
    '/game/underhaul/action',    // Direct parallel
    '/underhaul/action',         // Without game prefix 
    '/game/underhaul',           // Without action suffix
    '/underhaul',                // Minimal
    '/game/underhauls/action',   // Plural
    '/underhauls/action'         // Plural without game
  ];
  
  for (const path of underhaulVariations) {
    console.log(`\n🎯 Testing Underhaul: ${path}`);
    
    // Try the same pattern that works for dungeon
    const underhaulPayload = {
      action: 'start_run',
      actionToken: actionToken  
    };
    
    try {
      const response = await api.post(path, underhaulPayload);
      console.log(`✅ BREAKTHROUGH! ${path} works!`);
      console.log('Response:', response.data);
      return { underhaulPath: path, payload: underhaulPayload, response: response.data };
      
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message;
      
      if (status === 400) {
        console.log(`📝 ${path} responds but needs different params: ${message}`);
        
        // If 400, try different payload variations
        const variations = [
          { action: 'start_run' },  // Without action token
          { action: 'start_underhaul' },  // Different action
          { action: 'start_run', dungeonType: 3 },  // With type 3
          { action: 'start_run', type: 'underhaul' },  // With type string
        ];
        
        for (const variation of variations) {
          try {
            const resp = await api.post(path, variation);
            console.log(`   ✅ Variation works:`, variation);
            console.log('   Response:', resp.data);
            return { underhaulPath: path, payload: variation, response: resp.data };
          } catch (err) {
            // Silent - we're just trying variations
          }
        }
      } else if (status === 405) {
        console.log(`🔄 ${path}: Method not allowed (endpoint exists but wrong method)`);
      } else if (status === 404) {
        console.log(`❌ ${path}: Not found`);
      } else {
        console.log(`❓ ${path}: ${status} - ${message}`);
      }
    }
  }
  
  console.log('\n4️⃣ Testing other action types on dungeon endpoint:');
  
  // Maybe there's a special action for underhaul on the dungeon endpoint
  const specialActions = [
    'start_underhaul',
    'underhaul_start', 
    'begin_underhaul',
    'enter_underhaul',
    'switch_underhaul',
    'mode_underhaul',
    'underhaul'
  ];
  
  for (const action of specialActions) {
    try {
      const response = await api.post('/game/dungeon/action', {
        action: action,
        actionToken: actionToken
      });
      console.log(`✅ Special action "${action}" works!`);
      console.log('Response:', response.data);
      return { specialAction: action, response: response.data };
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        console.log(`📝 Action "${action}": ${error.response?.data?.message}`);
      }
    }
  }
  
  return null;
}

// Run analysis
analyzeDungeonPattern()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result) {
      console.log('🎉 FOUND WORKING METHOD!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('📊 Pattern Analysis Complete');
      console.log('\n💡 Key insights:');
      console.log('- Regular dungeon uses /game/dungeon/action');
      console.log('- Requires action + actionToken');
      console.log('- Different dungeonType values control dungeon type');
      console.log('- Underhaul endpoints exist but may need different approach');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });