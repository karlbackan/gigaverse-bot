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

console.log('🎯 Testing EXACT Same Payload - Type 1 vs Type 3');
console.log('📝 Discord user: "Just do exact same payload as dungeonType 1 but change to 3"\n');

async function testExactPayload() {
  
  console.log('1️⃣ First, let me get the EXACT working payload by testing type 1:');
  
  // Get action token
  let actionToken = null;
  try {
    await api.post('/game/dungeon/action', { action: 'exact_test_' + Date.now() });
  } catch (error) {
    actionToken = error.response?.data?.actionToken?.toString();
    console.log(`🔑 Got action token: ${actionToken}`);
  }
  
  if (!actionToken) {
    console.log('❌ Could not get action token');
    return;
  }
  
  console.log('\n📋 Using EXACT payload structure that worked before for type 1:');
  console.log('(Not executing type 1 to avoid affecting account)');
  
  const workingPayload = {
    action: 'start_run',
    dungeonType: 1,
    data: {},
    actionToken: actionToken
  };
  
  console.log('Working payload structure:', JSON.stringify(workingPayload, null, 2));
  
  console.log('\n2️⃣ Now testing EXACT same payload with type 3:');
  
  // Use EXACT same structure, only change the number 1 to 3
  const underhaulPayload = {
    action: 'start_run',
    dungeonType: 3,  // ONLY change: 1 → 3
    data: {},
    actionToken: actionToken
  };
  
  console.log('Payload:', JSON.stringify(underhaulPayload, null, 2));
  
  try {
    const response3 = await api.post('/game/dungeon/action', underhaulPayload);
    
    console.log('🎉 TYPE 3 SUCCESS! Underhaul works!');
    console.log('Response:', response3.data);
    
  } catch (error) {
    const message = error.response?.data?.message;
    const status = error.response?.status;
    
    console.log(`❌ Type 3 failed: ${status} - ${message}`);
    console.log('Full error response:', error.response?.data);
    
    // Show exact comparison
    console.log('\n🔍 EXACT COMPARISON:');
    console.log('WORKING (Type 1):', JSON.stringify(workingPayload));
    console.log('FAILING (Type 3):', JSON.stringify(underhaulPayload));
    console.log('\nOnly difference is: dungeonType: 1 → dungeonType: 3');
  }
}

testExactPayload()
  .catch(error => {
    console.error('Fatal error:', error);
  });