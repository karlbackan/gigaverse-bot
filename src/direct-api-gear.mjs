import { config } from './config.mjs';
import axios from 'axios';

// Create axios instance for gear API
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

// Get player's gear instances
export async function getDirectGearInstances(address = config.walletAddress) {
  try {
    const response = await api.get(`/gear/instances/${address}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get gear instances:', error.message);
    throw error;
  }
}

// Get equipped gear instance IDs
export async function getEquippedGearIds(address = config.walletAddress) {
  try {
    const gearResponse = await getDirectGearInstances(address);
    const gearEntities = gearResponse?.entities || [];
    
    // Filter for equipped gear (EQUIPPED_TO_SLOT_CID > -1)
    const equippedGear = gearEntities.filter(gear => gear.EQUIPPED_TO_SLOT_CID > -1);
    
    // Return array of docIds (gear instance IDs)
    return equippedGear.map(gear => gear.docId);
  } catch (error) {
    console.error('Failed to get equipped gear IDs:', error.message);
    return []; // Return empty array on error
  }
}