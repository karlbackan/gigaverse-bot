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

console.log('🔍 Exploring Alternative Underhaul Access Methods\n');
console.log('=' .repeat(60));

async function exploreAlternatives() {
  // 1. Try GraphQL mutations for Underhaul
  console.log('\n1️⃣ Testing GraphQL mutations:');
  
  const graphqlQueries = [
    {
      query: `mutation { startUnderhaul { success message } }`
    },
    {
      query: `mutation { underhaul { start } }`
    },
    {
      query: `mutation StartUnderhaul($type: Int) { startDungeon(type: $type) }`,
      variables: { type: 3 }
    },
    {
      query: `mutation { gameAction(action: "start_underhaul") }`
    }
  ];
  
  const graphqlEndpoints = [
    'https://gigaverse.io/api/graphql',
    'https://gigaverse.io/graphql',
    'https://gigaverse.io/api/gql',
    'https://gigaverse.io/gql'
  ];
  
  for (const endpoint of graphqlEndpoints) {
    for (const gqlQuery of graphqlQueries) {
      try {
        const response = await axios.post(endpoint, gqlQuery, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`✅ GraphQL works! ${endpoint}`);
        console.log('Response:', response.data);
        return { type: 'GraphQL', endpoint, data: response.data };
      } catch (error) {
        const status = error.response?.status;
        if (status !== 404 && status !== 405) {
          console.log(`🤔 ${endpoint}: ${status} - ${error.response?.data?.message}`);
        }
      }
    }
  }
  
  // 2. Try different game action endpoints
  console.log('\n2️⃣ Testing alternative game action endpoints:');
  
  const gameEndpoints = [
    '/game/action',
    '/game/start',
    '/game/play',
    '/action',
    '/start',
    '/play',
    '/game/actions',
    '/actions',
    '/game/begin',
    '/begin',
    '/game/enter',
    '/enter'
  ];
  
  const actionPayloads = [
    { action: 'start_underhaul' },
    { action: 'underhaul_start' },
    { action: 'enter_underhaul' },
    { action: 'begin_underhaul' },
    { action: 'underhaul' },
    { action: 'start', mode: 'underhaul' },
    { action: 'start', type: 'underhaul' },
    { start_underhaul: true },
    { underhaul: { action: 'start' } },
    { game: 'underhaul', action: 'start' }
  ];
  
  for (const endpoint of gameEndpoints) {
    for (const payload of actionPayloads) {
      try {
        const response = await api.post(endpoint, payload);
        console.log(`✅ ${endpoint} works with payload:`, payload);
        console.log('Response:', response.data);
        return { type: 'GameAction', endpoint, payload, data: response.data };
      } catch (error) {
        const status = error.response?.status;
        if (status === 400) {
          console.log(`📝 ${endpoint}: Bad Request - might be close!`);
          console.log('   Error:', error.response?.data?.message);
        }
      }
    }
  }
  
  // 3. Try batch endpoints with underhaul
  console.log('\n3️⃣ Testing batch endpoints for underhaul:');
  
  const batchEndpoints = ['/api/batch', '/api/bulk', '/api/multi'];
  const batchPayloads = [
    {
      requests: [
        { url: '/underhaul/start', method: 'POST' },
        { url: '/game/underhaul/start', method: 'POST' }
      ]
    },
    {
      operations: [
        { type: 'start_underhaul' }
      ]
    }
  ];
  
  for (const endpoint of batchEndpoints) {
    for (const payload of batchPayloads) {
      try {
        const response = await api.post(endpoint, payload);
        console.log(`✅ Batch endpoint works! ${endpoint}`);
        console.log('Response:', response.data);
        return { type: 'Batch', endpoint, payload, data: response.data };
      } catch (error) {
        const status = error.response?.status;
        if (status === 400) {
          console.log(`📝 ${endpoint}: Bad Request - ${error.response?.data?.message}`);
        }
      }
    }
  }
  
  // 4. Try different subdomain patterns
  console.log('\n4️⃣ Testing subdomain patterns:');
  
  const subdomains = ['api', 'game', 'underhaul', 'play', 'app'];
  
  for (const subdomain of subdomains) {
    const urls = [
      `https://${subdomain}.gigaverse.io/underhaul/start`,
      `https://${subdomain}.gigaverse.io/api/underhaul/start`,
      `https://${subdomain}.gigaverse.io/underhaul/action`,
      `https://${subdomain}.gigaverse.io/start/underhaul`
    ];
    
    for (const url of urls) {
      try {
        const response = await axios.post(url, 
          { action: 'start_run' },
          { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Subdomain works! ${url}`);
        console.log('Response:', response.data);
        return { type: 'Subdomain', url, data: response.data };
      } catch (error) {
        // Only log non-connection errors
        if (error.code !== 'ENOTFOUND' && error.response?.status !== 404) {
          console.log(`🤔 ${url}: ${error.response?.status}`);
        }
      }
    }
  }
  
  // 5. Try WebSocket for real-time game commands
  console.log('\n5️⃣ Testing WebSocket approaches:');
  
  // We can't do full WebSocket in this script, but we can test upgrade attempts
  const wsEndpoints = [
    'https://gigaverse.io/ws',
    'https://gigaverse.io/websocket',
    'https://gigaverse.io/api/ws',
    'https://gigaverse.io/game/ws'
  ];
  
  for (const wsEndpoint of wsEndpoints) {
    try {
      const response = await axios.get(wsEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version': '13'
        }
      });
    } catch (error) {
      if (error.response?.status === 426) {
        console.log(`✅ WebSocket upgrade available at ${wsEndpoint}`);
        return { type: 'WebSocket', endpoint: wsEndpoint };
      }
    }
  }
  
  // 6. Try different HTTP methods on broader paths
  console.log('\n6️⃣ Testing unconventional HTTP methods:');
  
  const customMethods = ['CONNECT', 'OPTIONS', 'LOCK', 'UNLOCK', 'PROPFIND'];
  const testEndpoint = 'https://gigaverse.io/api/underhaul';
  
  for (const method of customMethods) {
    try {
      const response = await axios({
        method: method,
        url: testEndpoint,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log(`✅ Method ${method} works!`);
      console.log('Response:', response.data);
      return { type: 'CustomMethod', method, data: response.data };
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404 && status !== 405 && status !== 501) {
        console.log(`🤔 ${method}: ${status}`);
      }
    }
  }
  
  // 7. Try session/state management first
  console.log('\n7️⃣ Testing session initialization:');
  
  const initEndpoints = [
    { path: '/session/init', data: { game_mode: 'underhaul' } },
    { path: '/game/init', data: { mode: 'underhaul' } },
    { path: '/player/init', data: { underhaul: true } },
    { path: '/init/underhaul', data: {} },
    { path: '/api/session/create', data: { type: 'underhaul' } }
  ];
  
  for (const init of initEndpoints) {
    try {
      const response = await api.post(init.path, init.data);
      console.log(`✅ Session init works! ${init.path}`);
      console.log('Response:', response.data);
      
      // If session init works, try underhaul action after
      try {
        const underhaulResponse = await api.post('/game/underhaul/action', {
          action: 'start_run'
        });
        console.log('✅ Underhaul now works after session init!');
        return { type: 'SessionInit', init: init.path, data: underhaulResponse.data };
      } catch (error) {
        console.log('Underhaul still fails after session init');
      }
      
      return { type: 'SessionInit', endpoint: init.path, data: response.data };
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        console.log(`📝 ${init.path}: Bad Request - ${error.response?.data?.message}`);
      }
    }
  }
  
  return null;
}

// Run exploration
exploreAlternatives()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result) {
      console.log('🎉 BREAKTHROUGH! Found working method:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ No alternative methods found');
      console.log('\n💡 Additional ideas to try:');
      console.log('1. Check if there are query parameters needed');
      console.log('2. Look for different authentication scopes');
      console.log('3. Try different user agents or client identifiers');
      console.log('4. Check if account needs special permissions');
      console.log('5. Look for feature flags or beta access');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });