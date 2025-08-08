import { getDirectGearInstances } from './direct-api-gear.mjs';
import { config } from './config.mjs';
import axios from 'axios';

// API instance for gear repairs
const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${config.jwtToken}`,
    'Content-Type': 'application/json'
  }
});

export class GearManager {
  constructor() {
    this.lastRepairCheck = 0;
    this.repairInterval = 60000; // Check every minute
  }

  // Check if any gear needs repair
  async checkGearStatus() {
    try {
      const gearResponse = await getDirectGearInstances();
      const gearItems = gearResponse?.entities || [];
      const needsRepair = [];

      for (const item of gearItems) {
        // Use _CID fields based on API response
        const durability = item.DURABILITY_CID;
        const itemId = item.GAME_ITEM_ID_CID;
        
        // Max durability is based on rarity: Common=40, Uncommon=50, Rare=60, Epic=70
        const maxDurability = [40, 50, 60, 70][item.RARITY_CID] || 40;
        
        if (durability !== undefined && durability < maxDurability) {
          const durabilityPercent = (durability / maxDurability) * 100;
          
          // Only repair gear that's completely broken (0% durability)
          if (durability === 0) {
            needsRepair.push({
              ...item,
              gearInstanceId: item.docId,  // Use docId as the gear instance ID for repairs
              itemId: itemId,
              durability: durability,
              maxDurability: maxDurability,
              durabilityPercent,
              name: `Gear #${itemId}`
            });
          }
        }
      }

      return needsRepair;
    } catch (error) {
      console.error('Error checking gear status:', error);
      return [];
    }
  }

  // Get max durability based on item rarity
  getMaxDurability(rarity) {
    // Max durability is based on rarity: Common=40, Uncommon=50, Rare=60, Epic=70
    return [40, 50, 60, 70][rarity] || 40;
  }

  // Repair a specific gear item
  async repairGear(gearInstanceId) {
    try {
      console.log(`Repairing gear: ${gearInstanceId}`);
      
      const response = await api.post('/gear/repair', {
        gearInstanceId: gearInstanceId
      });
      
      if (response.data?.entities?.[0]) {
        const item = response.data.entities[0];
        const maxDurability = this.getMaxDurability(item.RARITY_CID);
        console.log(`✅ Successfully repaired gear! Durability: ${item.DURABILITY_CID}/${maxDurability}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Failed to repair gear: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  // Repair all damaged gear
  async repairAllGear() {
    const needsRepair = await this.checkGearStatus();
    
    if (needsRepair.length === 0) {
      console.log('All gear is in good condition');
      return;
    }

    console.log(`Found ${needsRepair.length} gear items needing repair`);
    
    for (const gear of needsRepair) {
      console.log(`${gear.name}: ${gear.durabilityPercent.toFixed(1)}% durability (completely broken)`);
      const repairSuccess = await this.repairGear(gear.gearInstanceId);
      
      if (repairSuccess) {
        console.log(`🔧 Repaired ${gear.name} successfully!`);
      } else {
        console.log(`❌ Failed to repair ${gear.name}`);
      }
      
      // Small delay between repairs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Main maintenance function
  async performMaintenance() {
    const now = Date.now();
    
    // Check if it's time for maintenance
    if (now - this.lastRepairCheck < this.repairInterval) {
      return;
    }

    this.lastRepairCheck = now;
    
    console.log('\n--- Performing gear maintenance ---');
    
    // Repair gear
    await this.repairAllGear();
    
    console.log('--- Maintenance complete ---\n');
  }
}