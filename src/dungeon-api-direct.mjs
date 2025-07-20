import { gigaApi } from './api.mjs';

// Direct API call wrapper that uses the SDK sendAction method
export async function sendDungeonAction(action, dungeonType, data = {}) {
  try {
    const response = await gigaApi.sendAction({
      action,
      dungeonType,
      data: {
        consumables: data.consumables || [],
        itemId: data.itemId || 0,
        index: data.index || 0,
        isJuiced: data.isJuiced || false,
        gearInstanceIds: data.gearInstanceIds || []
      }
    });
    
    return response;
  } catch (error) {
    console.error('API Error Details:', {
      message: error.message,
      response: error.response?.data
    });
    throw error;
  }
}

// Get current dungeon state using SDK
export async function getDungeonState() {
  try {
    return await gigaApi.getDungeonState();
  } catch (error) {
    throw new Error('Failed to get dungeon state');
  }
}