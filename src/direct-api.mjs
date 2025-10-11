import axios from 'axios';
import https from 'https';
import { config } from './config.mjs';

// Track the action token from previous responses
let currentActionToken = null;

// Create HTTPS agent with Keep-Alive enabled
// This reuses connections instead of creating new sockets for each request
// Server may track state per connection, so reusing prevents "Error handling action"
let httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000, // Keep connection alive for 30 seconds
  maxSockets: 10,
  maxFreeSockets: 2
});

/*
COMMON API ERROR PATTERNS:

Status Code Guide:
- 400 Bad Request: Invalid parameters, malformed request, validation errors
- 401 Unauthorized: Invalid JWT token, token expired, authentication failed
- 403 Forbidden: Valid token but insufficient permissions
- 404 Not Found: Endpoint doesn't exist, resource not found
- 429 Too Many Requests: Rate limiting in effect
- 500+ Server Error: Internal server issues, database problems, API crashes

Common Error Messages:
- "Error handling action" → Usually stale action token, reset and retry
- "Invalid action token" → Token mismatch, retry without token
- "Dungeon not found" → Invalid dungeon type or session expired
- "Insufficient energy" → Player doesn't have enough energy for action
- "Player not found" → Invalid wallet address or player doesn't exist
- "Invalid move" → Rock/paper/scissor move not recognized
- "Dungeon already completed" → Trying to continue finished dungeon
- "Maximum attempts reached" → Daily dungeon limit exceeded

Token Management:
- Action tokens are required for dungeon actions after the first API call
- Tokens become invalid when sessions expire or dungeons end
- Always retry once without token if "Invalid action token" error occurs
- Reset tokens on "Error handling action" to clear stale state
*/

// Create axios instance without auth (will be added in interceptor)
const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json'
  },
  httpsAgent: httpsAgent  // Use persistent connections
});

// Add request interceptor to use current JWT token
api.interceptors.request.use((requestConfig) => {
  // Use current token from environment or fallback to config
  const currentToken = process.env.JWT_TOKEN || config.jwtToken;
  requestConfig.headers.Authorization = `Bearer ${currentToken}`;
  
  return requestConfig;
}, (error) => {
  return Promise.reject(error);
});

// Function to get current action token (for checking if we have one)
export function getCurrentActionToken() {
  return currentActionToken;
}

// Function to explicitly set the action token (for continuing existing dungeons)
export function setActionToken(token) {
  currentActionToken = token ? token.toString() : null;
  if (currentActionToken) {
    console.log(`🔄 Loaded existing action token: ${currentActionToken}`);
  }
}

// Function to explicitly reset token and connections (for new sessions/accounts)
export function resetActionToken() {
  currentActionToken = null;

  // CRITICAL: Destroy all Keep-Alive connections when switching accounts
  // Without this, the next account reuses connections from previous account's session
  // This causes "Error handling action" because server thinks it's the old account
  if (httpsAgent) {
    httpsAgent.destroy();
  }

  // Create fresh HTTPS agent for new account
  httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 10,
    maxFreeSockets: 2
  });

  // Update axios instance to use new agent
  api.defaults.httpsAgent = httpsAgent;

  console.log('✅ Action token and HTTPS connections reset for new session');
}

