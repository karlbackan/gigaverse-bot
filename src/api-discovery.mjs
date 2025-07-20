import axios from 'axios';
import { config, validateConfig } from './config.mjs';

console.log('=== Gigaverse API Reverse Engineering ===\n');

validateConfig();

const api = axios.create({
  baseURL: 'https://gigaverse.io',
  headers: {
    'Authorization': `Bearer ${config.jwtToken}`,
    'Content-Type': 'application/json'
  },
  validateStatus: () => true // Don't throw on any status
});

// Common API paths to test
const commonPaths = [
  // Documentation
  '/api', '/api/docs', '/api/swagger', '/api/help', '/api/v1', '/api/v2',
  '/docs', '/swagger', '/swagger.json', '/openapi.json',
  
  // Game paths
  '/api/game', '/api/games', '/api/dungeon', '/api/dungeons',
  '/api/player', '/api/players', '/api/user', '/api/users',
  '/api/account', '/api/accounts', '/api/profile',
  
  // Resources
  '/api/items', '/api/inventory', '/api/gear', '/api/weapons',
  '/api/skills', '/api/stats', '/api/energy', '/api/health',
  
  // Actions
  '/api/actions', '/api/moves', '/api/combat', '/api/battle',
  '/api/loot', '/api/rewards', '/api/upgrade', '/api/shop',
  
  // Other game features
  '/api/fishing', '/api/crafting', '/api/recipes', '/api/marketplace',
  '/api/roms', '/api/factions', '/api/guilds', '/api/leaderboard',
  
  // Status/info
  '/api/status', '/api/info', '/api/version', '/api/health',
  '/api/ping', '/api/maintenance', '/api/news', '/api/events'
];

// Test methods on each path
const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

async function testEndpoint(path, method = 'GET') {
  try {
    const response = await api({
      method,
      url: path,
      timeout: 5000
    });
    
    return {
      path,
      method,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    };
  } catch (error) {
    return {
      path,
      method,
      error: error.message
    };
  }
}

async function discoverEndpoints() {
  console.log('1. Testing common API paths...\n');
  
  const results = [];
  
  for (const path of commonPaths) {
    const result = await testEndpoint(path);
    
    if (result.status && result.status !== 404) {
      console.log(`✓ ${path} - ${result.status} ${result.statusText}`);
      results.push(result);
    }
  }
  
  console.log('\n2. Testing known working endpoints...\n');
  
  // Test endpoints we know work
  const knownEndpoints = [
    '/api/game/dungeon/state',
    '/api/game/dungeon/action',
    '/api/game/dungeon/today',
    '/api/offchain/player/energy/' + config.walletAddress,
    '/api/account/' + config.walletAddress,
    '/api/indexer/enemies',
    '/api/offchain/gameitems',
    '/api/offchain/skills',
    '/api/gear/items',
    '/api/marketplace/item/floor/all'
  ];
  
  for (const endpoint of knownEndpoints) {
    const result = await testEndpoint(endpoint);
    if (result.status === 200) {
      console.log(`✓ ${endpoint} - Works!`);
      results.push(result);
    } else {
      console.log(`✗ ${endpoint} - ${result.status}`);
    }
  }
  
  console.log('\n3. Testing OPTIONS on working endpoints...\n');
  
  // Test OPTIONS to see allowed methods
  for (const result of results.filter(r => r.status === 200)) {
    const optionsResult = await testEndpoint(result.path, 'OPTIONS');
    if (optionsResult.headers && optionsResult.headers['allow']) {
      console.log(`${result.path} allows: ${optionsResult.headers['allow']}`);
    }
  }
  
  console.log('\n4. Analyzing response headers for clues...\n');
  
  // Look for interesting headers
  const interestingHeaders = ['x-powered-by', 'server', 'x-api-version', 'x-ratelimit-limit'];
  for (const result of results.filter(r => r.status === 200)) {
    for (const header of interestingHeaders) {
      if (result.headers[header]) {
        console.log(`${result.path} - ${header}: ${result.headers[header]}`);
      }
    }
  }
  
  return results;
}

async function analyzeErrorResponses() {
  console.log('\n5. Testing error responses for information leakage...\n');
  
  // Test invalid endpoints to see error format
  const testCases = [
    { path: '/api/game/dungeon/action', method: 'POST', data: {} },
    { path: '/api/game/dungeon/action', method: 'POST', data: { invalid: 'data' } },
    { path: '/api/game/dungeon/action', method: 'POST', data: { action: 'invalid' } },
    { path: '/api/nonexistent', method: 'GET' },
    { path: '/api/admin', method: 'GET' },
    { path: '/api/debug', method: 'GET' }
  ];
  
  for (const test of testCases) {
    const response = await api({
      method: test.method,
      url: test.path,
      data: test.data,
      validateStatus: () => true
    });
    
    if (response.data && (response.data.message || response.data.error)) {
      console.log(`${test.path} error: ${response.data.message || response.data.error}`);
    }
  }
}

async function findHiddenEndpoints() {
  console.log('\n6. Looking for hidden/debug endpoints...\n');
  
  const hiddenPaths = [
    '/api/test', '/api/debug', '/api/admin', '/api/internal',
    '/api/metrics', '/api/health/detailed', '/api/config',
    '/api/_status', '/api/.well-known', '/api/robots.txt'
  ];
  
  for (const path of hiddenPaths) {
    const result = await testEndpoint(path);
    if (result.status && result.status !== 404 && result.status !== 403) {
      console.log(`🔍 Found: ${path} - ${result.status}`);
    }
  }
}

// Run discovery
(async () => {
  try {
    await discoverEndpoints();
    await analyzeErrorResponses();
    await findHiddenEndpoints();
    
    console.log('\n=== Discovery Complete ===');
  } catch (error) {
    console.error('Fatal error:', error);
  }
})();