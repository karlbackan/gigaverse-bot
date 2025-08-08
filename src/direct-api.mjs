import axios from 'axios';
import { config } from './config.mjs';

// Track the action token from previous responses
let currentActionToken = null;

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
      dungeonId: dungeonType,  // API uses dungeonId, not dungeonType
      data
    };
    
    // Include action token if we have one from previous response
    if (currentActionToken) {
      payload.actionToken = currentActionToken;
    }
    
    console.log('Direct API sending:', JSON.stringify(payload));
    
    const response = await api.post('/game/dungeon/action', payload);
    
    // Extract and save the action token for next request
    if (response.data?.actionToken) {
      currentActionToken = response.data.actionToken.toString();
      console.log(`  Saved action token: ${currentActionToken}`);
    } else {
      console.log('  No action token in response');
    }
    
    return {
      success: true,
      data: response.data.data,
      message: response.data.message
    };
  } catch (error) {
    console.error('Direct API Error:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    
    // Save action token even from error responses
    if (error.response?.data?.actionToken) {
      currentActionToken = error.response.data.actionToken.toString();
      console.log(`  Saved action token from error: ${currentActionToken}`);
    }
    
    // For "Error handling action", reset token - it might be from previous session
    if (error.response?.data?.message === 'Error handling action') {
      console.log('  Resetting action token due to "Error handling action" error');
      currentActionToken = null;
    }
    
    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action,
        dungeonId: dungeonType,  // API uses dungeonId, not dungeonType
        data
      };
      
      try {
        const retryResponse = await api.post('/game/dungeon/action', retryPayload);
        
        // Extract and save the new token
        if (retryResponse.data?.actionToken) {
          currentActionToken = retryResponse.data.actionToken.toString();
          console.log(`  New action token: ${currentActionToken}`);
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

// Get dungeon state directly
export async function getDirectDungeonState() {
  try {
    const response = await api.get('/game/dungeon/state');
    // Don't reset token here - only reset on actual session start or errors
    return response.data;
  } catch (error) {
    console.error('Failed to get dungeon state:', error.message);
    throw error;
  }
}

// Get player energy directly
export async function getDirectEnergy(address = config.walletAddress) {
  try {
    const response = await api.get(`/offchain/player/energy/${address}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get energy:', error.message);
    throw error;
  }
}

// Get account info directly
export async function getDirectAccount(address = config.walletAddress) {
  try {
    const response = await api.get(`/account/${address}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get account:', error.message);
    throw error;
  }
}

// Get inventory directly
export async function getDirectInventory(address = config.walletAddress) {
  try {
    const response = await api.get(`/indexer/player/gameitems/${address}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get inventory:', error.message);
    throw error;
  }
}

// Get available dungeons directly
export async function getDirectAvailableDungeons() {
  try {
    const response = await api.get('/game/dungeon/today');
    return response.data;
  } catch (error) {
    console.error('Failed to get available dungeons:', error.message);
    throw error;
  }
}

// Send Underhaul action to correct endpoint  
export async function sendUnderhaulAction(action, data = {}) {
  try {
    // Build payload for Underhaul action
    const payload = {
      action,
      data
    };
    
    // Include action token if we have one from previous response
    if (currentActionToken) {
      payload.actionToken = currentActionToken;
    }
    
    console.log('Underhaul API sending:', JSON.stringify(payload));
    
    const response = await api.post('/game/underhaul/action', payload);
    
    // Extract and save the action token for next request
    if (response.data?.actionToken) {
      currentActionToken = response.data.actionToken.toString();
      console.log(`  Saved action token: ${currentActionToken}`);
    } else {
      console.log('  No action token in response');
    }
    
    return {
      success: true,
      data: response.data.data,
      message: response.data.message
    };
  } catch (error) {
    console.error('Underhaul API Error:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    
    // Save action token even from error responses
    if (error.response?.data?.actionToken) {
      currentActionToken = error.response.data.actionToken.toString();
      console.log(`  Saved action token from error: ${currentActionToken}`);
    }
    
    // For "Error handling action", reset token - it might be from previous session
    if (error.response?.data?.message === 'Error handling action') {
      console.log('  Resetting action token due to "Error handling action" error');
      currentActionToken = null;
    }
    
    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action,
        data
      };
      
      try {
        const retryResponse = await api.post('/game/underhaul/action', retryPayload);
        
        // Extract and save the new token
        if (retryResponse.data?.actionToken) {
          currentActionToken = retryResponse.data.actionToken.toString();
          console.log(`  New action token: ${currentActionToken}`);
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

// Send Underhaul loot action to correct endpoint
export async function sendUnderhaulLootAction(action) {
  try {
    // Build payload for Underhaul loot action
    const payload = {
      action
    };
    
    // Include action token if we have one from previous response
    if (currentActionToken) {
      payload.actionToken = currentActionToken;
    }
    
    console.log('Underhaul loot API sending:', JSON.stringify(payload));
    
    const response = await api.post('/game/underhaul/action', payload);
    
    // Extract and save the action token for next request
    if (response.data?.actionToken) {
      currentActionToken = response.data.actionToken.toString();
      console.log(`  Saved action token: ${currentActionToken}`);
    } else {
      console.log('  No action token in response');
    }
    
    return {
      success: true,
      data: response.data.data,
      message: response.data.message
    };
  } catch (error) {
    console.error('Underhaul Loot API Error:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    
    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying loot without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action
      };
      
      try {
        const retryResponse = await api.post('/game/underhaul/action', retryPayload);
        
        // Extract and save the new token
        if (retryResponse.data?.actionToken) {
          currentActionToken = retryResponse.data.actionToken.toString();
          console.log(`  New action token: ${currentActionToken}`);
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
      dungeonId: dungeonType  // API uses dungeonId, not dungeonType
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
    } else {
      console.log('  No action token in response');
    }
    
    return {
      success: true,
      data: response.data.data,
      message: response.data.message
    };
  } catch (error) {
    console.error('Direct API Loot Error:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    
    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying loot without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action,
        dungeonId: dungeonType  // API uses dungeonId, not dungeonType
      };
      
      try {
        const retryResponse = await api.post('/game/dungeon/action', retryPayload);
        
        // Extract and save the new token
        if (retryResponse.data?.actionToken) {
          currentActionToken = retryResponse.data.actionToken.toString();
          console.log(`  New action token: ${currentActionToken}`);
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
