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

// Store all headers and cookies
let allHeaders = new Set();
let actionToken = null;

// Add interceptors to capture all headers
api.interceptors.request.use(request => {
  console.log('\n=== REQUEST ===');
  console.log(`${request.method.toUpperCase()} ${request.url}`);
  return request;
});

api.interceptors.response.use(response => {
  console.log('\n=== RESPONSE ===');
  console.log('Status:', response.status);
  console.log('Headers:');
  for (const [key, value] of Object.entries(response.headers)) {
    console.log(`  ${key}: ${value}`);
    allHeaders.add(key);
    
    // Look for anything token-related
    if (key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('session') ||
        key.toLowerCase().includes('action')) {
      console.log(`  ^^^ FOUND POTENTIAL TOKEN HEADER!`);
    }
  }
  
  // Check response data for token
  if (response.data) {
    findTokenInData(response.data, 'response.data');
  }
  
  return response;
});

function findTokenInData(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Look for token-like fields
    if (key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('action') ||
        key === 'actionToken' ||
        (typeof value === 'number' && value > 1000000000000 && value < 2000000000000)) {
      console.log(`\n🔍 Found potential token at ${currentPath}: ${value}`);
      if (key === 'actionToken' || (typeof value === 'number' && value > 1752900000000)) {
        actionToken = value;
        console.log(`  ⭐ Saved as actionToken!`);
      }
    }
    
    if (value && typeof value === 'object') {
      findTokenInData(value, currentPath);
    }
  }
}

async function testFlow() {
  console.log('Testing complete flow to find action token...\n');
  
  // 1. Get state
  console.log('1. Getting dungeon state...');
  const stateResponse = await api.get('/game/dungeon/state');
  
  // 2. Try action without token
  console.log('\n2. Trying action without token...');
  try {
    const response1 = await api.post('/game/dungeon/action', {
      action: 'paper',
      dungeonType: 3,
      data: {}
    });
    console.log('✅ First action succeeded!');
  } catch (error) {
    console.log('❌ First action failed:', error.response?.data?.message);
    if (error.response?.data) {
      findTokenInData(error.response.data, 'error.response.data');
    }
  }
  
  // 3. Try second action
  console.log('\n3. Trying second action...');
  try {
    const response2 = await api.post('/game/dungeon/action', {
      action: 'scissor',
      dungeonType: 3,
      data: {}
    });
    console.log('✅ Second action succeeded!');
  } catch (error) {
    console.log('❌ Second action failed:', error.response?.data?.message);
    if (error.response?.data) {
      findTokenInData(error.response.data, 'error.response.data');
    }
  }
  
  // 4. If we found a token, try using it
  if (actionToken) {
    console.log(`\n4. Trying with found token: ${actionToken}`);
    try {
      const response3 = await api.post('/game/dungeon/action', {
        action: 'rock',
        dungeonType: 3,
        actionToken: actionToken.toString(),
        data: {}
      });
      console.log('✅ Action with token succeeded!');
    } catch (error) {
      console.log('❌ Action with token failed:', error.response?.data?.message);
    }
  }
  
  console.log('\n\n=== All unique headers seen ===');
  for (const header of allHeaders) {
    console.log(`  ${header}`);
  }
}

testFlow().catch(console.error);