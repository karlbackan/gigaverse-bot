#!/usr/bin/env node

import axios from 'axios';

console.log('🔍 COMPLETE API REVERSE ENGINEERING WITHOUT AUTHENTICATION');
console.log('=' .repeat(60));
console.log('Strategy: Use error codes to map API structure');
console.log('401 = Endpoint exists, needs auth');
console.log('404 = Endpoint does not exist');  
console.log('405 = Wrong HTTP method');
console.log('400 = Bad request format');
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
  timeout: 10000
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
    }
    
    console.log(`✅ ${method} ${path} → SUCCESS (${response.status})`);
    if (response.data && Object.keys(response.data).length < 500) {
      console.log(`   Response: ${JSON.stringify(response.data)}`);
    } else {
      console.log(`   Response: [${typeof response.data}] ${response.data ? 'has data' : 'empty'}`);
    }
    return { status: response.status, exists: true, needsAuth: false, data: response.data };
    
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      
      if (status === 401) {
        console.log(`🔒 ${method} ${path} → NEEDS AUTH (401) ${description}`);
        return { status, exists: true, needsAuth: true, message };
      } else if (status === 404) {
        console.log(`❌ ${method} ${path} → NOT FOUND (404)`);
        return { status, exists: false, needsAuth: false, message };
      } else if (status === 405) {
        console.log(`🔄 ${method} ${path} → WRONG METHOD (405) - endpoint exists!`);
        return { status, exists: true, needsAuth: false, message };
      } else if (status === 400) {
        console.log(`⚠️  ${method} ${path} → BAD REQUEST (400) - endpoint exists but bad format`);
        console.log(`   Error: ${message}`);
        return { status, exists: true, needsAuth: false, message };
      } else {
        console.log(`❓ ${method} ${path} → ${status} ${message}`);
        return { status, exists: true, needsAuth: false, message };
      }
    } else {
      console.log(`💥 ${method} ${path} → NETWORK ERROR: ${error.message}`);
      return { status: null, exists: false, needsAuth: false, message: error.message };
    }
  }
}

