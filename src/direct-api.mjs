import axios from 'axios';
import { config } from './config.mjs';

// Track the action token from previous responses
let currentActionToken = null;

// Create axios instance with auth
const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.jwtToken}`
  }
});

// Function to explicitly reset token (for new sessions)
export function resetActionToken() {
  currentActionToken = null;
  console.log('Action token reset for new session');
}

// Direct API wrapper that bypasses SDK
export async function sendDirectAction(action, dungeonId = 3, data = {}) {
  try {
    // Build payload with optional action token
    const payload = {
      action,
      dungeonType: dungeonId, // Actually needs dungeonType, not dungeonId
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
    
    // If token error and we had a token, try once without it
    if (error.response?.data?.message?.includes('Invalid action token') && currentActionToken) {
      console.log('Token error - retrying without token...');
      currentActionToken = null;
      
      const retryPayload = {
        action,
        dungeonType: dungeonId,
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

// Send loot action directly
export async function sendDirectLootAction(action, dungeonId = 3) {
  try {
    // Build payload for loot action
    const payload = {
      action,
      dungeonType: dungeonId // Actually needs dungeonType
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
        dungeonType: dungeonId
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