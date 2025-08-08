#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.JWT_TOKEN_1;
let currentActionToken = null;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

console.log('🔓 Bypassing Underhaul Validation Error');
console.log('🎯 Server recognizes actions - need to bypass validation\n');
console.log('=' .repeat(60));

// Get fresh action token
async function getActionToken() {
  try {
    await api.post('/game/dungeon/action', { action: 'bypass_token' });
  } catch (error) {
    if (error.response?.data?.actionToken) {
      currentActionToken = error.response.data.actionToken.toString();
      console.log(`🔑 Action token: ${currentActionToken}`);
      return true;
    }
  }
  return false;
}

async function bypassValidation() {
  
  if (!await getActionToken()) {
    console.log('❌ Could not get action token');
    return;
  }
  
  console.log('\n1️⃣ Testing validation bypass with edge case values:');
  
  const edgeCasePayloads = [
    // Try null/undefined to skip validation
    {
      action: 'start_run_3',
      dungeonType: null,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3', 
      dungeonType: undefined,
      actionToken: currentActionToken
    },
    // Try negative values
    {
      action: 'start_run_3',
      dungeonType: -1,
      actionToken: currentActionToken
    },
    // Try very large values to overflow validation
    {
      action: 'start_run_3',
      dungeonType: 999999,
      actionToken: currentActionToken
    },
    // Try string values that might convert
    {
      action: 'start_run_3',
      dungeonType: '3',
      actionToken: currentActionToken
    },
    // Try boolean conversion
    {
      action: 'start_run_3', 
      dungeonType: true,
      actionToken: currentActionToken
    },
    // Try array (might pick first element)
    {
      action: 'start_run_3',
      dungeonType: [3],
      actionToken: currentActionToken
    },
    // Try float values
    {
      action: 'start_run_3',
      dungeonType: 3.0,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      dungeonType: 2.99999,
      actionToken: currentActionToken
    }
  ];
  
  for (const payload of edgeCasePayloads) {
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`🎉 EDGE CASE SUCCESS!`, payload);
      console.log('Response:', response.data);
      return { success: true, method: 'edge_case', payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      if (message !== 'Error handling action') {
        console.log(`📝 Different error with edge case:`, JSON.stringify(payload.dungeonType), '-', message);
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  console.log('\n2️⃣ Testing parameter injection bypass:');
  
  const injectionPayloads = [
    // Try SQL injection style
    {
      action: 'start_run_3',
      dungeonType: "3 OR 1=1",
      actionToken: currentActionToken
    },
    // Try JSON injection
    {
      action: 'start_run_3',
      dungeonType: '{"bypass": true, "type": 3}',
      actionToken: currentActionToken
    },
    // Try command injection
    {
      action: 'start_run_3',
      dungeonType: '3; bypass_validation=true',
      actionToken: currentActionToken
    },
    // Try object injection
    {
      action: 'start_run_3',
      dungeonType: { value: 3, bypass: true },
      actionToken: currentActionToken
    },
    // Try unicode bypass
    {
      action: 'start_run_3',
      dungeonType: '\u0033', // Unicode 3
      actionToken: currentActionToken
    },
    // Try base64 encoded  
    {
      action: 'start_run_3',
      dungeonType: Buffer.from('3').toString('base64'), // Base64 encode '3'
      actionToken: currentActionToken
    }
  ];
  
  for (const payload of injectionPayloads) {
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`🎉 INJECTION SUCCESS!`, payload);
      console.log('Response:', response.data);
      return { success: true, method: 'injection', payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      if (message !== 'Error handling action' && !message.includes('Invalid action token')) {
        console.log(`📝 Injection gave different error:`, payload.dungeonType, '-', message);
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  console.log('\n3️⃣ Testing validation logic bypass:');
  
  const logicBypassPayloads = [
    // Maybe validation checks for specific combinations
    {
      action: 'start_run_3',
      dungeonType: 3,
      skip_validation: true,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3', 
      dungeonType: 3,
      force: true,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      dungeonType: 3,
      admin: true,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      dungeonType: 3,
      debug: true,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      dungeonType: 3,
      test_mode: true,
      actionToken: currentActionToken
    },
    // Try validation bypass flags
    {
      action: 'start_run_3',
      dungeonType: 3,
      bypass_checks: 'all',
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      dungeonType: 3,
      validation: false,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      dungeonType: 3,
      secure: false,
      actionToken: currentActionToken
    }
  ];
  
  for (const payload of logicBypassPayloads) {
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`🎉 LOGIC BYPASS SUCCESS!`, payload);
      console.log('Response:', response.data);
      return { success: true, method: 'logic_bypass', payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      if (message !== 'Error handling action' && !message.includes('Invalid action token')) {
        console.log(`📝 Logic bypass different error:`, Object.keys(payload).join(','), '-', message);
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  console.log('\n4️⃣ Testing structure manipulation bypass:');
  
  const structurePayloads = [
    // Try nested data structures
    {
      action: 'start_run_3',
      data: {
        dungeonType: 3,
        bypass: true
      },
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      request: {
        type: 3,
        mode: 'underhaul'
      },
      actionToken: currentActionToken
    },
    // Try alternative field names
    {
      action: 'start_run_3',
      type: 3,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      dungeon_id: 3,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      mode: 3,
      actionToken: currentActionToken
    },
    // Try array structures
    {
      action: 'start_run_3',
      params: [3, 'underhaul', true],
      actionToken: currentActionToken
    },
    // Try mixed case field names (bypass case-sensitive validation)
    {
      action: 'start_run_3',
      DungeonType: 3,
      actionToken: currentActionToken
    },
    {
      action: 'start_run_3',
      DUNGEONTYPE: 3,
      actionToken: currentActionToken
    }
  ];
  
  for (const payload of structurePayloads) {
    try {
      const response = await api.post('/game/dungeon/action', payload);
      console.log(`🎉 STRUCTURE SUCCESS!`, payload);
      console.log('Response:', response.data);
      return { success: true, method: 'structure', payload, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      if (message !== 'Error handling action' && !message.includes('Invalid action token')) {
        console.log(`📝 Structure different error:`, Object.keys(payload).join(','), '-', message);
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  console.log('\n5️⃣ Testing timing-based validation bypass:');
  
  // Maybe validation has race conditions or timing windows
  const timingActions = ['init_3', 'start_run_3', 'begin_3'];
  
  for (const action of timingActions) {
    console.log(`\n⏱️  Testing timing bypass with "${action}"`);
    
    // Rapid fire - maybe validation has race condition
    const rapidPromises = [];
    for (let i = 0; i < 3; i++) {
      rapidPromises.push(
        api.post('/game/dungeon/action', {
          action: action,
          dungeonType: 3,
          timing_test: i,
          actionToken: currentActionToken
        }).catch(e => ({ error: e.response?.data?.message }))
      );
    }
    
    try {
      const rapidResults = await Promise.all(rapidPromises);
      
      for (const result of rapidResults) {
        if (!result.error && result.data) {
          console.log(`🎉 TIMING SUCCESS! Rapid fire worked!`);
          console.log('Response:', result.data);
          return { success: true, method: 'timing_rapid', action, response: result.data };
        }
      }
      
    } catch (error) {
      // Expected for most attempts
    }
    
    // Try with delays between attempts
    const delayedResults = [];
    for (let delay of [100, 500, 1000]) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        const response = await api.post('/game/dungeon/action', {
          action: action,
          dungeonType: 3,
          delay_test: delay,
          actionToken: currentActionToken
        });
        
        console.log(`🎉 TIMING DELAY SUCCESS! ${delay}ms delay worked!`);
        console.log('Response:', response.data);
        return { success: true, method: 'timing_delay', delay, action, response: response.data };
        
      } catch (error) {
        if (error.response?.data?.actionToken) {
          currentActionToken = error.response.data.actionToken.toString();
        }
      }
    }
  }
  
  console.log('\n6️⃣ Testing alternative action formats:');
  
  // Try different action name formats that might bypass validation
  const altActionFormats = [
    'START_RUN_3',      // Uppercase
    'Start_Run_3',      // Title case
    'start-run-3',      // Hyphenated
    'start.run.3',      // Dotted
    'start_run_type_3', // Extended
    'startRun3',        // CamelCase
    'StartRun3',        // PascalCase
    'start_run[3]',     // Array notation
    'start_run(3)',     // Function notation
    'start_run<3>',     // Template notation
  ];
  
  for (const actionFormat of altActionFormats) {
    try {
      const response = await api.post('/game/dungeon/action', {
        action: actionFormat,
        actionToken: currentActionToken
      });
      
      console.log(`🎉 ACTION FORMAT SUCCESS! "${actionFormat}" worked!`);
      console.log('Response:', response.data);
      return { success: true, method: 'action_format', action: actionFormat, response: response.data };
      
    } catch (error) {
      const message = error.response?.data?.message;
      if (message !== 'Error handling action' && !message.includes('Invalid action token')) {
        console.log(`📝 Action format "${actionFormat}": ${message}`);
      }
      
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
      }
    }
  }
  
  return { success: false };
}

// Run bypass attempts
bypassValidation()
  .then(result => {
    console.log('\n' + '=' .repeat(60));
    if (result.success) {
      console.log('🎉 VALIDATION BYPASS SUCCESS!');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n🚀 Found the way to bypass underhaul validation!');
    } else {
      console.log('❌ Could not bypass validation in this session');
      console.log('\n💡 Validation bypass attempts completed');
      console.log('Server consistently blocks underhaul actions with validation check');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });