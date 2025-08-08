#!/usr/bin/env node

import axios from 'axios';
import crypto from 'crypto';

const baseURL = 'https://gigaverse.io';

console.log('🔬 Deep API exploration - finding hidden endpoints...\n');

// Test for common API patterns
async function deepExplore() {
  const discoveries = {
    graphql: [],
    batch: [],
    hidden: [],
    interesting: []
  };
  
  // 1. Test subdomain patterns
  console.log('🌐 Testing subdomain patterns...');
  const subdomains = ['api', 'graphql', 'ws', 'data', 'backend', 'game'];
  for (const subdomain of subdomains) {
    try {
      const url = `https://${subdomain}.gigaverse.io`;
      const response = await axios.get(url, { timeout: 5000 });
      console.log(`  ✅ Subdomain ${subdomain}.gigaverse.io exists!`);
      discoveries.hidden.push({ type: 'subdomain', url });
    } catch (error) {
      // Most will fail, that's expected
    }
  }
  
  // 2. Test for hidden API directories
  console.log('\n📁 Testing hidden directories...');
  const hiddenPaths = [
    '/.git', '/.env', '/admin', '/debug', '/internal',
    '/private', '/api/internal', '/api/private', '/api/admin',
    '/api/debug', '/api/dev', '/dev', '/test', '/staging',
    '/api/v1', '/api/v2', '/api/beta', '/beta', '/alpha'
  ];
  
  for (const path of hiddenPaths) {
    try {
      const response = await axios.get(`${baseURL}${path}`);
      console.log(`  ✅ Hidden path found: ${path}`);
      discoveries.hidden.push({ type: 'path', path });
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        console.log(`  🔒 Protected path: ${path} (${status})`);
        discoveries.interesting.push({ path, status });
      }
    }
  }
  
  // 3. Test content negotiation
  console.log('\n📄 Testing content types...');
  const contentTypes = [
    'application/json',
    'application/xml',
    'text/html',
    'application/graphql',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
    'application/octet-stream'
  ];
  
  for (const contentType of contentTypes) {
    try {
      const response = await axios.post(`${baseURL}/api/analytics/event`, 
        { test: true },
        { headers: { 'Content-Type': contentType } }
      );
      console.log(`  ✅ Content-Type ${contentType} accepted`);
    } catch (error) {
      // Most will fail
    }
  }
  
  // 4. Test for API key endpoints
  console.log('\n🔑 Testing API key endpoints...');
  const apiKeyEndpoints = [
    '/api/keys', '/api/apikeys', '/api/tokens', '/api/auth/token',
    '/api/auth/apikey', '/api/register', '/api/signup', '/api/login'
  ];
  
  for (const endpoint of apiKeyEndpoints) {
    try {
      const response = await axios.get(`${baseURL}${endpoint}`);
      console.log(`  ✅ API endpoint found: ${endpoint}`);
      discoveries.interesting.push({ endpoint, type: 'auth' });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`  🤔 ${endpoint} returned ${status}`);
      }
    }
  }
  
  // 5. Test HTTP methods on known endpoints
  console.log('\n🔧 Testing uncommon HTTP methods...');
  const methods = ['HEAD', 'PUT', 'PATCH', 'DELETE', 'TRACE', 'CONNECT'];
  const testEndpoint = '/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0';
  
  for (const method of methods) {
    try {
      const response = await axios({
        method,
        url: `${baseURL}${testEndpoint}`
      });
      console.log(`  ✅ ${method} method works on ${testEndpoint}`);
      discoveries.interesting.push({ method, endpoint: testEndpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404 && status !== 405) {
        console.log(`  🤔 ${method} returned ${status}`);
      }
    }
  }
  
  // 6. Test for WebSocket upgrade paths
  console.log('\n🔌 Deep WebSocket testing...');
  const wsPaths = [
    '/cable', '/socket.io', '/sockjs', '/ws', 
    '/websocket', '/api/ws', '/api/websocket', '/realtime',
    '/stream', '/live', '/updates', '/events'
  ];
  
  for (const path of wsPaths) {
    // Test with proper WebSocket headers
    try {
      const key = crypto.randomBytes(16).toString('base64');
      const response = await axios.get(`${baseURL}${path}`, {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Protocol': 'chat, superchat'
        }
      });
    } catch (error) {
      const status = error.response?.status;
      const headers = error.response?.headers;
      
      if (status === 426) {
        console.log(`  ✅ WebSocket endpoint confirmed: ${path}`);
        discoveries.interesting.push({ type: 'websocket', path });
      } else if (status === 101) {
        console.log(`  ✅ WebSocket upgrade successful: ${path}`);
        discoveries.interesting.push({ type: 'websocket', path, upgraded: true });
      } else if (headers && headers['upgrade']) {
        console.log(`  🤔 ${path} has upgrade header: ${headers['upgrade']}`);
      }
    }
  }
  
  // 7. Test for GraphQL with different approaches
  console.log('\n📊 Advanced GraphQL testing...');
  const graphqlTests = [
    { endpoint: '/graphql', query: 'query{__typename}' },
    { endpoint: '/api/graphql', query: '{__schema{types{name}}}' },
    { endpoint: '/gql', query: 'query IntrospectionQuery{__schema{queryType{name}}}' },
    { endpoint: '/api/gql', query: 'mutation{test}' },
    { endpoint: '/query', query: 'subscription{test}' }
  ];
  
  for (const test of graphqlTests) {
    // Try GET with query in URL
    try {
      const response = await axios.get(`${baseURL}${test.endpoint}?query=${encodeURIComponent(test.query)}`);
      console.log(`  ✅ GraphQL GET works at ${test.endpoint}`);
      discoveries.graphql.push({ endpoint: test.endpoint, method: 'GET' });
    } catch (error) {
      // Expected to fail
    }
    
    // Try POST with application/graphql
    try {
      const response = await axios.post(
        `${baseURL}${test.endpoint}`,
        test.query,
        { headers: { 'Content-Type': 'application/graphql' } }
      );
      console.log(`  ✅ GraphQL POST (application/graphql) works at ${test.endpoint}`);
      discoveries.graphql.push({ endpoint: test.endpoint, method: 'POST', contentType: 'application/graphql' });
    } catch (error) {
      // Expected to fail
    }
  }
  
  // 8. Test for server info leakage
  console.log('\n🔍 Checking for server info leakage...');
  try {
    const response = await axios.get(`${baseURL}/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0`);
    const headers = response.headers;
    
    const infoHeaders = ['server', 'x-powered-by', 'x-aspnet-version', 'x-runtime', 'x-version'];
    infoHeaders.forEach(header => {
      if (headers[header]) {
        console.log(`  ℹ️  ${header}: ${headers[header]}`);
        discoveries.interesting.push({ type: 'header', name: header, value: headers[header] });
      }
    });
    
    // Check for rate limit info
    const rateLimitHeaders = Object.entries(headers).filter(([key]) => 
      key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit')
    );
    if (rateLimitHeaders.length > 0) {
      console.log('  ℹ️  Rate limiting headers found:');
      rateLimitHeaders.forEach(([key, value]) => {
        console.log(`     ${key}: ${value}`);
      });
    }
  } catch (error) {
    // Silent
  }
  
  // 9. Test for alternative batch formats
  console.log('\n📦 Testing alternative batch formats...');
  const batchTests = [
    { endpoint: '/api/batch', data: { queries: ['/account/test'] } },
    { endpoint: '/api/bulk', data: { bulk: [{ url: '/account/test' }] } },
    { endpoint: '/api/_batch', data: { _batch: ['/account/test'] } },
    { endpoint: '/api/multi', data: { multi: ['/account/test'] } }
  ];
  
  for (const test of batchTests) {
    try {
      const response = await axios.post(`${baseURL}${test.endpoint}`, test.data);
      console.log(`  ✅ Batch format works at ${test.endpoint}:`, JSON.stringify(test.data));
      discoveries.batch.push(test);
    } catch (error) {
      const status = error.response?.status;
      if (status === 400) {
        const message = error.response?.data?.message;
        if (message) {
          console.log(`  ℹ️  ${test.endpoint} error hint: ${message}`);
        }
      }
    }
  }
  
  return discoveries;
}

// Run deep exploration
deepExplore()
  .then(discoveries => {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 DEEP EXPLORATION COMPLETE\n');
    
    if (discoveries.graphql.length > 0) {
      console.log('📊 GraphQL Discoveries:');
      discoveries.graphql.forEach(d => console.log(`   ${d.endpoint}: ${d.method}`));
    }
    
    if (discoveries.batch.length > 0) {
      console.log('\n📦 Batch Discoveries:');
      discoveries.batch.forEach(d => console.log(`   ${d.endpoint}: ${JSON.stringify(d.data)}`));
    }
    
    if (discoveries.hidden.length > 0) {
      console.log('\n🔒 Hidden Discoveries:');
      discoveries.hidden.forEach(d => console.log(`   ${d.type}: ${d.path || d.url}`));
    }
    
    if (discoveries.interesting.length > 0) {
      console.log('\n🤔 Interesting Findings:');
      discoveries.interesting.forEach(d => {
        if (d.type === 'header') {
          console.log(`   Header ${d.name}: ${d.value}`);
        } else {
          console.log(`   ${JSON.stringify(d)}`);
        }
      });
    }
    
    console.log('\n✨ Exploration complete!');
  })
  .catch(console.error);