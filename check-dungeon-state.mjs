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

console.log('🔍 Checking Dungeon State');

async function checkState() {
  try {
    const response = await api.get('/game/dungeon/state');
    console.log('Current dungeon state:', JSON.stringify(response.data, null, 2));
    
    const hasActiveDungeon = response.data?.data?.run !== null;
    console.log(`\n📊 Active dungeon: ${hasActiveDungeon ? 'YES' : 'NO'}`);
    
    if (hasActiveDungeon) {
      console.log('⚠️  Account has active dungeon - this might be blocking underhaul!');
    } else {
      console.log('✅ Account clean - no active dungeon');
    }
    
    return response.data;
  } catch (error) {
    console.log('❌ Error checking state:', error.message);
  }
}

checkState();