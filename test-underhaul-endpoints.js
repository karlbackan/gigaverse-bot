import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Will test with fresh JWT tokens
const JWT = process.env.JWT_TOKEN_1; 
let currentActionToken = null;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${JWT}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://gigaverse.io',
    'Referer': 'https://gigaverse.io/'
  }
});

async function testEndpoint(endpoint, data, description) {
  console.log(`\n🧪 ${description}`);
  console.log(`📍 Testing: POST ${endpoint}`);
  console.log(`📝 Data:`, JSON.stringify(data, null, 2));
  
  try {
    const response = await api.post(endpoint, data);
    console.log(`✅ SUCCESS! ${endpoint} worked!`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
    
    // Check what actually started
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const stateCheck = await api.get('/game/dungeon/state');
      const entity = stateCheck.data?.data?.entity;
      const dungeonType = entity?.DUNGEON_TYPE_CID;
      const dungeonId = entity?.DUNGEON_ID_CID;
      console.log(`🎯 Verification: Dungeon Type=${dungeonType}, ID=${dungeonId}`);
      
      if (dungeonType === 3) {
        console.log(`🎉 UNDERHAUL SUCCESSFULLY STARTED! We found the correct endpoint!`);
        return { success: true, endpoint, dungeonType, response: response.data };
      } else {
        console.log(`⚠️  Started dungeon ${dungeonType}, not Underhaul (3)`);
      }
    } catch (verifyError) {
      console.log(`❓ Could not verify dungeon state: ${verifyError.message}`);
    }
    
    return { success: true, endpoint, response: response.data };
    
  } catch (error) {
    console.log(`❌ ${endpoint} failed`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error:`, JSON.stringify(error.response.data, null, 2));
      
      // Save action token if provided
      if (error.response.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log(`   📝 Saved action token: ${currentActionToken}`);
      }
      
      return { success: false, endpoint, status: error.response.status, error: error.response.data };
    } else {
      console.log(`   Network Error: ${error.message}`);
      return { success: false, endpoint, error: error.message };
    }
  }
}

async function main() {
  console.log('🎯 TESTING MOST LIKELY UNDERHAUL ENDPOINTS');
  console.log('=' .repeat(50));
  
  if (!JWT) {
    console.log('❌ No JWT token found. Please provide fresh tokens.');
    return;
  }

  // Check if we can authenticate at all
  console.log('\n🔐 Authentication Check:');
  try {
    await api.get('/game/dungeon/today');
    console.log('✅ JWT token is valid');
  } catch (error) {
    console.log(`❌ JWT token failed: ${error.response?.status || error.message}`);
    return;
  }

  // Check current state
  console.log('\n📍 Current State Check:');
  try {
    const state = await api.get('/game/dungeon/state');
    if (state.data?.data?.run) {
      const entity = state.data.data.entity;
      console.log(`⚠️  Account has active dungeon type ${entity?.DUNGEON_TYPE_CID}, ID ${entity?.DUNGEON_ID_CID}`);
      console.log('   Cannot start new dungeon. This test requires a clean account.');
      return;
    } else {
      console.log('✅ No active dungeon - ready to test');
    }
  } catch (error) {
    console.log('✅ No active dungeon (404 expected)');
  }

  const baseData = {
    isJuiced: false,
    consumables: [],
    itemId: 0,
    index: 0,
    gearInstanceIds: []
  };

  // HIGHEST PRIORITY TESTS - Most likely correct endpoints
  const highPriorityTests = [
    {
      endpoint: '/game/underhaul/action',
      data: {
        action: 'start_run',
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'HIGHEST PRIORITY: /game/underhaul/action (following API pattern)'
    },
    {
      endpoint: '/game/underhaul/start',
      data: {
        action: 'start_run',
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'HIGH PRIORITY: /game/underhaul/start'
    },
    {
      endpoint: '/game/dungeon/underhaul',
      data: {
        action: 'start_run',
        data: baseData,
        actionToken: currentActionToken
      },
      description: 'HIGH PRIORITY: /game/dungeon/underhaul'
    }
  ];

  console.log('\n🎯 RUNNING HIGH PRIORITY TESTS:');
  
  const results = [];
  for (const test of highPriorityTests) {
    const result = await testEndpoint(test.endpoint, test.data, test.description);
    results.push(result);
    
    if (result.success && result.dungeonType === 3) {
      console.log(`\n🎉 FOUND IT! ${test.endpoint} successfully starts Underhaul!`);
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
  }

  // Additional tests if high priority ones fail
  const additionalTests = [
    {
      endpoint: '/underhaul/start',
      data: { ...baseData, action: 'start_run' },
      description: 'Alternative: /underhaul/start'
    },
    {
      endpoint: '/game/underhaul/new',
      data: { action: 'start_run', data: baseData },
      description: 'Alternative: /game/underhaul/new'
    },
    {
      endpoint: '/game/dungeon/action',
      data: {
        action: 'start_underhaul',  // Different action name
        dungeonType: 3,
        data: baseData
      },
      description: 'Alternative: Different action name (start_underhaul)'
    }
  ];

  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length === 0) {
    console.log('\n🔄 RUNNING ADDITIONAL TESTS:');
    for (const test of additionalTests) {
      const result = await testEndpoint(test.endpoint, test.data, test.description);
      results.push(result);
      
      if (result.success && result.dungeonType === 3) {
        console.log(`\n🎉 FOUND IT! ${test.endpoint} successfully starts Underhaul!`);
        break;
      }
    }
  }

  // Summary
  console.log('\n📊 FINAL RESULTS:');
  console.log('=' .repeat(40));
  
  const successful = results.filter(r => r.success);
  const underwaulSuccess = results.find(r => r.success && r.dungeonType === 3);
  
  if (underwaulSuccess) {
    console.log(`🎉 SUCCESS! Underhaul endpoint found: ${underwaulSuccess.endpoint}`);
    console.log(`   This endpoint successfully starts Underhaul (dungeon type 3)`);
  } else if (successful.length > 0) {
    console.log(`⚠️  Found working endpoints but they don't start Underhaul:`);
    successful.forEach(r => {
      console.log(`   ✅ ${r.endpoint} - works but starts dungeon type ${r.dungeonType || 'unknown'}`);
    });
  } else {
    console.log(`❌ No working endpoints found for Underhaul`);
    console.log(`   This confirms server-side blocking or missing prerequisite`);
  }
  
  console.log(`\nTested ${results.length} endpoint variations`);
}

main().catch(console.error);