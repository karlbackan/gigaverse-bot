import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const JWT = process.env.JWT_TOKEN_1;
let currentActionToken = null;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${JWT}`,
    'User-Agent': 'Gigaverse-Bot/1.0',
    'Content-Type': 'application/json'
  }
});

async function testDungeonId() {
  console.log('🔍 Testing dungeonId instead of dungeonType (from SDK analysis)');
  console.log('=' .repeat(60));

  // First get current state to grab any action token
  try {
    const stateRes = await api.get('/game/dungeon/state');
    console.log('Current dungeon state fetched successfully');
  } catch (error) {
    console.log('No active dungeon (expected)');
  }

  // Test the SDK pattern: dungeonId instead of dungeonType
  const requestData = {
    action: 'start_run',
    dungeonId: 3,  // SDK uses dungeonId, not dungeonType!
    data: {
      consumables: [],
      itemId: 0,
      index: 0,
      isJuiced: false,
      gearInstanceIds: []
    }
  };

  if (currentActionToken) {
    requestData.actionToken = currentActionToken;
  }

  console.log('\n📤 Request with dungeonId (SDK pattern):');
  console.log(JSON.stringify(requestData, null, 2));

  try {
    const response = await api.post('/game/dungeon/action', requestData);
    console.log('\n✅ SUCCESS! dungeonId worked!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Check what actually started
    try {
      const stateCheck = await api.get('/game/dungeon/state');
      const dungeonType = stateCheck.data?.data?.entity?.DUNGEON_TYPE_CID;
      console.log(`\n🎯 Actual dungeon type started: ${dungeonType}`);
      if (dungeonType === 3) {
        console.log('🎉 UNDERHAUL SUCCESSFULLY STARTED!');
      } else {
        console.log(`⚠️  Started dungeon ${dungeonType}, not Underhaul (3)`);
      }
    } catch {
      console.log('Could not verify dungeon state');
    }
    
  } catch (error) {
    console.log('\n❌ dungeonId also failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log('Saved action token:', currentActionToken);
      }
    } else {
      console.log('Network Error:', error.message);
    }
  }

  // Also test variations found in SDK
  console.log('\n🔄 Testing other SDK patterns...');
  
  const sdkVariations = [
    // Different dungeonId values
    { ...requestData, dungeonId: 0 },  // SDK sometimes uses 0
    { ...requestData, dungeonId: "3" }, // String version
    
    // Different data structure (closer to SDK)
    {
      action: 'start_run',
      dungeonId: 3,
      consumables: [],
      itemId: 0,
      index: 0,
      isJuiced: false,
      gearInstanceIds: []
    }
  ];

  for (const variation of sdkVariations) {
    console.log(`\nTesting variation:`, JSON.stringify(variation, null, 2));
    try {
      const response = await api.post('/game/dungeon/action', variation);
      console.log('✅ Variation SUCCESS!', response.data);
    } catch (error) {
      console.log('❌ Variation failed:', error.response?.data?.message || error.message);
    }
  }
}

testDungeonId().catch(console.error);