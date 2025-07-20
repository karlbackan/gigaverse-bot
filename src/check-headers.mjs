import axios from 'axios';
import { config, validateConfig } from './config.mjs';

validateConfig();

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${config.jwtToken}`,
    'Content-Type': 'application/json'
  }
});

async function checkHeaders() {
  console.log('Checking response headers for action token...\n');
  
  const response = await api.get('/game/dungeon/state');
  
  console.log('Response headers:');
  for (const [key, value] of Object.entries(response.headers)) {
    console.log(`  ${key}: ${value}`);
  }
  
  // Try using current timestamp as action token
  console.log('\n\nTesting with current timestamp as action token...');
  
  const state = response.data?.data;
  if (!state?.run) {
    console.log('No active dungeon run.');
    return;
  }
  
  if (!state.run.lootPhase) {
    const actionToken = Date.now().toString();
    console.log(`Using timestamp as token: ${actionToken}`);
    
    try {
      const actionResponse = await api.post('/game/dungeon/action', {
        action: 'paper',
        dungeonType: 3,
        actionToken: actionToken,
        data: {}
      });
      console.log('✅ Success with timestamp token!:', actionResponse.data.message);
    } catch (error) {
      console.log('❌ Failed:', error.response?.data?.message || error.message);
      
      // Try without converting to string
      console.log('\nTrying with numeric timestamp...');
      try {
        const actionResponse2 = await api.post('/game/dungeon/action', {
          action: 'paper',
          dungeonType: 3,
          actionToken: Date.now(),
          data: {}
        });
        console.log('✅ Success with numeric timestamp!:', actionResponse2.data.message);
      } catch (error2) {
        console.log('❌ Failed:', error2.response?.data?.message || error2.message);
      }
    }
  }
}

checkHeaders().catch(console.error);