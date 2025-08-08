#!/usr/bin/env node

import axios from 'axios';

const baseURL = 'https://gigaverse.io';

console.log('🔍 Exploring additional API possibilities...\n');

// Test different API patterns
async function exploreMore() {
  const results = {
    found: [],
    interesting: []
  };
  
  // 1. Check for GraphQL endpoint
  console.log('📊 Testing GraphQL endpoints...');
  const graphqlEndpoints = ['/graphql', '/api/graphql', '/gql', '/api/gql', '/query'];
  for (const endpoint of graphqlEndpoints) {
    try {
      const response = await axios.post(`${baseURL}${endpoint}`, {
        query: '{ __schema { queryType { name } } }'
      });
      console.log(`✅ GraphQL found at ${endpoint}!`);
      results.found.push({ type: 'GraphQL', endpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`🤔 ${endpoint} returned ${status} - might exist`);
        results.interesting.push({ endpoint, status });
      }
    }
  }
  
  // 2. Check for WebSocket endpoints
  console.log('\n🔌 Testing WebSocket endpoints...');
  const wsEndpoints = ['/ws', '/websocket', '/api/ws', '/socket', '/api/socket', '/realtime'];
  for (const endpoint of wsEndpoints) {
    try {
      const response = await axios.get(`${baseURL}${endpoint}`, {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version': '13'
        }
      });
      console.log(`🤔 ${endpoint} responded - WebSocket possible`);
      results.interesting.push({ type: 'WebSocket', endpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status === 426) { // Upgrade Required
        console.log(`✅ WebSocket endpoint found at ${endpoint}!`);
        results.found.push({ type: 'WebSocket', endpoint });
      } else if (status && status !== 404) {
        console.log(`🤔 ${endpoint} returned ${status}`);
      }
    }
  }
  
  // 3. Check for different API versions
  console.log('\n🔢 Testing API versions...');
  const versionPatterns = ['/v1', '/v2', '/api/v1', '/api/v2', '/api/v3'];
  for (const pattern of versionPatterns) {
    try {
      const response = await axios.get(`${baseURL}${pattern}`);
      console.log(`✅ API version found at ${pattern}!`);
      results.found.push({ type: 'Version', endpoint: pattern });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`🤔 ${pattern} returned ${status}`);
        results.interesting.push({ endpoint: pattern, status });
      }
    }
  }
  
  // 4. Check for Server-Sent Events
  console.log('\n📡 Testing SSE endpoints...');
  const sseEndpoints = ['/events', '/api/events', '/stream', '/api/stream', '/sse'];
  for (const endpoint of sseEndpoints) {
    try {
      const response = await axios.get(`${baseURL}${endpoint}`, {
        headers: { 'Accept': 'text/event-stream' }
      });
      console.log(`✅ SSE endpoint found at ${endpoint}!`);
      results.found.push({ type: 'SSE', endpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`🤔 ${endpoint} returned ${status}`);
        results.interesting.push({ endpoint, status });
      }
    }
  }
  
  // 5. Check for documentation/metadata endpoints
  console.log('\n📚 Testing documentation endpoints...');
  const docEndpoints = [
    '/api-docs', '/swagger', '/swagger.json', '/openapi.json',
    '/api/swagger', '/api/openapi', '/api/schema', '/schema',
    '/.well-known/openapi', '/api/v1/docs', '/redoc', '/rapidoc'
  ];
  for (const endpoint of docEndpoints) {
    try {
      const response = await axios.get(`${baseURL}${endpoint}`);
      console.log(`✅ Documentation found at ${endpoint}!`);
      results.found.push({ type: 'Documentation', endpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`🤔 ${endpoint} returned ${status}`);
        results.interesting.push({ endpoint, status });
      }
    }
  }
  
  // 6. Check for health/status endpoints
  console.log('\n💚 Testing health check endpoints...');
  const healthEndpoints = [
    '/health', '/healthz', '/api/health', '/status', '/api/status',
    '/ping', '/api/ping', '/_health', '/healthcheck', '/api/healthcheck',
    '/ready', '/readyz', '/livez', '/metrics', '/api/metrics'
  ];
  for (const endpoint of healthEndpoints) {
    try {
      const response = await axios.get(`${baseURL}${endpoint}`);
      console.log(`✅ Health endpoint found at ${endpoint}!`);
      results.found.push({ type: 'Health', endpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`🤔 ${endpoint} returned ${status}`);
        results.interesting.push({ endpoint, status });
      }
    }
  }
  
  // 7. Check query parameters on known endpoints
  console.log('\n❓ Testing query parameters...');
  const testParams = [
    '/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0?include=all',
    '/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0?expand=true',
    '/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0?fields=*',
    '/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0?verbose=true',
    '/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0?debug=true'
  ];
  for (const url of testParams) {
    try {
      const response = await axios.get(`${baseURL}${url}`);
      const dataSize = JSON.stringify(response.data).length;
      console.log(`📏 ${url.split('?')[1]} returned ${dataSize} bytes`);
      // Compare sizes to see if parameters affect output
    } catch (error) {
      // Silent fail
    }
  }
  
  // 8. Check for batch/bulk endpoints
  console.log('\n📦 Testing batch endpoints...');
  const batchEndpoints = ['/api/batch', '/api/bulk', '/api/_batch', '/api/multi'];
  for (const endpoint of batchEndpoints) {
    try {
      const response = await axios.post(`${baseURL}${endpoint}`, {
        requests: [{ url: '/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0' }]
      });
      console.log(`✅ Batch endpoint found at ${endpoint}!`);
      results.found.push({ type: 'Batch', endpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`🤔 ${endpoint} returned ${status}`);
        results.interesting.push({ endpoint, status });
      }
    }
  }
  
  // 9. Check rate limit headers
  console.log('\n⏱️  Checking rate limit headers...');
  try {
    const response = await axios.get(`${baseURL}/api/account/0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0`);
    const headers = response.headers;
    const rateLimitHeaders = Object.entries(headers).filter(([key]) => 
      key.toLowerCase().includes('rate') || 
      key.toLowerCase().includes('limit') ||
      key.toLowerCase().includes('retry')
    );
    if (rateLimitHeaders.length > 0) {
      console.log('✅ Rate limit headers found:');
      rateLimitHeaders.forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
  } catch (error) {
    // Silent fail
  }
  
  // 10. Check for RSS/feed endpoints
  console.log('\n📰 Testing RSS/feed endpoints...');
  const feedEndpoints = ['/feed', '/rss', '/atom', '/api/feed', '/api/rss'];
  for (const endpoint of feedEndpoints) {
    try {
      const response = await axios.get(`${baseURL}${endpoint}`, {
        headers: { 'Accept': 'application/rss+xml, application/atom+xml, application/xml' }
      });
      console.log(`✅ Feed found at ${endpoint}!`);
      results.found.push({ type: 'Feed', endpoint });
    } catch (error) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.log(`🤔 ${endpoint} returned ${status}`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 EXPLORATION SUMMARY\n');
  
  if (results.found.length > 0) {
    console.log('✅ NEW ENDPOINTS FOUND:');
    results.found.forEach(item => {
      console.log(`   ${item.type}: ${item.endpoint}`);
    });
  }
  
  if (results.interesting.length > 0) {
    console.log('\n🤔 INTERESTING RESPONSES (non-404):');
    results.interesting.forEach(item => {
      console.log(`   ${item.endpoint}: HTTP ${item.status}`);
    });
  }
  
  if (results.found.length === 0 && results.interesting.length === 0) {
    console.log('❌ No additional endpoints discovered');
  }
  
  return results;
}

// Run exploration
exploreMore()
  .then(() => {
    console.log('\n✨ Exploration complete!');
  })
  .catch(error => {
    console.error('Error:', error);
  });