#!/usr/bin/env node

import { getDirectDungeonState, sendDirectAction, resetActionToken } from './src/direct-api.mjs';
import { config } from './src/config.mjs';
import axios from 'axios';

console.log('=== Testing Token Recovery Methods ===\n');

// Use Account 3
process.env.JWT_TOKEN = process.env.JWT_TOKEN_3;
config.jwtToken = process.env.JWT_TOKEN_3;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${config.jwtToken}`,
    'Content-Type': 'application/json'
  }
});

async function tryDifferentEndpoints() {
  console.log('Searching for endpoints that might provide the action token...\n');
  
  // Try different endpoints
  const endpoints = [
    '/game/dungeon/state',
    '/game/dungeon/today',
    '/game/dungeon/current',
    '/game/session',
    '/game/status'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${endpoint}...`);
      const response = await api.get(endpoint);
      
      // Check if response has actionToken
      if (response.data?.actionToken) {
        console.log(`  ✅ FOUND TOKEN: ${response.data.actionToken}`);
        return response.data.actionToken;
      } else {
        console.log(`  ❌ No token in response`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.response?.status || error.message}`);
    }
  }
  
  return null;
}

async function tryTokenlessAction() {
  console.log('\n\nTrying to send action without token to get one from error...\n');
  
  resetActionToken();
  
  // Try sending with empty token
  try {
    const payload = {
      action: 'rock',
      dungeonType: 3,
      dungeonId: 3,
      data: {},
      actionToken: ''  // Empty string instead of undefined
    };
    
    console.log('Sending with empty token string...');
    const response = await api.post('/game/dungeon/action', payload);
    console.log('✅ Succeeded somehow!');
  } catch (error) {
    console.log(`❌ Failed: ${error.response?.data?.message}`);
    
    if (error.response?.data?.actionToken) {
      console.log(`✅ But got token from error: ${error.response.data.actionToken}`);
      return error.response.data.actionToken;
    }
  }
}

async function tryNullAction() {
  console.log('\n\nTrying a null/invalid action to get token...\n');
  
  try {
    const payload = {
      action: 'get_token',  // Invalid action
      dungeonType: 3,
      dungeonId: 3,
      data: {}
    };
    
    console.log('Sending invalid action "get_token"...');
    const response = await api.post('/game/dungeon/action', payload);
    console.log('Response:', response.data);
  } catch (error) {
    console.log(`Error: ${error.response?.data?.message}`);
    
    if (error.response?.data?.actionToken) {
      console.log(`✅ Got token from error: ${error.response.data.actionToken}`);
      return error.response.data.actionToken;
    }
  }
}

async function test() {
  console.log('PROBLEM: Bot restart loses action token\n');
  
  // Method 1: Search other endpoints
  const token1 = await tryDifferentEndpoints();
  
  // Method 2: Try tokenless action
  const token2 = await tryTokenlessAction();
  
  // Method 3: Try invalid action
  const token3 = await tryNullAction();
  
  console.log('\n\n=== RESULTS ===');
  console.log('Token from endpoints:', token1 || 'Not found');
  console.log('Token from tokenless:', token2 || 'Not found');
  console.log('Token from invalid action:', token3 || 'Not found');
  
  if (token2) {
    console.log('\n💡 SOLUTION: The error response provides a valid token!');
    console.log('We can use this for token recovery after restart.');
  }
}

test().then(() => {
  console.log('\n=== Test Complete ===');
  process.exit(0);
});