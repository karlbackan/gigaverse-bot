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

async function checkActionToken() {
  console.log('Checking action token location...\n');
  
  const response = await api.get('/game/dungeon/state');
  console.log('Full response structure:');
  console.log(JSON.stringify(response.data, null, 2));
  
  console.log('\n\nSearching for actionToken...');
  
  // Search for actionToken in the response
  function findKey(obj, keyName, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (key === keyName || key.toLowerCase().includes('token')) {
        console.log(`Found "${key}" at: ${currentPath} = ${JSON.stringify(value)}`);
      }
      
      if (value && typeof value === 'object') {
        findKey(value, keyName, currentPath);
      }
    }
  }
  
  findKey(response.data, 'actionToken');
}

checkActionToken().catch(console.error);