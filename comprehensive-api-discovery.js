#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs';

console.log('🔍 COMPREHENSIVE GIGAVERSE API DISCOVERY');
console.log('=' .repeat(70));
console.log('Strategy: Systematic endpoint enumeration using HTTP response codes');
console.log('401/403 = Endpoint exists, needs auth');
console.log('404 = Endpoint does not exist');  
console.log('405 = Wrong HTTP method, but endpoint exists');
console.log('400 = Bad request format, but endpoint exists');
console.log('200 = Success (public endpoint)');
console.log('500 = Server error, but endpoint exists');
console.log('');

const CORRECT_BASE_URL = 'https://gigaverse.io/api';

const api = axios.create({
  baseURL: CORRECT_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
    // NO Authorization header - testing without auth
  },
  timeout: 15000
});

async function testEndpoint(method, path, data = null, description = '') {
  try {
    let response;
    if (method === 'GET') {
      response = await api.get(path);
    } else if (method === 'POST') {
      response = await api.post(path, data);
    } else if (method === 'PUT') {
      response = await api.put(path, data);
    } else if (method === 'DELETE') {
      response = await api.delete(path);
    } else if (method === 'PATCH') {
      response = await api.patch(path, data);
    }
    
    console.log(`✅ ${method.padEnd(6)} ${path.padEnd(40)} → ${response.status} SUCCESS`);
    let responsePreview = '';
    if (response.data && typeof response.data === 'object') {
      const keys = Object.keys(response.data);
      responsePreview = keys.length > 0 ? `keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}` : 'empty object';
    } else if (response.data) {
      responsePreview = `${typeof response.data}`;
    }
    if (responsePreview) console.log(`       ${' '.repeat(47)} ${responsePreview}`);
    
    return { status: response.status, exists: true, needsAuth: false, public: true, data: response.data };
    
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      
      if (status === 401) {
        console.log(`🔒 ${method.padEnd(6)} ${path.padEnd(40)} → ${status} NEEDS_AUTH`);
        return { status, exists: true, needsAuth: true, public: false, message };
      } else if (status === 403) {
        console.log(`🚫 ${method.padEnd(6)} ${path.padEnd(40)} → ${status} FORBIDDEN`);
        return { status, exists: true, needsAuth: true, public: false, message };
      } else if (status === 404) {
        console.log(`❌ ${method.padEnd(6)} ${path.padEnd(40)} → ${status} NOT_FOUND`);
        return { status, exists: false, needsAuth: false, public: false, message };
      } else if (status === 405) {
        console.log(`🔄 ${method.padEnd(6)} ${path.padEnd(40)} → ${status} WRONG_METHOD (exists!)`);
        return { status, exists: true, needsAuth: false, public: false, message };
      } else if (status === 400) {
        console.log(`⚠️  ${method.padEnd(6)} ${path.padEnd(40)} → ${status} BAD_REQUEST (exists!)`);
        return { status, exists: true, needsAuth: false, public: false, message };
      } else if (status === 422) {
        console.log(`📝 ${method.padEnd(6)} ${path.padEnd(40)} → ${status} VALIDATION_ERROR (exists!)`);
        return { status, exists: true, needsAuth: false, public: false, message };
      } else if (status === 500) {
        console.log(`💥 ${method.padEnd(6)} ${path.padEnd(40)} → ${status} SERVER_ERROR (exists!)`);
        return { status, exists: true, needsAuth: false, public: false, message };
      } else {
        console.log(`❓ ${method.padEnd(6)} ${path.padEnd(40)} → ${status} ${message}`);
        return { status, exists: true, needsAuth: false, public: false, message };
      }
    } else {
      console.log(`💥 ${method.padEnd(6)} ${path.padEnd(40)} → NETWORK_ERROR: ${error.message}`);
      return { status: null, exists: false, needsAuth: false, public: false, message: error.message };
    }
  }
}

