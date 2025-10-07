import axios from 'axios';
import { config } from './config.mjs';

// Track the action token from previous responses
let currentActionToken = null;

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
  }
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

// Function to explicitly reset token (for new sessions)
export function resetActionToken() {
  currentActionToken = null;
  console.log('Action token reset for new session');
}

// Direct API wrapper that bypasses SDK
export async function sendDirectAction(action, dungeonType, data = {}) {
  try {
    // Ensure dungeonType is always provided
    if (!dungeonType) {
      throw new Error('dungeonType is required for sendDirectAction');
    }
    
    // Build payload with optional action token
    const payload = {
      action,
      dungeonType: dungeonType,  // Send both parameters for compatibility
      dungeonId: dungeonType,    // Some implementations may use dungeonId
      data
    };
    
    // Include action token if we have one from previous response
    if (currentActionToken) {
      payload.actionToken = currentActionToken;
    }
    
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
    // For "Error handling action", save the new token if provided, otherwise reset
    if (error.response?.data?.message === 'Error handling action') {
      const accountShort = config.walletAddress?.slice(0, 6) + '...' + config.walletAddress?.slice(-4);
      if (error.response?.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log(`  [${accountShort}] Saved new action token from "Error handling action": ${currentActionToken}`);
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
        dungeonType: dungeonType,  // Send both parameters for compatibility
        dungeonId: dungeonType,    // Some implementations may use dungeonId
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
    const payload = {
      action,
      dungeonType: dungeonType,  // Send both parameters for compatibility
      dungeonId: dungeonType     // Some implementations may use dungeonId
    };
    
    // Include action token if we have one from previous response
    if (currentActionToken) {
      payload.actionToken = currentActionToken;
    }
    
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
    
    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying loot without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action,
        dungeonType: dungeonType,  // Send both parameters for compatibility
        dungeonId: dungeonType     // Some implementations may use dungeonId
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
