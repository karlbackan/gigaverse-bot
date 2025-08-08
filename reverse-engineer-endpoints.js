import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const JWT = process.env.JWT_TOKEN_1;
let currentActionToken = null;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${JWT}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://gigaverse.io',
    'Referer': 'https://gigaverse.io/'
  }
});

async function testEndpoint(endpoint, data, method = 'POST') {
  console.log(`\n🧪 Testing ${method} ${endpoint}`);
  console.log(`📝 Data:`, JSON.stringify(data, null, 2));
  
  try {
    const response = method === 'POST' 
      ? await api.post(endpoint, data)
      : await api.get(endpoint);
    
    console.log(`✅ SUCCESS!`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`❌ Failed`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error:`, JSON.stringify(error.response.data, null, 2));
      
      // Save action token if provided
      if (error.response.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log(`   📝 Saved action token: ${currentActionToken}`);
      }
    } else {
      console.log(`   Network Error: ${error.message}`);
    }
    return { success: false, error: error.response?.data || error.message };
  }
}

async function main() {
  console.log('🕵️  Reverse Engineering Underhaul API Endpoints');
  console.log('=' .repeat(50));

  // Check current state first
  console.log('\n📍 STEP 1: Check current account state');
  await testEndpoint('/game/dungeon/state', null, 'GET');
  await testEndpoint('/game/dungeon/today', null, 'GET');
  
  // Test different endpoint patterns for Underhaul
  const endpointsToTest = [
    // Different action endpoints
    '/game/dungeon/action',
    '/game/underhaul/action', 
    '/game/dungeon/start',
    '/game/dungeon/new',
    '/game/dungeon/begin',
    '/game/action',
    '/underhaul/start',
    '/underhaul/action',
    '/dungeon/underhaul/start',
    
    // Version specific
    '/v1/game/dungeon/action',
    '/v2/game/dungeon/action',
    '/v1/underhaul/start',
    
    // Alternative patterns
    '/gameplay/dungeon/start',
    '/gameplay/underhaul/start',
    '/api/game/dungeon/action',
    '/api/underhaul/start'
  ];

  console.log('\n📍 STEP 2: Test different endpoint patterns');
  
  for (const endpoint of endpointsToTest) {
    // Test with dungeonType: 3
    await testEndpoint(endpoint, {
      action: 'start_run',
      dungeonType: 3,
      data: {
        isJuiced: false,
        consumables: [],
        itemId: 0,
        index: 0,
        gearInstanceIds: []
      },
      actionToken: currentActionToken
    });
    
    // Test with dungeonId instead of dungeonType (SDK uses this)
    await testEndpoint(endpoint, {
      action: 'start_run',
      dungeonId: 3,  // SDK uses dungeonId instead
      data: {
        isJuiced: false,
        consumables: [],
        itemId: 0,
        index: 0,
        gearInstanceIds: []
      },
      actionToken: currentActionToken
    });
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }

  console.log('\n📍 STEP 3: Test different action names');
  const actions = ['start_run', 'start_underhaul', 'begin_underhaul', 'create_run', 'new_run'];
  
  for (const action of actions) {
    await testEndpoint('/game/dungeon/action', {
      action: action,
      dungeonType: 3,
      data: {
        isJuiced: false,
        consumables: [],
        itemId: 0,
        index: 0,
        gearInstanceIds: []
      },
      actionToken: currentActionToken
    });
  }

  console.log('\n📍 STEP 4: Test GraphQL endpoint');
  await testEndpoint('/graphql', {
    query: `mutation StartUnderhaul($input: StartUnderhaulInput!) {
      startUnderhaul(input: $input) {
        success
        dungeonId
      }
    }`,
    variables: {
      input: {
        dungeonType: 3,
        isJuiced: false,
        consumables: [],
        gearInstanceIds: []
      }
    }
  });

  console.log('\n📍 STEP 5: Test different HTTP methods');
  const testData = {
    dungeonType: 3,
    isJuiced: false,
    consumables: [],
    itemId: 0,
    index: 0,
    gearInstanceIds: []
  };

  await testEndpoint('/game/dungeon/3/start', testData);
  await testEndpoint('/game/dungeon/underhaul/start', testData);
  await testEndpoint('/game/underhaul/3/start', testData);

  console.log('\n📍 CONCLUSION: Check which endpoint worked (if any)');
  console.log('If none worked, the API restriction is confirmed to be server-side.');
}

main().catch(console.error);