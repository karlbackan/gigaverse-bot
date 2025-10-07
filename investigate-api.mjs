#!/usr/bin/env node

import { getDirectDungeonState, sendDirectAction, getCurrentActionToken } from './src/direct-api.mjs';
import { config } from './src/config.mjs';
import axios from 'axios';

// Use Account 1
process.env.JWT_TOKEN = process.env.JWT_TOKEN_1;
config.jwtToken = process.env.JWT_TOKEN_1;

console.log('=== INVESTIGATING API BEHAVIOR ===\n');

async function investigateEndpoints() {
  const api = axios.create({
    baseURL: 'https://gigaverse.io/api',
    headers: {
      'Authorization': `Bearer ${config.jwtToken}`,
      'Content-Type': 'application/json'
    }
  });

  // 1. First start a dungeon to create an active state
  console.log('1. Starting a dungeon to create active state...');
  try {
    const startResponse = await api.post('/game/dungeon/action', {
      action: 'start_run',
      dungeonType: 3,
      dungeonId: 3,
      data: {}
    });
    console.log('Dungeon started!');
    console.log('Start response actionToken:', startResponse.data.actionToken, '(type:', typeof startResponse.data.actionToken, ')');
  } catch (error) {
    console.log('Error starting:', error.response?.data?.message || error.message);
    // Continue anyway to check state
  }

  // 2. Now check state endpoint
  console.log('\n2. Checking /game/dungeon/state AFTER starting dungeon...');
  try {
    const stateResponse = await api.get('/game/dungeon/state');
    const state = stateResponse.data;

    console.log('Response has these top-level keys:', Object.keys(state));

    if (state.data) {
      console.log('state.data keys:', Object.keys(state.data));
      if (state.data.run) {
        console.log('There IS an active dungeon');
        console.log('  Entity:', state.data.entity);
      } else {
        console.log('No active dungeon');
      }
    }

    // Check if response contains actionToken
    console.log('\nSearching for actionToken in response...');
    const searchForToken = (obj, path = '') => {
      if (typeof obj !== 'object' || obj === null) return;
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('action')) {
          console.log(`  Found at ${currentPath}:`, value, '(type:', typeof value, ')');
        }
        if (typeof value === 'object') {
          searchForToken(value, currentPath);
        }
      }
    };
    searchForToken(state);

  } catch (error) {
    console.log('Error:', error.message);
    if (error.response?.data) {
      console.log('Error response:', error.response.data);
    }
  }

  // 3. Check what happens when we send an action without a token
  console.log('\n\n3. Testing action WITHOUT token...');
  try {
    const response = await api.post('/game/dungeon/action', {
      action: 'rock',
      dungeonType: 3,
      dungeonId: 3,
      data: {}
      // NO actionToken
    });
    console.log('Success! Response:', response.data);
  } catch (error) {
    console.log('Error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // 4. Check what happens with a random token
  console.log('\n\n4. Testing action WITH random token...');
  try {
    const response = await api.post('/game/dungeon/action', {
      action: 'rock',
      dungeonType: 3,
      dungeonId: 3,
      data: {},
      actionToken: '999999999999'
    });
    console.log('Success! Response:', response.data);
  } catch (error) {
    console.log('Error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

investigateEndpoints().then(() => {
  console.log('\n=== Investigation Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