// Direct API wrapper that bypasses SDK
export async function sendDirectAction(action, dungeonType, data = {}) {
  try {
    // Ensure dungeonType is always provided
    if (!dungeonType) {
      throw new Error('dungeonType is required for sendDirectAction');
    }
    
    // Build payload with optional action token
    // CRITICAL FIX (2025-10-11): Browser sends dungeonId=0 for all actions EXCEPT start_run
    // start_run uses dungeonId=dungeonType, but ALL combat/loot actions use dungeonId=0
    const payload = {
      action,
      actionToken: currentActionToken || "",  // Always include, use empty string if no token
      dungeonId: action === 'start_run' ? dungeonType : 0,  // 0 for all actions except start_run
      data
    };
    
    const accountShort = config.walletAddress?.slice(0, 6) + '...' + config.walletAddress?.slice(-4);
    console.log(`Direct API sending [${accountShort}]:`, JSON.stringify(payload));

    const startTime = Date.now();
    const response = await api.post('/game/dungeon/action', payload);
    const responseTime = Date.now() - startTime;

    if (responseTime > 3000) {
      console.log(`  ⚠️ Slow response: ${responseTime}ms (token may have expired)`);
    }

    // Extract and save the action token for next request
    if (response.data?.actionToken) {
      currentActionToken = response.data.actionToken.toString();
      console.log(`  Saved action token: ${currentActionToken}`);

      // RACE CONDITION FIX: Wait 2 seconds for serverless state propagation
      // Vercel edge functions need time to sync state across distributed nodes
      // Without this delay, next action may hit different edge node with stale state
      console.log(`  Waiting 2s for state propagation...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('  No action token in response');
    }

    return {
      success: true,
      data: response.data.data,
      message: response.data.message
    };
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    // Show concise, user-friendly error messages
    if (status === 400) {
      console.error(`❌ API Error (${status}): ${message}`);
    } else if (status === 401) {
      console.error(`🔐 Authentication Error (${status}): ${message}`);
    } else if (status === 403) {
      console.error(`⛔ Access Denied (${status}): ${message}`);
    } else if (status === 404) {
      console.error(`🔍 Not Found (${status}): ${message}`);
    } else if (status === 429) {
      console.error(`⏰ Rate Limited (${status}): ${message}`);
    } else if (status >= 500) {
      console.error(`🔥 Server Error (${status}): ${message}`);
    } else {
      console.error(`⚠️  API Error: ${message || 'Unknown error'}`);
    }
    
    // Save action token even from error responses
    // For "Error handling action", save the new token and RETRY with it
    if (error.response?.data?.message === 'Error handling action') {
      const accountShort = config.walletAddress?.slice(0, 6) + '...' + config.walletAddress?.slice(-4);

      // Log FULL error response for debugging
      console.log('\n📋 FULL ERROR RESPONSE:');
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log('');

      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log(`  [${accountShort}] Got new action token from "Error handling action": ${currentActionToken}`);
        console.log(`  Retrying IMMEDIATELY with new token...`);

        // RETRY with the new token from the error response
        const retryPayload = {
          action,
          actionToken: currentActionToken,
          dungeonId: action === 'start_run' ? dungeonType : 0,  // 0 for all actions except start_run
          data
        };

        try {
          // CRITICAL: Do NOT wait before retry! The server generates new tokens rapidly.
          // If we wait, the token becomes stale and retry fails with "Invalid action token".

          const retryResponse = await api.post('/game/dungeon/action', retryPayload);

          // Extract and save the action token from successful retry
          if (retryResponse.data?.actionToken) {
            currentActionToken = retryResponse.data.actionToken.toString();
            console.log(`  ✅ Retry succeeded! New action token: ${currentActionToken}`);

            // Wait for state propagation after successful retry
            console.log(`  Waiting 2s for state propagation...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          return {
            success: true,
            data: retryResponse.data.data,
            message: retryResponse.data.message
          };
        } catch (retryError) {
          console.error(`  ❌ Retry with new token failed: ${retryError.response?.data?.message || retryError.message}`);
          // Log FULL retry error response
          if (retryError.response?.data) {
            console.log('\n📋 FULL RETRY ERROR RESPONSE:');
            console.log(JSON.stringify(retryError.response.data, null, 2));
            console.log('');
          }
          throw retryError;
        }
      } else {
        console.log('  Resetting action token due to "Error handling action" error with no new token');
        currentActionToken = null;
      }
    } else if (error.response?.data?.actionToken) {
      currentActionToken = error.response.data.actionToken.toString();
      console.log(`  Saved action token from error: ${currentActionToken}`);
    }

    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action,
        actionToken: "",  // Empty string for fresh start
        dungeonId: action === 'start_run' ? dungeonType : 0,  // 0 for all actions except start_run
        data
      };
      
      try {
        const retryResponse = await api.post('/game/dungeon/action', retryPayload);

        // Extract and save the new token
        if (retryResponse.data?.actionToken) {
          currentActionToken = retryResponse.data.actionToken.toString();
          console.log(`  New action token: ${currentActionToken}`);

          // RACE CONDITION FIX: Wait 2 seconds for serverless state propagation
          console.log(`  Waiting 2s for state propagation...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return {
          success: true,
          data: retryResponse.data.data,
          message: retryResponse.data.message
        };
      } catch (retryError) {
        console.error('Retry also failed');
        throw retryError;
      }
    }
    
    // Preserve error response data for statistics recording
    if (error.response?.data) {
      error.errorResponseData = error.response.data;
    }
    throw error;
  }
}

// Get dungeon state directly
export async function getDirectDungeonState() {
  try {
    const response = await api.get('/game/dungeon/state');
    // Don't reset token here - only reset on actual session start or errors
    return response.data;
  } catch (error) {
    console.error(`🏰 Dungeon State Error: ${error.message}`);
    throw error;
  }
}

// Get player energy directly
export async function getDirectEnergy(address = config.walletAddress) {
  try {
    const response = await api.get(`/offchain/player/energy/${address}`);
    return response.data;
  } catch (error) {
    console.error(`⚡ Energy Error: ${error.message}`);
    throw error;
  }
}

// Get account info directly
export async function getDirectAccount(address = config.walletAddress) {
  try {
    const response = await api.get(`/account/${address}`);
    return response.data;
  } catch (error) {
    console.error(`👤 Account Error: ${error.message}`);
    throw error;
  }
}

// Get inventory directly
export async function getDirectInventory(address = config.walletAddress) {
  try {
    const response = await api.get(`/indexer/player/gameitems/${address}`);
    return response.data;
  } catch (error) {
    console.error(`🎒 Inventory Error: ${error.message}`);
    throw error;
  }
}

// Get available dungeons directly
export async function getDirectAvailableDungeons() {
  try {
    const response = await api.get('/game/dungeon/today');
    return response.data;
  } catch (error) {
    console.error(`🗂️  Available Dungeons Error: ${error.message}`);
    throw error;
  }
}

// DEPRECATED: Use sendDirectAction with both dungeonType and dungeonId parameters instead
// This function is kept for backward compatibility but should not be used

// DEPRECATED: Use sendDirectLootAction with both dungeonType and dungeonId parameters instead
// This function is kept for backward compatibility but should not be used

// Send loot action directly
export async function sendDirectLootAction(action, dungeonType) {
  try {
    // Ensure dungeonType is always provided
    if (!dungeonType) {
      throw new Error('dungeonType is required for sendDirectLootAction');
    }
    
    // Build payload for loot action
    // CRITICAL FIX (2025-10-11): Loot actions also use dungeonId=0, not dungeonType
    const payload = {
      action,
      actionToken: currentActionToken || "",  // Always include, use empty string if no token
      dungeonId: 0,  // Loot actions always use 0, never dungeonType
      data: {
        consumables: [],
        itemId: 0,
        index: 0,
        isJuiced: false,
        gearInstanceIds: []
      }
    };
    
    console.log('Direct API loot sending:', JSON.stringify(payload));

    const response = await api.post('/game/dungeon/action', payload);

    // Extract and save the action token for next request
    if (response.data?.actionToken) {
      currentActionToken = response.data.actionToken.toString();
      console.log(`  Saved action token: ${currentActionToken}`);

      // RACE CONDITION FIX: Wait 2 seconds for serverless state propagation
      console.log(`  Waiting 2s for state propagation...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('  No action token in response');
    }

    return {
      success: true,
      data: response.data.data,
      message: response.data.message
    };
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    // Show concise loot error messages
    if (status === 400) {
      console.error(`❌ Loot Error (${status}): ${message}`);
    } else if (status === 401) {
      console.error(`🔐 Loot Auth Error (${status}): ${message}`);
    } else if (status >= 500) {
      console.error(`🔥 Loot Server Error (${status}): ${message}`);
    } else {
      console.error(`⚠️  Loot Error: ${message || 'Unknown loot error'}`);
    }

    // For "Error handling action", save the new token and RETRY with it
    if (error.response?.data?.message === 'Error handling action') {
      // Log FULL error response for debugging
      console.log('\n📋 FULL LOOT ERROR RESPONSE:');
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log('');

      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log(`  Got new action token from loot "Error handling action": ${currentActionToken}`);
        console.log(`  Retrying loot IMMEDIATELY with new token...`);

        // RETRY loot with the new token from the error response
        const retryPayload = {
          action,
          actionToken: currentActionToken,
          dungeonId: 0,  // Loot actions always use 0
          data: {
            consumables: [],
            itemId: 0,
            index: 0,
            isJuiced: false,
            gearInstanceIds: []
          }
        };

        try {
          // CRITICAL: Do NOT wait before retry! Tokens expire rapidly.

          const retryResponse = await api.post('/game/dungeon/action', retryPayload);

          // Extract and save the action token from successful retry
          if (retryResponse.data?.actionToken) {
            currentActionToken = retryResponse.data.actionToken.toString();
            console.log(`  ✅ Loot retry succeeded! New action token: ${currentActionToken}`);

            // Wait for state propagation after successful retry
            console.log(`  Waiting 2s for state propagation...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          return {
            success: true,
            data: retryResponse.data.data,
            message: retryResponse.data.message
          };
        } catch (retryError) {
          console.error(`  ❌ Loot retry with new token failed: ${retryError.response?.data?.message || retryError.message}`);
          throw retryError;
        }
      } else {
        console.log('  Resetting action token due to loot "Error handling action" error with no new token');
        currentActionToken = null;
      }
    }

    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying loot without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action,
        actionToken: "",  // Empty string for fresh start
        dungeonId: 0,  // Loot actions always use 0
        data: {
          consumables: [],
          itemId: 0,
          index: 0,
          isJuiced: false,
          gearInstanceIds: []
        }
      };
      
      try {
        const retryResponse = await api.post('/game/dungeon/action', retryPayload);

        // Extract and save the new token
        if (retryResponse.data?.actionToken) {
          currentActionToken = retryResponse.data.actionToken.toString();
          console.log(`  New action token: ${currentActionToken}`);

          // RACE CONDITION FIX: Wait 2 seconds for serverless state propagation
          console.log(`  Waiting 2s for state propagation...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return {
          success: true,
          data: retryResponse.data.data,
          message: retryResponse.data.message
        };
      } catch (retryError) {
        console.error('Retry also failed');
        throw retryError;
      }
    }
    
    throw error;
  }
}