async function comprehensiveApiMapping() {
  console.log('📊 PHASE 1: Test known endpoints from website analysis');
  console.log('-'.repeat(50));
  
  const knownEndpoints = [
    // From website JavaScript
    ['GET', '/user/me', null, 'User info from website'],
    ['POST', '/user/auth', { test: true }, 'Authentication from website'],
    ['GET', '/user/gameaccount/test', null, 'Game account from website'],
    
    // Analytics
    ['POST', '/analytics/event', { event: 'test' }, 'Analytics from website'],
    
    // Most likely game endpoints
    ['GET', '/game/dungeon/state', null, 'Current dungeon state'],
    ['GET', '/game/dungeon/today', null, 'Available dungeons'],
    ['POST', '/game/dungeon/action', { action: 'test' }, 'Dungeon actions'],
    
    // Underhaul specific tests
    ['GET', '/underhaul/state', null, 'Underhaul state'],
    ['POST', '/underhaul/action', { action: 'start_run' }, 'UNDERHAUL ACTIONS ⭐'],
    ['POST', '/underhaul/start', { test: true }, 'Underhaul start'],
    ['GET', '/game/underhaul/state', null, 'Game Underhaul state'],
    ['POST', '/game/underhaul/action', { action: 'start_run' }, 'Game Underhaul actions ⭐'],
    
    // Other game endpoints
    ['GET', '/gear/instances/test', null, 'Gear instances'],
    ['GET', '/importexport/balances/test', null, 'Inventory balances'],
  ];
  
  const results = [];
  for (const [method, path, data, desc] of knownEndpoints) {
    const result = await testEndpoint(method, path, data, desc);
    results.push({ method, path, ...result, description: desc });
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }
  
  console.log('\n📊 PHASE 2: Systematic endpoint discovery');
  console.log('-'.repeat(50));
  
  const discoveryTests = [
    // Different HTTP methods on known paths
    ['GET', '/game/dungeon/action'],
    ['PUT', '/game/dungeon/action'], 
    ['DELETE', '/game/dungeon/action'],
    
    // Alternative patterns
    ['POST', '/dungeon/action', { action: 'test' }],
    ['POST', '/dungeon/start', { test: true }],
    ['POST', '/dungeon/underhaul', { test: true }],
    
    // Different action endpoints
    ['POST', '/action', { action: 'start_run', dungeonType: 3 }],
    ['POST', '/start', { dungeonType: 3 }],
    ['POST', '/run', { dungeonType: 3 }],
    
    // API versioning
    ['POST', '/v1/game/dungeon/action', { action: 'test' }],
    ['POST', '/v2/game/dungeon/action', { action: 'test' }],
    ['POST', '/v1/underhaul/action', { action: 'test' }],
    
    // GraphQL
    ['GET', '/graphql'],
    ['POST', '/graphql', { query: 'query { test }' }],
    
    // Common API patterns
    ['GET', '/health'],
    ['GET', '/status'],
    ['GET', '/info'],
    ['GET', '/docs'],
    ['GET', '/swagger'],
    ['GET', '/api-docs'],
  ];
  
  for (const [method, path, data] of discoveryTests) {
    const result = await testEndpoint(method, path, data);
    results.push({ method, path, ...result });
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  return results;
}

async function analyzeResults(results) {
  console.log('\n📋 ANALYSIS: API Structure Discovery');
  console.log('=' .repeat(50));
  
  const existingEndpoints = results.filter(r => r.exists);
  const authRequired = existingEndpoints.filter(r => r.needsAuth);
  const publicEndpoints = existingEndpoints.filter(r => !r.needsAuth && r.status !== 400);
  const badRequestEndpoints = existingEndpoints.filter(r => r.status === 400);
  
  console.log(`\n🎯 SUMMARY:`);
  console.log(`   Total endpoints tested: ${results.length}`);
  console.log(`   Existing endpoints: ${existingEndpoints.length}`);
  console.log(`   Auth required: ${authRequired.length}`);
  console.log(`   Public endpoints: ${publicEndpoints.length}`);
  console.log(`   Bad request format: ${badRequestEndpoints.length}`);
  
  if (authRequired.length > 0) {
    console.log(`\n🔒 ENDPOINTS THAT EXIST (need auth):`);
    authRequired.forEach(r => {
      const star = r.description?.includes('⭐') ? ' ⭐' : '';
      console.log(`   ${r.method} ${r.path}${star}`);
      if (r.description) console.log(`      ${r.description}`);
    });
  }
  
  if (publicEndpoints.length > 0) {
    console.log(`\n✅ PUBLIC ENDPOINTS FOUND:`);
    publicEndpoints.forEach(r => {
      console.log(`   ${r.method} ${r.path} → ${r.status}`);
      if (r.data && typeof r.data === 'object') {
        console.log(`      Data keys: ${Object.keys(r.data).join(', ')}`);
      }
    });
  }
  
  if (badRequestEndpoints.length > 0) {
    console.log(`\n⚠️  ENDPOINTS WITH BAD REQUEST (exist but wrong format):`);
    badRequestEndpoints.forEach(r => {
      console.log(`   ${r.method} ${r.path} → ${r.message}`);
    });
  }
  
  // Look for Underhaul-specific findings
  const underhaulEndpoints = existingEndpoints.filter(r => 
    r.path.includes('underhaul') || r.description?.includes('UNDERHAUL')
  );
  
  if (underhaulEndpoints.length > 0) {
    console.log(`\n🎯 UNDERHAUL ENDPOINTS DISCOVERED:`);
    underhaulEndpoints.forEach(r => {
      const status = r.needsAuth ? 'NEEDS AUTH ✓' : r.status === 400 ? 'EXISTS (bad format)' : 'PUBLIC';
      console.log(`   ${r.method} ${r.path} → ${status}`);
    });
  } else {
    console.log(`\n❌ No Underhaul-specific endpoints found`);
  }
  
  // Endpoint pattern analysis
  console.log(`\n🏗️  API STRUCTURE PATTERNS:`);
  const pathPatterns = existingEndpoints.map(r => r.path.split('/').slice(0, 3).join('/')).filter(p => p);
  const uniquePatterns = [...new Set(pathPatterns)];
  uniquePatterns.forEach(pattern => {
    const count = pathPatterns.filter(p => p === pattern).length;
    console.log(`   ${pattern}/* (${count} endpoints)`);
  });
}

async function main() {
  try {
    console.log(`🌐 Testing API base: ${CORRECT_BASE_URL}\n`);
    
    const results = await comprehensiveApiMapping();
    await analyzeResults(results);
    
    console.log(`\n🎯 CONCLUSION:`);
    console.log(`Even without JWT tokens, we can map the entire API structure!`);
    console.log(`401 responses tell us which endpoints exist and need authentication.`);
    console.log(`This reveals the correct Underhaul endpoints before testing with tokens.`);
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

main().catch(console.error);