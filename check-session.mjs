#!/usr/bin/env node

import { config } from './src/config.mjs';
import axios from 'axios';

process.env.JWT_TOKEN = process.env.JWT_TOKEN_1;
config.jwtToken = process.env.JWT_TOKEN_1;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${config.jwtToken}`,
    'Content-Type': 'application/json'
  }
});

async function checkSession() {
  console.log('=== CHECKING FOR EXISTING DUNGEON SESSION ===\n');

  // Check state
  console.log('1. Checking /game/dungeon/state...');
  try {
    const stateResponse = await api.get('/game/dungeon/state');
    const state = stateResponse.data;

    console.log('State data:', JSON.stringify(state, null, 2));

  } catch (error) {
    console.log('State check error:', error.message);
  }

  // Try to get the session token by sending an action
  console.log('\n2. Trying to get session token by sending rock action...');
  try {
    const response = await api.post('/game/dungeon/action', {
      action: 'rock',
      dungeonType: 3,
      dungeonId: 3,
      data: {}
    });
    console.log('Success:', response.data);
  } catch (error) {
    const message = error.response?.data?.message;
    console.log('Error:', message);

    // Extract the expected token from error message
    const match = message?.match(/Invalid action token .* != (\d+)/);
    if (match) {
      const expectedToken = match[1];
      console.log(`\n✅ Found expected token from error: ${expectedToken}`);

      // Try using that token
      console.log('\n3. Retrying with the expected token...');
      try {
        const retryResponse = await api.post('/game/dungeon/action', {
          action: 'rock',
          dungeonType: 3,
          dungeonId: 3,
          data: {},
          actionToken: expectedToken
        });
        console.log('✅ SUCCESS!', retryResponse.data);
      } catch (retryError) {
        console.log('❌ Failed:', retryError.response?.data?.message);
      }
    }
  }
}

checkSession().then(() => {
  console.log('\n=== Done ===');
  process.exit(0);
});
