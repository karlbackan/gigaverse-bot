import { getDirectGearInstances } from './direct-api-gear.mjs';
import { getDirectInventory } from './direct-api.mjs';
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

  // Check if any gear or charms need repair
  async checkGearStatus() {
    try {
      const needsRepair = [];

      // Check gear items
      const gearResponse = await getDirectGearInstances();
      const gearItems = gearResponse?.entities || [];

      for (const item of gearItems) {
        // Use _CID fields based on API response
        const durability = item.DURABILITY_CID;
        const itemId = item.GAME_ITEM_ID_CID;
        
        // Only consider equipped gear (EQUIPPED_TO_SLOT_CID > -1) 
        const isEquipped = item.EQUIPPED_TO_SLOT_CID !== null && item.EQUIPPED_TO_SLOT_CID > -1;
        
        if (!isEquipped) {
          continue; // Skip unequipped items
        }
        
        // Max durability is based on rarity: Common=40, Uncommon=50, Rare=60, Epic=70
        const maxDurability = [40, 50, 60, 70][item.RARITY_CID] || 40;
        
        // Only consider equipped gear (EQUIPPED_TO_SLOT_CID > -1) 
        const isEquipped = item.EQUIPPED_TO_SLOT_CID !== null && item.EQUIPPED_TO_SLOT_CID > -1;
        
        if (isEquipped && durability !== undefined && durability < maxDurability) {
          const durabilityPercent = (durability / maxDurability) * 100;
          
          // Only repair gear that's completely broken (0% durability) and equipped
          if (durability === 0) {
            needsRepair.push({
              ...item,
              gearInstanceId: item.docId,  // Use docId as the gear instance ID for repairs
              itemId: itemId,
              durability: durability,
              maxDurability: maxDurability,
              durabilityPercent,
              slot: item.EQUIPPED_TO_SLOT_CID,
              name: `Gear #${itemId} (Slot ${item.EQUIPPED_TO_SLOT_CID})`,
              type: 'gear'
            });
          }
        }
      }

      // Check charm items
      const inventoryResponse = await getDirectInventory();
      const charmItems = inventoryResponse?.entities || [];

      for (const item of charmItems) {
        // Check if this item has durability (charms should have DURABILITY_CID)
        const durability = item.DURABILITY_CID;
        const itemId = item.GAME_ITEM_ID_CID;
        
        if (durability === undefined) {
          continue; // Skip items without durability
        }
        
        // Only consider equipped charms (EQUIPPED_TO_SLOT_CID > -1) 
        const isEquipped = item.EQUIPPED_TO_SLOT_CID !== null && item.EQUIPPED_TO_SLOT_CID > -1;
        
        if (!isEquipped) {
          continue; // Skip unequipped items
        }
        
        // Max durability is based on rarity: Common=40, Uncommon=50, Rare=60, Epic=70
        const maxDurability = [40, 50, 60, 70][item.RARITY_CID] || 40;
        
        if (durability < maxDurability) {
          const durabilityPercent = (durability / maxDurability) * 100;
          
          // Only repair charms that's completely broken (0% durability)
          if (durability === 0) {
            needsRepair.push({
              ...item,
              gearInstanceId: item.docId,  // Use docId as the item instance ID for repairs
              itemId: itemId,
              durability: durability,
              maxDurability: maxDurability,
              durabilityPercent,
              name: `Charm #${itemId}`,
              type: 'charm'
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

  // Repair a specific gear or charm item
  async repairGear(gearInstanceId, itemType = 'gear') {
    try {
      console.log(`Repairing ${itemType}: ${gearInstanceId}`);
      
      const response = await api.post('/gear/repair', {
        gearInstanceId: gearInstanceId
      });
      
      if (response.data?.entities?.[0]) {
        const item = response.data.entities[0];
        const maxDurability = this.getMaxDurability(item.RARITY_CID);
        console.log(`✅ Successfully repaired ${itemType}! Durability: ${item.DURABILITY_CID}/${maxDurability}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Failed to repair ${itemType}: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  // Repair all damaged gear and charms
  async repairAllGear() {
    const needsRepair = await this.checkGearStatus();
    
    if (needsRepair.length === 0) {
      console.log('All gear and charms are in good condition');
      return;
    }

    console.log(`Found ${needsRepair.length} items needing repair`);
    
    for (const item of needsRepair) {
      console.log(`${item.name}: ${item.durabilityPercent.toFixed(1)}% durability (completely broken)`);
      const repairSuccess = await this.repairGear(item.gearInstanceId, item.type);
      
      if (repairSuccess) {
        console.log(`🔧 Repaired ${item.name} successfully!`);
      } else {
        console.log(`❌ Failed to repair ${item.name}`);
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
    
    console.log('\n--- Performing gear and charm maintenance ---');
    
    // Repair gear and charms
    await this.repairAllGear();
    
    console.log('--- Maintenance complete ---\n');
  }
}