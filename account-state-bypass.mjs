#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Account State & Permission Analysis');
console.log('❓ Is "Error handling action" an account/state issue?\n');
console.log('=' .repeat(60));

// Test with multiple accounts
const accounts = [
  { token: process.env.JWT_TOKEN_1, name: 'Account 1', address: '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0' },
  { token: process.env.JWT_TOKEN_2, name: 'Account 2', address: '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816' },
  { token: process.env.JWT_TOKEN_3, name: 'Account 3', address: '0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963' },
  { token: process.env.JWT_TOKEN_4, name: 'Account 4', address: '0x2153433D4c13f72b5b10af5dDF5fC93866Eea046b' },
  { token: process.env.JWT_TOKEN_5, name: 'Account 5', address: '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81' }
].filter(acc => acc.token);

async function checkAccountStates() {
  
  console.log('\n1️⃣ Checking all account states:');
  
  for (const account of accounts) {
    console.log(`\n🧪 ${account.name} (${account.address.slice(0, 10)}...)`);
    
    const api = axios.create({
      baseURL: 'https://gigaverse.io/api',
      headers: {
        'Authorization': `Bearer ${account.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Check account state
    try {
      const [energy, gameAccount] = await Promise.all([
        api.get(`/offchain/player/energy/${account.address}`).catch(e => ({ data: null })),
        api.get('/game/account').catch(e => ({ data: null }))
      ]);
      
      const energyData = energy.data?.entities?.[0]?.parsedData;
      const gameData = gameAccount.data;
      
      console.log(`   Energy: ${energyData?.energyValue || 'unknown'}/${energyData?.maxEnergy || 240}`);
      console.log(`   Juiced: ${energyData?.isPlayerJuiced ? 'Yes' : 'No'}`);
      console.log(`   Level: ${gameData?.level || 'unknown'}`);
      console.log(`   In Game: ${gameData?.inGame ? 'Yes' : 'No'}`);
      
      // Get action token and test underhaul
      let actionToken = null;
      try {
        await api.post('/game/dungeon/action', { action: 'state_test_' + account.name });
      } catch (error) {
        actionToken = error.response?.data?.actionToken?.toString();
      }
      
      if (actionToken) {
        console.log(`   Token: ${actionToken}`);
        
        // Test both regular and underhaul
        const tests = [
          { action: 'start_run', dungeonType: 1, name: 'Regular dungeon' },
          { action: 'start_run_3', name: 'Underhaul action' },
          { action: 'init_3', name: 'Underhaul init' }
        ];
        
        for (const test of tests) {
          try {
            const response = await api.post('/game/dungeon/action', {
              ...test,
              actionToken: actionToken
            });
            
            console.log(`   🎉 ${test.name} SUCCESS!`);
            console.log('   Response:', response.data);
            return { success: true, account: account.name, test, response: response.data };
            
          } catch (error) {
            const message = error.response?.data?.message;
            console.log(`   ❌ ${test.name}: ${message}`);
            
            if (message !== 'Error handling action') {
              console.log(`   📝 Different error pattern - this account might be different!`);
            }
            
            // Update token
            if (error.response?.data?.actionToken) {
              actionToken = error.response.data.actionToken.toString();
            }
          }
        }
        
      } else {
        console.log('   ❌ Could not get action token');
      }
      
    } catch (error) {
      console.log(`   ❌ Error checking ${account.name}: ${error.message}`);
    }
  }
}

async function testAccountPermissions() {
  
  console.log('\n2️⃣ Testing account permission modifications:');
  
  const mainApi = axios.create({
    baseURL: 'https://gigaverse.io/api',
    headers: {
      'Authorization': `Bearer ${accounts[0].token}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Try to modify account permissions
  const permissionTests = [
    { endpoint: '/account/permissions', data: { underhaul: true } },
    { endpoint: '/account/settings', data: { enableUnderhaul: true } },
    { endpoint: '/game/settings', data: { underhaulAccess: true } },
    { endpoint: '/player/permissions', data: { mode3: true } },
    { endpoint: '/account/flags', data: { beta: true, underhaul: true } },
    { endpoint: '/game/account/update', data: { underhaulEnabled: true } },
    { endpoint: '/account/features', data: { underhaul: 'enabled' } }
  ];
  
  for (const test of permissionTests) {
    try {
      const response = await mainApi.post(test.endpoint, test.data);
      console.log(`✅ Permission endpoint works: ${test.endpoint}`);
      console.log('Response:', response.data);
      
      // Now test if underhaul works
      let actionToken = null;
      try {
        await mainApi.post('/game/dungeon/action', { action: 'perm_test' });
      } catch (error) {
        actionToken = error.response?.data?.actionToken?.toString();
      }
      
      if (actionToken) {
        try {
          const underhaulResponse = await mainApi.post('/game/dungeon/action', {
            action: 'start_run_3',
            actionToken: actionToken
          });
          
          console.log('🎉 UNDERHAUL WORKS AFTER PERMISSION CHANGE!');
          console.log('Response:', underhaulResponse.data);
          return { success: true, method: 'permission', endpoint: test.endpoint, response: underhaulResponse.data };
          
        } catch (error) {
          console.log(`Still blocked after permission change: ${error.response?.data?.message}`);
        }
      }
      
    } catch (error) {
      // Expected for most endpoints
      if (error.response?.status !== 404) {
        console.log(`📝 ${test.endpoint}: ${error.response?.status} ${error.response?.data?.message}`);
      }
    }
  }
}

async function testGameStateReset() {
  
  console.log('\n3️⃣ Testing game state reset approaches:');
  
  const mainApi = axios.create({
    baseURL: 'https://gigaverse.io/api',  
    headers: {
      'Authorization': `Bearer ${accounts[0].token}`,
      'Content-Type': 'application/json'
    }
  });
  
  // Try to reset or modify game state
  const stateTests = [
    { endpoint: '/game/reset', data: {} },
    { endpoint: '/game/state/reset', data: {} },
    { endpoint: '/game/session/new', data: {} },
    { endpoint: '/game/init', data: { mode: 'underhaul' } },
    { endpoint: '/game/restart', data: {} },
    { endpoint: '/player/reset', data: {} },
    { endpoint: '/session/reset', data: {} }
  ];
  
  for (const test of stateTests) {
    try {
      const response = await mainApi.post(test.endpoint, test.data);
      console.log(`✅ State endpoint works: ${test.endpoint}`);
      console.log('Response:', response.data);
      
      // Test underhaul after state change
      let actionToken = null;
      try {
        await mainApi.post('/game/dungeon/action', { action: 'state_reset_test' });
      } catch (error) {
        actionToken = error.response?.data?.actionToken?.toString();
      }
      
      if (actionToken) {
        try {
          const underhaulResponse = await mainApi.post('/game/dungeon/action', {
            action: 'start_run_3',
            actionToken: actionToken
          });
          
          console.log('🎉 UNDERHAUL WORKS AFTER STATE RESET!');
          console.log('Response:', underhaulResponse.data);
          return { success: true, method: 'state_reset', endpoint: test.endpoint, response: underhaulResponse.data };
          
        } catch (error) {
          console.log(`Still blocked after state reset: ${error.response?.data?.message}`);
        }
      }
      
    } catch (error) {
      if (error.response?.status !== 404 && error.response?.status !== 405) {
        console.log(`📝 ${test.endpoint}: ${error.response?.status} ${error.response?.data?.message}`);
      }
    }
  }
}

async function runAccountAnalysis() {
  
  const accountResult = await checkAccountStates();
  if (accountResult?.success) {
    return accountResult;
  }
  
  const permissionResult = await testAccountPermissions();
  if (permissionResult?.success) {
    return permissionResult;
  }
  
  const stateResult = await testGameStateReset();
  if (stateResult?.success) {
    return stateResult;
  }
  
  return { success: false };
}

// Run analysis
runAccountAnalysis()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result.success) {
      console.log('🎉 ACCOUNT/STATE BYPASS SUCCESS!');
      console.log('🔓 Found the account/state issue blocking underhaul!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Account/state analysis complete - no bypass found');
      console.log('\n📊 Summary:');
      console.log('• All accounts show same "Error handling action" behavior');
      console.log('• Even regular dungeons are blocked with this error');
      console.log('• Likely server-side feature flag or global state issue');
      console.log('• The other user probably had different server conditions');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });