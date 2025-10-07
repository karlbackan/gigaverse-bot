#!/usr/bin/env node

/**
 * Check health of all accounts by testing dungeon state access
 * Identifies which accounts have server-side corruption
 */

import 'dotenv/config';
import axios from 'axios';

const accounts = [
  { name: 'Account 1 (loki)', token: process.env.JWT_TOKEN_1, address: '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0' },
  { name: 'Account 2', token: process.env.JWT_TOKEN_2, address: '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816' },
  { name: 'Account 3', token: process.env.JWT_TOKEN_3, address: '0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963' },
  { name: 'Account 4', token: process.env.JWT_TOKEN_4, address: '0x2153433D4c13f72b5b10af5dF5fC93866Eea046b' },
  { name: 'Account 5', token: process.env.JWT_TOKEN_5, address: '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81' }
].filter(acc => acc.token);

console.log('🔍 Checking account health...\n');

for (const account of accounts) {
  try {
    const api = axios.create({
      baseURL: 'https://gigaverse.io/api',
      headers: {
        'Authorization': `Bearer ${account.token}`,
        'Content-Type': 'application/json'
      }
    });

    // Check dungeon state
    const dungeonState = await api.get('/game/dungeon/state');
    const hasActiveDungeon = dungeonState.data?.data?.run ? true : false;

    if (hasActiveDungeon) {
      const entity = dungeonState.data.data.entity;
      const dungeonType = entity?.ID_CID || 'unknown';
      const room = entity?.ROOM_NUM_CID || '?';
      const enemy = entity?.ENEMY_CID || '?';

      console.log(`✅ ${account.name} (${account.address.slice(0, 6)}...${account.address.slice(-4)})`);
      console.log(`   Active dungeon: Type ${dungeonType}, Room ${room}, Enemy ${enemy}`);

      // Try a test action to see if it works
      try {
        const testAction = await api.post('/game/dungeon/action', {
          action: 'rock',
          dungeonType: parseInt(dungeonType),
          dungeonId: parseInt(dungeonType),
          data: {}
        });

        if (testAction.data.actionToken) {
          console.log(`   ✅ Test action successful - NO CORRUPTION`);
        }
      } catch (testError) {
        if (testError.response?.data?.message === 'Error handling action') {
          console.log(`   ❌ Test action failed: "Error handling action" - CORRUPTED`);
          console.log(`   💡 Fix: Play 1 turn manually at https://gigaverse.io`);
        } else {
          console.log(`   ⚠️  Test action error: ${testError.response?.data?.message || testError.message}`);
        }
      }
    } else {
      console.log(`✅ ${account.name} (${account.address.slice(0, 6)}...${account.address.slice(-4)})`);
      console.log(`   No active dungeon - CLEAN`);
    }

    console.log('');

  } catch (error) {
    console.log(`❌ ${account.name} (${account.address.slice(0, 6)}...${account.address.slice(-4)})`);
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    console.log('');
  }
}

console.log('✅ Health check complete');
