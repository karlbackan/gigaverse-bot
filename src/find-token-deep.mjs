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

async function findTokenDeep() {
  console.log('Deep search for action token...\n');
  
  // Test multiple endpoints that might have the token
  const endpoints = [
    '/game/dungeon/state',
    '/game/dungeon/today',
    `/offchain/player/activeDungeon/${config.walletAddress}`,
    `/account/${config.walletAddress}`
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nChecking ${endpoint}...`);
    try {
      const response = await api.get(endpoint);
      
      // Deep search for any numeric field that could be the token
      function findNumericFields(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          // Look for the specific token value or similar large numbers
          if (typeof value === 'number' && value > 1000000000000) {
            console.log(`  Found large number at ${currentPath}: ${value}`);
            
            // Check if this could be our token (timestamp-like)
            const now = Date.now();
            if (Math.abs(value - now) < 86400000) { // Within 24 hours
              console.log(`    ⭐ This looks like a recent timestamp!`);
            }
          }
          
          if (value && typeof value === 'object') {
            findNumericFields(value, currentPath);
          }
        }
      }
      
      findNumericFields(response.data);
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  // Also check if the token is the current timestamp
  console.log('\n\nToken analysis:');
  const expectedToken = 1752956561900;
  const tokenDate = new Date(expectedToken);
  console.log(`Expected token: ${expectedToken}`);
  console.log(`As date: ${tokenDate.toISOString()}`);
  console.log(`Current time: ${Date.now()}`);
  console.log(`Difference: ${Date.now() - expectedToken}ms`);
}

findTokenDeep().catch(console.error);