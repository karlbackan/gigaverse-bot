import axios from 'axios';
import { config, validateConfig } from './config.mjs';

validateConfig();

// Track server time offset
let serverTimeOffset = 0;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${config.jwtToken}`,
    'Content-Type': 'application/json'
  }
});

// Add response interceptor to capture server time
api.interceptors.response.use(response => {
  if (response.headers.date) {
    const serverTime = new Date(response.headers.date).getTime();
    const localTime = Date.now();
    serverTimeOffset = serverTime - localTime;
    console.log(`Server time offset: ${serverTimeOffset}ms`);
  }
  return response;
});

async function testWithServerTime() {
  console.log('Testing with server-synced timestamp...\n');
  
  // First request to get server time
  const stateResponse = await api.get('/game/dungeon/state');
  const state = stateResponse.data?.data;
  
  if (!state?.run) {
    console.log('No active dungeon run.');
    return;
  }
  
  // Calculate server timestamp
  const serverTimestamp = Date.now() + serverTimeOffset;
  console.log(`Local time: ${Date.now()}`);
  console.log(`Server time: ${serverTimestamp}`);
  console.log(`Offset: ${serverTimeOffset}ms`);
  
  if (!state.run.lootPhase) {
    console.log('\nTesting combat with server timestamp...');
    
    try {
      const response = await api.post('/game/dungeon/action', {
        action: 'paper',
        dungeonType: 3,
        actionToken: serverTimestamp.toString(),
        data: {}
      });
      console.log('✅ Success:', response.data.message);
    } catch (error) {
      console.log('❌ Failed:', error.response?.data?.message || error.message);
      if (error.response?.data?.actionToken) {
        console.log('Expected token:', error.response.data.actionToken);
      }
    }
  } else {
    console.log('\nTesting loot with server timestamp...');
    
    try {
      const response = await api.post('/game/dungeon/action', {
        action: 'loot_one',
        dungeonType: 3,
        actionToken: serverTimestamp.toString()
      });
      console.log('✅ Success:', response.data.message);
    } catch (error) {
      console.log('❌ Failed:', error.response?.data?.message || error.message);
      
      // Try using the timestamp from when we fetched state
      const stateTimestamp = new Date(stateResponse.headers.date).getTime();
      console.log(`\nTrying with state fetch timestamp: ${stateTimestamp}`);
      
      try {
        const response2 = await api.post('/game/dungeon/action', {
          action: 'loot_one',
          dungeonType: 3,
          actionToken: stateTimestamp.toString()
        });
        console.log('✅ Success with state timestamp!:', response2.data.message);
      } catch (error2) {
        console.log('❌ Failed:', error2.response?.data?.message || error2.message);
      }
    }
  }
}

testWithServerTime().catch(console.error);