import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// CRITICAL DISCOVERY: Website uses /api not /game/api!
const CORRECT_BASE_URL = 'https://gigaverse.io/api';
const WRONG_BASE_URL = 'https://gigaverse.io/game/api';  // What we've been using

const JWT = process.env.JWT_TOKEN_1;
let currentActionToken = null;

console.log('🎯 TESTING CORRECT API BASE URL');
console.log('=' .repeat(50));
console.log(`✅ CORRECT: ${CORRECT_BASE_URL}`);  
console.log(`❌ WRONG:   ${WRONG_BASE_URL} (what we used before)`);
console.log('');

const correctApi = axios.create({
  baseURL: CORRECT_BASE_URL,
  headers: {
    'Authorization': `Bearer ${JWT}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://gigaverse.io',
    'Referer': 'https://gigaverse.io/'
  }
});

async function testEndpointWithCorrectBase(endpoint, data, description) {
  console.log(`\n🧪 ${description}`);
  console.log(`📍 Testing: POST ${CORRECT_BASE_URL}${endpoint}`);
  console.log(`📝 Data:`, JSON.stringify(data, null, 2));
  
  try {
    const response = await correctApi.post(endpoint, data);
    console.log(`✅ SUCCESS!`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
    
    // Check if dungeon was created
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const stateCheck = await correctApi.get('/game/dungeon/state');
      const entity = stateCheck.data?.data?.entity;
      const dungeonType = entity?.DUNGEON_TYPE_CID;
      console.log(`🎯 Verification: Dungeon Type=${dungeonType}`);
      
      if (dungeonType === 3) {
        console.log(`🎉 UNDERHAUL SUCCESSFULLY STARTED!`);
        return { success: true, endpoint, dungeonType, baseUrl: CORRECT_BASE_URL };
      } else {
        console.log(`⚠️  Started dungeon ${dungeonType}, not Underhaul (3)`);
      }
    } catch (verifyError) {
      console.log(`❓ Could not verify: ${verifyError.message}`);
    }
    
    return { success: true, endpoint, baseUrl: CORRECT_BASE_URL };
    
  } catch (error) {
    console.log(`❌ Failed`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log(`   📝 Saved action token: ${currentActionToken}`);
      }
    } else {
      console.log(`   Network Error: ${error.message}`);
    }
    return { success: false, endpoint, error: error.response?.data || error.message };
  }
}

async function main() {
  if (!JWT) {
    console.log('❌ No JWT token found. Please provide fresh tokens.');
    return;
  }

  // Test authentication first
  try {
    console.log('\n🔐 Testing authentication with correct base URL...');
    const authTest = await correctApi.get('/user/me');
    console.log('✅ Authentication successful with correct base URL!');
  } catch (error) {
    console.log(`❌ Auth failed: ${error.response?.status || error.message}`);
    if (error.response?.status === 401) {
      console.log('JWT token needs to be refreshed');
      return;
    }
  }

  // Check current dungeon state  
  try {
    console.log('\n📍 Checking current state...');
    const state = await correctApi.get('/game/dungeon/state');
    if (state.data?.data?.run) {
      const entity = state.data.data.entity;
      console.log(`⚠️  Active dungeon type ${entity?.DUNGEON_TYPE_CID}, ID ${entity?.DUNGEON_ID_CID}`);
      console.log('   Cannot start new dungeon with active one');
      return;
    }
  } catch (error) {
    console.log('✅ No active dungeon (expected)');
  }

  const baseData = {
    isJuiced: false,
    consumables: [],
    itemId: 0,
    index: 0,
    gearInstanceIds: []
  };

  // Test most likely endpoints with CORRECT base URL
  const endpointsToTest = [
    {
      endpoint: '/game/dungeon/action',
      data: {
        action: 'start_run',
        dungeonType: 3,
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'BASELINE: /game/dungeon/action with correct base URL'
    },
    {
      endpoint: '/dungeon/action', 
      data: {
        action: 'start_run',
        dungeonType: 3,
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'TEST: /dungeon/action (no /game prefix)'
    },
    {
      endpoint: '/underhaul/action',
      data: {
        action: 'start_run',
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'TEST: /underhaul/action'
    },
    {
      endpoint: '/game/underhaul/action',
      data: {
        action: 'start_run',
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'TEST: /game/underhaul/action'
    },
    {
      endpoint: '/underhaul/start',
      data: {
        action: 'start_run',
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'TEST: /underhaul/start'
    }
  ];

  console.log('\n🎯 TESTING ENDPOINTS WITH CORRECT BASE URL:');
  
  const results = [];
  for (const test of endpointsToTest) {
    const result = await testEndpointWithCorrectBase(test.endpoint, test.data, test.description);
    results.push(result);
    
    if (result.success && result.dungeonType === 3) {
      console.log(`\n🎉 FOUND THE CORRECT ENDPOINT!`);
      console.log(`   Full URL: ${CORRECT_BASE_URL}${test.endpoint}`);
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n📊 FINAL RESULTS:');
  console.log('=' .repeat(40));
  
  const successful = results.filter(r => r.success);
  const underwaulSuccess = results.find(r => r.success && r.dungeonType === 3);
  
  if (underwaulSuccess) {
    console.log(`🎉 SUCCESS! Found working Underhaul endpoint:`);
    console.log(`   ${CORRECT_BASE_URL}${underwaulSuccess.endpoint}`);
  } else if (successful.length > 0) {
    console.log(`⚠️  Found working endpoints but they don't start Underhaul:`);
    successful.forEach(r => {
      console.log(`   ✅ ${CORRECT_BASE_URL}${r.endpoint}`);
    });
  } else {
    console.log(`❌ No working endpoints found even with correct base URL`);
  }
  
  console.log(`\nKEY DISCOVERY: Website uses ${CORRECT_BASE_URL}, not ${WRONG_BASE_URL}`);
}

main().catch(console.error);