async function comprehensiveApiDiscovery() {
  console.log('📊 PHASE 1: Known endpoints from previous discovery');
  console.log('-'.repeat(70));
  
  const knownEndpoints = [
    // User endpoints
    ['GET', '/user/me', null, 'Current user info'],
    ['POST', '/user/auth', { test: true }, 'User authentication'],
    ['GET', '/user/profile', null, 'User profile'],
    ['GET', '/user/settings', null, 'User settings'],
    ['PUT', '/user/settings', { test: true }, 'Update user settings'],
    ['GET', '/user/notifications', null, 'User notifications'],
    
    // Game account endpoints  
    ['GET', '/user/gameaccount/0x1234567890123456789012345678901234567890', null, 'Game account by address'],
    ['GET', '/user/gameaccounts', null, 'All user game accounts'],
    ['POST', '/user/gameaccount', { address: '0x1234567890123456789012345678901234567890' }, 'Create game account'],
    
    // Game dungeon endpoints
    ['GET', '/game/dungeon/state', null, 'Current dungeon state'],
    ['GET', '/game/dungeon/today', null, 'Available dungeons today'],
    ['POST', '/game/dungeon/action', { action: 'start_run', dungeonType: 1 }, 'Dungeon actions'],
    ['GET', '/game/dungeon/history', null, 'Dungeon run history'],
    ['GET', '/game/dungeon/leaderboard', null, 'Dungeon leaderboards'],
    ['GET', '/game/dungeon/stats', null, 'Dungeon statistics'],
    
    // Game underhaul endpoints
    ['GET', '/game/underhaul/state', null, 'Underhaul dungeon state'],
    ['POST', '/game/underhaul/action', { action: 'start_run' }, 'Underhaul actions'],
    ['GET', '/game/underhaul/today', null, 'Available underhaul today'],
    ['GET', '/game/underhaul/history', null, 'Underhaul run history'],
    ['GET', '/game/underhaul/leaderboard', null, 'Underhaul leaderboards'],
    ['GET', '/game/underhaul/stats', null, 'Underhaul statistics'],
    
    // Gear endpoints
    ['GET', '/gear/instances/0x1234567890123456789012345678901234567890', null, 'Player gear instances'],
    ['GET', '/gear/types', null, 'Available gear types'],
    ['GET', '/gear/stats', null, 'Gear statistics'],
    ['POST', '/gear/equip', { gearId: 'test' }, 'Equip gear'],
    ['POST', '/gear/unequip', { gearId: 'test' }, 'Unequip gear'],
    ['GET', '/gear/market', null, 'Gear marketplace'],
    ['POST', '/gear/craft', { recipe: 'test' }, 'Craft gear'],
    
    // Import/Export endpoints
    ['GET', '/importexport/balances/0x1234567890123456789012345678901234567890', null, 'Player balances'],
    ['GET', '/importexport/transactions', null, 'Transaction history'],
    ['POST', '/importexport/import', { data: 'test' }, 'Import data'],
    ['POST', '/importexport/export', { type: 'test' }, 'Export data'],
    
    // Analytics endpoints
    ['POST', '/analytics/event', { event: 'test_event', data: {} }, 'Analytics events'],
    ['GET', '/analytics/stats', null, 'Analytics statistics'],
    ['POST', '/analytics/track', { action: 'test' }, 'Track user action'],
    
    // Off-chain endpoints
    ['GET', '/offchain/player/energy/0x1234567890123456789012345678901234567890', null, 'Player energy'],
    ['GET', '/offchain/player/stats/0x1234567890123456789012345678901234567890', null, 'Player stats'],
    ['GET', '/offchain/player/items/0x1234567890123456789012345678901234567890', null, 'Player items'],
    
    // Account endpoints
    ['GET', '/account/0x1234567890123456789012345678901234567890', null, 'Account info'],
    ['GET', '/accounts', null, 'List accounts'],
    ['POST', '/account', { address: '0x1234567890123456789012345678901234567890' }, 'Create account'],
    
    // Indexer endpoints
    ['GET', '/indexer/player/gameitems/0x1234567890123456789012345678901234567890', null, 'Player game items'],
    ['GET', '/indexer/events', null, 'Indexed events'],
    ['GET', '/indexer/blocks', null, 'Indexed blocks'],
    ['GET', '/indexer/transactions', null, 'Indexed transactions'],
  ];
  
  const results = [];
  for (const [method, path, data, desc] of knownEndpoints) {
    const result = await testEndpoint(method, path, data, desc);
    results.push({ method, path, ...result, description: desc });
    await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit
  }
  
  console.log('\n📊 PHASE 2: Alternative HTTP methods on known paths');
  console.log('-'.repeat(70));
  
  const methodTests = [
    // Test different methods on confirmed endpoints
    ['POST', '/user/me'],
    ['PUT', '/user/me'],
    ['DELETE', '/user/me'],
    ['PATCH', '/user/me'],
    
    ['GET', '/game/dungeon/action'],
    ['PUT', '/game/dungeon/action'],
    ['DELETE', '/game/dungeon/action'],
    ['PATCH', '/game/dungeon/action'],
    
    ['GET', '/game/underhaul/action'],
    ['PUT', '/game/underhaul/action'],
    ['DELETE', '/game/underhaul/action'],
    ['PATCH', '/game/underhaul/action'],
    
    ['POST', '/gear/instances/0x1234567890123456789012345678901234567890'],
    ['PUT', '/gear/instances/0x1234567890123456789012345678901234567890'],
    ['DELETE', '/gear/instances/0x1234567890123456789012345678901234567890'],
  ];
  
  for (const [method, path, data] of methodTests) {
    const result = await testEndpoint(method, path, data);
    results.push({ method, path, ...result });
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n📊 PHASE 3: Common API patterns and alternatives');
  console.log('-'.repeat(70));
  
  const patternTests = [
    // API versioning
    ['GET', '/v1/user/me'],
    ['GET', '/v2/user/me'],
    ['GET', '/v1/game/dungeon/state'],
    ['GET', '/v1/game/underhaul/state'],
    
    // Alternative structures
    ['GET', '/users/me'],
    ['GET', '/users/profile'],
    ['GET', '/players/me'],
    ['GET', '/players/stats'],
    
    // Direct game endpoints
    ['GET', '/dungeon/state'],
    ['POST', '/dungeon/action'],
    ['GET', '/underhaul/state'], 
    ['POST', '/underhaul/action'],
    ['POST', '/underhaul/start'],
    ['POST', '/dungeon/start'],
    
    // Admin endpoints
    ['GET', '/admin/users'],
    ['GET', '/admin/stats'],
    ['GET', '/admin/games'],
    
    // Common API endpoints
    ['GET', '/health'],
    ['GET', '/status'], 
    ['GET', '/info'],
    ['GET', '/version'],
    ['GET', '/docs'],
    ['GET', '/swagger'],
    ['GET', '/api-docs'],
    ['GET', '/openapi.json'],
    
    // GraphQL
    ['GET', '/graphql'],
    ['POST', '/graphql', { query: 'query { __schema { types { name } } }' }],
    
    // WebSocket info
    ['GET', '/ws'],
    ['GET', '/socket'],
    ['GET', '/realtime'],
    
    // Auth endpoints
    ['POST', '/auth/login'],
    ['POST', '/auth/logout'], 
    ['POST', '/auth/refresh'],
    ['GET', '/auth/me'],
    
    // Market/Economy
    ['GET', '/market/items'],
    ['GET', '/market/prices'],
    ['GET', '/economy/stats'],
    ['GET', '/leaderboard'],
    ['GET', '/rankings'],
    
    // Social features
    ['GET', '/friends'],
    ['GET', '/guilds'],
    ['GET', '/chat'],
    ['GET', '/messages'],
    
    // Game mechanics
    ['GET', '/rewards'],
    ['GET', '/achievements'],
    ['GET', '/quests'],
    ['GET', '/events'],
    
    // Battle/Combat
    ['POST', '/battle/start'],
    ['POST', '/combat/action'],
    ['GET', '/battles/history'],
    
    // Configuration
    ['GET', '/config'],
    ['GET', '/settings'],
    ['GET', '/features'],
  ];
  
  for (const [method, path, data] of patternTests) {
    const result = await testEndpoint(method, path, data);
    results.push({ method, path, ...result });
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

async function analyzeAndSaveResults(results) {
  console.log('\n📋 COMPREHENSIVE ANALYSIS');
  console.log('=' .repeat(70));
  
  const existingEndpoints = results.filter(r => r.exists);
  const authRequired = existingEndpoints.filter(r => r.needsAuth);
  const publicEndpoints = existingEndpoints.filter(r => r.public);
  const serverErrors = existingEndpoints.filter(r => r.status >= 500);
  const clientErrors = existingEndpoints.filter(r => r.status >= 400 && r.status < 500 && !r.needsAuth);
  
  console.log(`\n🎯 DISCOVERY SUMMARY:`);
  console.log(`   Total endpoints tested: ${results.length}`);
  console.log(`   Endpoints that exist: ${existingEndpoints.length}`);
  console.log(`   Require authentication: ${authRequired.length}`);
  console.log(`   Public endpoints: ${publicEndpoints.length}`);
  console.log(`   Server errors: ${serverErrors.length}`);
  console.log(`   Client errors: ${clientErrors.length}`);
  
  // Categorize endpoints by URL pattern
  const categories = {};
  existingEndpoints.forEach(endpoint => {
    const pathParts = endpoint.path.split('/').filter(p => p);
    if (pathParts.length > 0) {
      const category = pathParts[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(endpoint);
    }
  });
  
  console.log(`\n🏗️  ENDPOINT CATEGORIES:`);
  Object.keys(categories).sort().forEach(category => {
    const endpoints = categories[category];
    const authCount = endpoints.filter(e => e.needsAuth).length;
    const publicCount = endpoints.filter(e => e.public).length;
    console.log(`   ${category}/ (${endpoints.length} endpoints - ${authCount} auth, ${publicCount} public)`);
  });
  
  if (publicEndpoints.length > 0) {
    console.log(`\n✅ PUBLIC ENDPOINTS (no auth needed):`);
    publicEndpoints.forEach(endpoint => {
      console.log(`   ${endpoint.method} ${endpoint.path} → ${endpoint.status}`);
    });
  }
  
  if (authRequired.length > 0) {
    console.log(`\n🔒 AUTHENTICATED ENDPOINTS:`);
    Object.keys(categories).sort().forEach(category => {
      const authEndpoints = categories[category].filter(e => e.needsAuth);
      if (authEndpoints.length > 0) {
        console.log(`\n   ${category.toUpperCase()}:`);
        authEndpoints.forEach(endpoint => {
          console.log(`     ${endpoint.method} ${endpoint.path} → ${endpoint.status}`);
        });
      }
    });
  }
  
  // Save detailed results to file
  const detailedResults = {
    discoveryDate: new Date().toISOString(),
    baseUrl: CORRECT_BASE_URL,
    summary: {
      totalTested: results.length,
      existing: existingEndpoints.length,
      authRequired: authRequired.length,
      public: publicEndpoints.length,
      categories: Object.keys(categories).length
    },
    categories: categories,
    allEndpoints: results
  };
  
  const filename = 'GIGAVERSE_API_COMPLETE_DISCOVERY.json';
  fs.writeFileSync(filename, JSON.stringify(detailedResults, null, 2));
  console.log(`\n💾 Detailed results saved to: ${filename}`);
  
  return detailedResults;
}

async function main() {
  try {
    console.log(`🌐 Testing API base: ${CORRECT_BASE_URL}\n`);
    
    const results = await comprehensiveApiDiscovery();
    const analysis = await analyzeAndSaveResults(results);
    
    console.log(`\n🎯 DISCOVERY COMPLETE:`);
    console.log(`Found ${analysis.summary.existing} existing endpoints across ${analysis.summary.categories} categories`);
    console.log(`${analysis.summary.public} are publicly accessible`);
    console.log(`${analysis.summary.authRequired} require authentication`);
    console.log(`\nThis gives us a comprehensive map of the Gigaverse API for future development!`);
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

main().catch(console.error);