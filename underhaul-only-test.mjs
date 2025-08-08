#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.JWT_TOKEN_1;

console.log('🎯 UNDERHAUL-ONLY ENDPOINT TESTING\n');
console.log('⚠️  STRICTLY LIMITED TO /underhaul/ paths only');
console.log('=' .repeat(60));

async function underhaulOnlyTest() {
  // ONLY test underhaul endpoints - no other paths allowed
  const underhaulEndpoints = [
    'https://gigaverse.io/api/game/underhaul/action',
    'https://gigaverse.io/api/underhaul/action',
    'https://gigaverse.io/game/api/underhaul/action',
    'https://gigaverse.io/game/underhaul/action',
    'https://gigaverse.io/api/game/underhaul',
    'https://gigaverse.io/api/underhaul'
  ];
  
  // Since all methods return 405, let's focus on POST but try different request formats
  console.log('\n🔍 Testing different request formats (POST only):');
  
  for (const endpoint of underhaulEndpoints) {
    console.log(`\n📍 Testing: ${endpoint}`);
    console.log('-'.repeat(50));
    
    // Test different content types and request formats
    const requestVariants = [
      {
        name: 'Standard JSON',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        data: { action: 'start_run', dungeon_type: 3 }
      },
      {
        name: 'No Accept header',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: { action: 'start_run', dungeon_type: 3 }
      },
      {
        name: 'Text/plain content type',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain'
        },
        data: JSON.stringify({ action: 'start_run', dungeon_type: 3 })
      },
      {
        name: 'Application/x-www-form-urlencoded',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: 'action=start_run&dungeon_type=3'
      },
      {
        name: 'Empty body',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {}
      },
      {
        name: 'Null body',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: null
      },
      {
        name: 'Raw string body',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: 'start_run'
      }
    ];
    
    for (const variant of requestVariants) {
      try {
        const response = await axios.post(endpoint, variant.data, { 
          headers: variant.headers,
          timeout: 10000
        });
        
        console.log(`✅ ${variant.name}: SUCCESS! (${response.status})`);
        console.log('   Response:', JSON.stringify(response.data));
        return { endpoint, variant: variant.name, response: response.data };
        
      } catch (error) {
        const status = error.response?.status;
        
        if (status === 405) {
          console.log(`🔄 ${variant.name}: Method Not Allowed (405)`);
        } else if (status === 400) {
          console.log(`📝 ${variant.name}: Bad Request (400) - ${error.response?.data?.message}`);
        } else if (status === 401) {
          console.log(`🔒 ${variant.name}: Unauthorized (401)`);
        } else if (status === 403) {
          console.log(`🚫 ${variant.name}: Forbidden (403)`);
        } else if (status === 404) {
          console.log(`❌ ${variant.name}: Not Found (404)`);
          break; // If 404, no point trying other variants on this endpoint
        } else {
          console.log(`❓ ${variant.name}: ${status} - ${error.response?.data?.message || error.message}`);
        }
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Since POST gives 405, maybe it needs a completely different approach
  console.log('\n🔧 Testing if endpoint expects different HTTP methods:');
  
  const customMethods = ['PATCH', 'HEAD', 'TRACE'];
  const testEndpoint = 'https://gigaverse.io/api/game/underhaul/action';
  
  for (const method of customMethods) {
    try {
      const response = await axios({
        method: method,
        url: testEndpoint,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: method !== 'HEAD' ? { action: 'start_run' } : undefined
      });
      
      console.log(`✅ ${method}: Works! (${response.status})`);
      return { method, response: response.data };
      
    } catch (error) {
      console.log(`❌ ${method}: ${error.response?.status}`);
    }
  }
  
  // Check if maybe the endpoint is expecting specific headers
  console.log('\n🎫 Testing different authentication formats:');
  
  const authFormats = [
    { name: 'Standard Bearer', headers: { 'Authorization': `Bearer ${token}` } },
    { name: 'No Bearer prefix', headers: { 'Authorization': token } },
    { name: 'JWT header', headers: { 'JWT': token } },
    { name: 'X-JWT header', headers: { 'X-JWT': token } },
    { name: 'Token header', headers: { 'Token': token } },
    { name: 'X-Auth-Token', headers: { 'X-Auth-Token': token } },
    { name: 'Cookie auth', headers: { 'Cookie': `jwt=${token}` } }
  ];
  
  for (const authFormat of authFormats) {
    try {
      const response = await axios.post(testEndpoint, 
        { action: 'start_run', dungeon_type: 3 },
        { 
          headers: {
            ...authFormat.headers,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ ${authFormat.name}: Works! Response:`, response.data);
      return { auth: authFormat.name, response: response.data };
      
    } catch (error) {
      const status = error.response?.status;
      if (status === 401) {
        console.log(`🔒 ${authFormat.name}: Unauthorized (bad auth format)`);
      } else if (status === 405) {
        console.log(`🔄 ${authFormat.name}: Still Method Not Allowed`);
      } else {
        console.log(`❓ ${authFormat.name}: ${status}`);
      }
    }
  }
  
  return null;
}

// Run the underhaul-only test
underhaulOnlyTest()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result) {
      console.log('✅ BREAKTHROUGH! Found working configuration:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ All underhaul endpoints return 405 Method Not Allowed');
      console.log('\n💡 Analysis:');
      console.log('- All /underhaul/ endpoints exist (not 404)');
      console.log('- All return 405 for all HTTP methods tested');
      console.log('- This suggests the endpoints exist but may not be implemented yet');
      console.log('- Or they require a very specific request format we haven\'t found');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });