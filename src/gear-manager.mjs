import { gigaApi } from './api.mjs';
import { config } from './config.mjs';

export class GearManager {
  constructor() {
    this.lastRepairCheck = 0;
    this.repairInterval = 60000; // Check every minute
  }

  // Check if any gear needs repair
  async checkGearStatus() {
    try {
      const gearResponse = await gigaApi.getNoobGear();
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
          
          if (durabilityPercent < config.repairThreshold) {
            needsRepair.push({
              ...item,
              id: item._id,
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

  // Repair a specific gear item
  async repairGear(gearId) {
    try {
      console.log(`Repairing gear ID: ${gearId}`);
      
      // TODO: Fix gear repair API call
      console.log('(Gear repair temporarily disabled - needs API fix)');
      return false;
      
      // The repairGear method expects just the gear instance ID, not a payload object
      const response = await gigaApi.repairGear(gearId);
      
      if (response && response.success) {
        console.log(`Successfully repaired gear ID: ${gearId}`);
        return true;
      } else {
        console.error(`Failed to repair gear ID: ${gearId}`, response);
        return false;
      }
    } catch (error) {
      console.error(`Error repairing gear ID ${gearId}:`, error);
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
      console.log(`${gear.name}: ${gear.durabilityPercent.toFixed(1)}% durability`);
      await this.repairGear(gear.id);
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