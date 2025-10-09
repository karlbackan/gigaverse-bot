import { config } from './config.mjs';
import axios from 'axios';
import https from 'https';

// Create HTTPS agent with Keep-Alive for persistent connections
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 2
});

// Create axios instance for gear API
const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json'
  },
  httpsAgent: httpsAgent
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

// Get equipped gear instance IDs (only functional gear with durability > 0)
export async function getEquippedGearIds(address = config.walletAddress) {
  try {
    const gearResponse = await getDirectGearInstances(address);
    const gearEntities = gearResponse?.entities || [];

    // Filter for equipped gear (EQUIPPED_TO_SLOT_CID > -1)
    const equippedGear = gearEntities.filter(gear => gear.EQUIPPED_TO_SLOT_CID > -1);

    // CRITICAL: Also filter out broken gear (0 durability)
    // API rejects dungeon start with broken gear ("Error handling action")
    const functionalGear = equippedGear.filter(gear => {
      const durability = gear.DURABILITY_CID;

      // Skip gear with 0 durability (broken)
      if (durability === 0) {
        console.log(`⚠️  Skipping broken gear: Slot ${gear.EQUIPPED_TO_SLOT_CID} has 0 durability`);
        return false;
      }

      return true;
    });

    if (functionalGear.length < equippedGear.length) {
      console.log(`⚠️  ${equippedGear.length - functionalGear.length} equipped items are broken and will be excluded from dungeon`);
    }

    // Return array of docIds (gear instance IDs) for functional gear only
    return functionalGear.map(gear => gear.docId);
  } catch (error) {
    console.error('Failed to get equipped gear IDs:', error.message);
    return []; // Return empty array on error
  }
}