import { config } from './config.mjs';
import axios from 'axios';
import https from 'https';

// Create HTTPS agent with Keep-Alive for persistent connections
let httpsAgent = new https.Agent({
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

// Reset gear API connections when switching accounts
export function resetGearConnections() {
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
}

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

// Get equipped gear AND charm instance IDs (only functional items with durability > 0)
export async function getEquippedGearIds(address = config.walletAddress) {
  try {
    const allFunctionalIds = [];

    // Fetch all items from gear instances API
    const gearResponse = await getDirectGearInstances(address);
    const allItems = gearResponse?.entities || [];

    // Filter for equipped items (EQUIPPED_TO_SLOT_CID > -1)
    const equippedItems = allItems.filter(item =>
      item.EQUIPPED_TO_SLOT_CID !== null && item.EQUIPPED_TO_SLOT_CID > -1
    );

    // CRITICAL: Filter out broken items (0 durability)
    // API rejects dungeon start/actions with broken items ("Error handling action")
    const functionalItems = equippedItems.filter(item => {
      const durability = item.DURABILITY_CID;
      const slot = item.EQUIPPED_TO_SLOT_CID;

      // Determine item type based on slot number
      // Slot 6 = Charms, Slots 0-5 = Gear
      const itemType = slot === 6 ? 'charm' : 'gear';

      // Skip items with 0 durability (broken)
      if (durability === 0) {
        console.log(`⚠️  Skipping broken ${itemType}: Slot ${slot} has 0 durability`);
        return false;
      }

      return true;
    });

    if (functionalItems.length < equippedItems.length) {
      const brokenCount = equippedItems.length - functionalItems.length;
      console.log(`⚠️  ${brokenCount} equipped item(s) are broken and will be excluded`);
    }

    // Add functional item IDs
    allFunctionalIds.push(...functionalItems.map(item => item.docId));

    // Return array of functional gear + charm IDs
    return allFunctionalIds;
  } catch (error) {
    console.error('Failed to get equipped gear/charm IDs:', error.message);
    return []; // Return empty array on error
  }
}