import { config } from './config.mjs';
import { 
  getDirectAccount, 
  getDirectEnergy, 
  getDirectInventory,
  getDirectAvailableDungeons
} from './direct-api.mjs';

// FireballApi requires JWT during construction - initialize it lazily
export let fireballApi = null;

export function initializeFireballApi() {
  // FireballApi requires a Hasura JWT, not the regular Gigaverse JWT
  // Disable for now since we don't have the Hasura JWT
  return null;
  
  /* To enable statistics, you need to get the Hasura JWT from:
     1. Open browser developer tools
     2. Go to Fireball.gg website
     3. Check Network tab for GraphQL requests
     4. Look for Authorization header with Hasura JWT
  if (!fireballApi && config.hasuraJwt) {
    try {
      fireballApi = new FireballApi(config.hasuraJwt);
    } catch (error) {
      console.error('Failed to initialize FireballApi:', error.message);
    }
  }
  return fireballApi;
  */
}

// Test API connection
export async function testConnection() {
  try {
    const account = await getDirectAccount();
    const energyData = await getDirectEnergy();
    
    const username = account.accountEntity?.usernames?.[0]?.NAME_CID || 
                    account.usernames?.[0]?.NAME_CID || 
                    config.walletAddress;
    const energy = energyData?.entities?.[0]?.parsedData?.energyValue || 0;
    const faction = account.accountEntity?.FACTION_CID || 'Unknown';
    
    console.log(`Connected as: ${username}`);
    console.log(`Energy: ${energy}`);
    console.log(`Faction: ${faction}`);
    return true;
  } catch (error) {
    console.error('Failed to connect to API:', error.message);
    return false;
  }
}

// Get current player state
export async function getPlayerState() {
  try {
    const [account, inventory, energyData, dungeonData] = await Promise.all([
      getDirectAccount(),
      getDirectInventory(),
      getDirectEnergy(),
      getDirectAvailableDungeons()
    ]);
    
    // Extract energy value
    const energy = energyData?.entities?.[0]?.parsedData?.energyValue || 0;
    
    // Add energy to account object for compatibility
    return {
      account: {
        ...account,
        energy: energy,
        parsedEnergy: energyData?.entities?.[0]?.parsedData
      },
      noobData: {}, // Not needed for basic functionality
      inventory: inventory || { entities: [] },
      gear: [], // Gear API is broken, return empty array
      dungeonData: dungeonData
    };
  } catch (error) {
    console.error('Failed to get player state:', error.message);
    throw error;
  }
}

// Get dungeon statistics from Fireball API
export async function getDungeonStats() {
  try {
    const api = initializeFireballApi();
    if (!api) {
      return null;
    }
    const stats = await api.getStats();
    return stats;
  } catch (error) {
    console.error('Failed to get dungeon stats:', error.message);
    return null;
  }
}

// Get enemy encounter statistics
export async function getEnemyStats(enemyId) {
  try {
    const api = initializeFireballApi();
    if (!api) {
      return null;
    }
    const encounters = await api.getEncountersLoot({
      filter: { enemyId },
      limit: 100
    });
    
    // Analyze enemy patterns
    const patterns = {
      rock: 0,
      paper: 0,
      scissor: 0
    };
    
    encounters.forEach(encounter => {
      if (encounter.enemyAction) {
        patterns[encounter.enemyAction]++;
      }
    });
    
    return patterns;
  } catch (error) {
    console.error(`Failed to get enemy stats for ${enemyId}:`, error.message);
    return null;
  }
}

// Export gigaApi for backwards compatibility (will remove gradually)
export const gigaApi = {
  getAccount: getDirectAccount,
  getNoobEnergy: getDirectEnergy,
  getNoobInventory: getDirectInventory,
  getAvailableDungeons: getDirectAvailableDungeons,
  // Add more as needed
};