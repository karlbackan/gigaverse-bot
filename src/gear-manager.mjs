import { getDirectGearInstances } from './direct-api-gear.mjs';
import { config } from './config.mjs';
import axios from 'axios';

// API instance for gear repairs
const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// CRITICAL: Add request interceptor to use CURRENT JWT token
// Without this, the token is captured at module load time (Account 1's token)
// and never updates when switching accounts
api.interceptors.request.use((requestConfig) => {
  // Use current token from environment or fallback to config
  const currentToken = process.env.JWT_TOKEN || config.jwtToken;
  requestConfig.headers.Authorization = `Bearer ${currentToken}`;

  return requestConfig;
}, (error) => {
  return Promise.reject(error);
});

export class GearManager {
  constructor() {
    this.lastRepairCheck = 0;
    this.repairInterval = 60000; // Check every minute
    this.knownCharmIds = new Set([227, 228]); // Start with known charm IDs
    this.knownGearIds = new Set();
    this.initialized = false;
  }

  // Initialize charm/gear classification by analyzing fresh items
  async initializeItemClassification() {
    if (this.initialized) return;

    try {
      const gearResponse = await getDirectGearInstances();
      const allItems = gearResponse?.entities || [];

      // Find fresh items (never repaired) to classify
      const freshItems = allItems.filter(item => !item.REPAIR_COUNT_CID || item.REPAIR_COUNT_CID === 0);

      freshItems.forEach(item => {
        const itemId = item.GAME_ITEM_ID_CID;
        const durability = item.DURABILITY_CID;

        // Charms have max durability < 30, gear has >= 40
        if (durability < 30) {
          this.knownCharmIds.add(itemId);
        } else if (durability >= 40) {
          this.knownGearIds.add(itemId);
        }
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize item classification:', error.message);
    }
  }

  // Check if any gear or charms need repair
  async checkGearStatus() {
    // Initialize item classification on first run
    await this.initializeItemClassification();

    try {
      const needsRepair = [];

      // Get all gear instances from API
      const gearResponse = await getDirectGearInstances();
      const allItems = gearResponse?.entities || [];

      for (const item of allItems) {
        // Use _CID fields based on API response
        const durability = item.DURABILITY_CID;
        const itemId = item.GAME_ITEM_ID_CID;
        const repairCount = item.REPAIR_COUNT_CID || 0;
        const slot = item.EQUIPPED_TO_SLOT_CID;

        // Only consider equipped items (EQUIPPED_TO_SLOT_CID > -1)
        const isEquipped = slot !== null && slot > -1;

        if (!isEquipped) {
          continue; // Skip unequipped items
        }

        // Determine item type - charms are items #227 and #228
        const itemIsCharm = this.isCharm(item);
        const itemType = itemIsCharm ? 'charm' : 'gear';
        const maxRepairs = itemIsCharm ? 2 : 5;

        // Get correct max durability for item type
        const maxDurability = this.getMaxDurability(item.RARITY_CID, itemIsCharm);

        // Check if item is damaged
        if (durability !== undefined && durability < maxDurability) {
          const durabilityPercent = (durability / maxDurability) * 100;

          // Only process items that are completely broken (0% durability)
          if (durability === 0) {
            // Check if item needs special handling (restore for gear, salvage for charms)
            const atRepairLimit = repairCount >= maxRepairs;
            const shouldRestore = itemType === 'gear' && atRepairLimit;
            const shouldSalvage = itemType === 'charm' && atRepairLimit;

            needsRepair.push({
              ...item,
              gearInstanceId: item.docId,  // Use docId as the instance ID
              itemId: itemId,
              durability: durability,
              maxDurability: maxDurability,
              durabilityPercent,
              repairCount: repairCount,
              shouldRestore: shouldRestore,
              shouldSalvage: shouldSalvage,
              slot: slot,
              name: `${itemType === 'charm' ? 'Charm' : 'Gear'} #${itemId} (Slot ${slot}, ${repairCount}/${maxRepairs} repairs)`,
              type: itemType
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

  // Get max durability based on item rarity and type
  getMaxDurability(rarity, isCharm = false) {
    if (isCharm) {
      // Charms have lower durability, varies by type but always < 30
      // Typical: Common=20, Uncommon=22, Rare=24, Epic=26
      // Use rarity-based estimate
      return 20 + (rarity * 2);
    }
    // Regular gear: Common=40, Uncommon=50, Rare=60, Epic=70
    return [40, 50, 60, 70][rarity] || 40;
  }

  // Check if an item is a charm based on GAME_ITEM_ID
  // Charms have max durability < 30, gear has max durability >= 40
  isCharm(item) {
    const itemId = item.GAME_ITEM_ID_CID;

    // Check against known charm IDs (dynamically discovered)
    if (this.knownCharmIds.has(itemId)) {
      return true;
    }

    // If it's known gear, return false
    if (this.knownGearIds.has(itemId)) {
      return false;
    }

    // For unknown items, use durability heuristic
    // Charms have max durability < 30, gear has >= 40
    const rarity = item.RARITY_CID;
    const charmMaxDur = 20 + (rarity * 2); // 20, 22, 24, 26 for rarities 0-3

    // If current durability is significantly higher than charm max, it's gear
    if (item.DURABILITY_CID > 30) {
      this.knownGearIds.add(itemId);
      return false;
    }

    // If current durability matches charm pattern, likely a charm
    if (item.DURABILITY_CID <= charmMaxDur) {
      this.knownCharmIds.add(itemId);
      return true;
    }

    // Default to false (treat as gear)
    return false;
  }

  // Unequip a gear or charm item
  async unequipItem(gearInstanceId, itemType = 'item') {
    try {
      console.log(`Unequipping ${itemType}: ${gearInstanceId}`);

      const response = await api.post('/gear/set', {
        gearInstanceId: gearInstanceId,
        slotType: -1,
        slotIndex: -1
      });

      console.log(`✅ Successfully unequipped ${itemType}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to unequip ${itemType}: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  // Salvage a gear or charm item
  async salvageItem(gearInstanceId, itemType = 'item') {
    try {
      console.log(`Salvaging ${itemType}: ${gearInstanceId}`);

      const response = await api.post('/gear/salvage', {
        gearInstanceId: gearInstanceId
      });

      console.log(`✅ Successfully salvaged ${itemType}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to salvage ${itemType}: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  // Equip a charm to slot 6
  async equipCharm(gearInstanceId, slotIndex = 1) {
    try {
      console.log(`Equipping charm: ${gearInstanceId} to slot 6, index ${slotIndex}`);

      const response = await api.post('/gear/set', {
        gearInstanceId: gearInstanceId,
        slotType: 6,
        slotIndex: slotIndex
      });

      console.log(`✅ Successfully equipped charm to slot 6, index ${slotIndex}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to equip charm: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  // Find an unequipped replacement charm from gear instances
  async findReplacementCharm() {
    // Initialize item classification on first run
    await this.initializeItemClassification();

    try {
      // Get all gear instances (includes potential replacement charms)
      const gearResponse = await getDirectGearInstances();
      const items = gearResponse?.entities || [];

      // Find unequipped charms (items #227 or #228) that can be equipped
      const unequippedCharms = items.filter(item => {
        // Must be a charm (item #227 or #228)
        const isCharmItem = this.isCharm(item);
        const hasDurability = item.DURABILITY_CID !== undefined;
        const isUnequipped = item.EQUIPPED_TO_SLOT_CID === null || item.EQUIPPED_TO_SLOT_CID === -1;
        const repairCount = item.REPAIR_COUNT_CID || 0;
        const notAtRepairLimit = repairCount < 2;

        // Must be a charm, have durability, be unequipped, and not at repair limit
        return isCharmItem && hasDurability && isUnequipped && notAtRepairLimit;
      });

      if (unequippedCharms.length === 0) {
        console.log('⚠️ No replacement charms available in inventory');
        return null;
      }

      // Prefer charms with 0 repairs, then sort by rarity (higher is better)
      unequippedCharms.sort((a, b) => {
        const aRepairs = a.REPAIR_COUNT_CID || 0;
        const bRepairs = b.REPAIR_COUNT_CID || 0;

        // First sort by repair count (fewer repairs is better)
        if (aRepairs !== bRepairs) {
          return aRepairs - bRepairs;
        }

        // Then sort by rarity (higher is better)
        return (b.RARITY_CID || 0) - (a.RARITY_CID || 0);
      });

      const bestCharm = unequippedCharms[0];
      const repairCount = bestCharm.REPAIR_COUNT_CID || 0;
      const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
      const rarityName = rarityNames[bestCharm.RARITY_CID] || 'Unknown';

      console.log(`Found replacement charm: #${bestCharm.GAME_ITEM_ID_CID} (${rarityName}, ${repairCount}/2 repairs)`);
      return bestCharm;
    } catch (error) {
      console.error('Error finding replacement charm:', error);
      return null;
    }
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
        const isCharmItem = this.isCharm(item);
        const maxDurability = this.getMaxDurability(item.RARITY_CID, isCharmItem);
        console.log(`✅ Successfully repaired ${itemType}! Durability: ${item.DURABILITY_CID}/${maxDurability}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Failed to repair ${itemType}: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  // Restore a gear item (when repair count reaches 5/5)
  async restoreGear(gearInstanceId) {
    try {
      console.log(`Restoring gear: ${gearInstanceId}`);

      const response = await api.post('/gear/restore', {
        gearInstanceId: gearInstanceId
      });

      if (response.data?.entities?.[0]) {
        const item = response.data.entities[0];
        const isCharmItem = this.isCharm(item);
        const maxDurability = this.getMaxDurability(item.RARITY_CID, isCharmItem);
        const repairCount = item.REPAIR_COUNT_CID || 0;
        console.log(`✅ Successfully restored gear! Durability: ${item.DURABILITY_CID}/${maxDurability}, Repairs: ${repairCount}/5`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Failed to restore gear: ${error.response?.data?.message || error.message}`);
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

    console.log(`Found ${needsRepair.length} items needing attention`);

    for (const item of needsRepair) {
      console.log(`\n${item.name}: ${item.durabilityPercent.toFixed(1)}% durability (completely broken)`);

      // Check if this is GEAR that needs restore (5/5 repairs)
      if (item.type === 'gear' && item.shouldRestore) {
        console.log(`⚠️ Gear has reached repair limit (5/5). Restoring gear...`);

        const restoreSuccess = await this.restoreGear(item.gearInstanceId);

        if (restoreSuccess) {
          console.log(`🔄 Restored ${item.name} successfully!`);
        } else {
          console.log(`❌ Failed to restore ${item.name}`);
        }
      }
      // Check if this charm should be salvaged instead of repaired
      else if (item.type === 'charm' && item.shouldSalvage) {
        console.log(`⚠️ Charm has reached repair limit (2/2). Starting salvage workflow...`);

        // CRITICAL: Save the original slot index BEFORE unequipping
        const originalSlotIndex = item.EQUIPPED_TO_INDEX_CID;
        console.log(`📍 Original slot: ${item.slot}, index: ${originalSlotIndex}`);

        // Step 1: Unequip the charm
        const unequipSuccess = await this.unequipItem(item.gearInstanceId, 'charm');
        if (!unequipSuccess) {
          console.log(`❌ Failed to unequip charm, skipping salvage`);
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Salvage the charm
        const salvageSuccess = await this.salvageItem(item.gearInstanceId, 'charm');
        if (!salvageSuccess) {
          console.log(`❌ Failed to salvage charm`);
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 3: Find a replacement charm
        const replacement = await this.findReplacementCharm();
        if (!replacement) {
          console.log(`⚠️ No replacement charm available. Charm slot will remain empty.`);
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 4: Equip the replacement charm to the ORIGINAL slot index
        const slotIndex = originalSlotIndex ?? 1;
        console.log(`📍 Equipping replacement to slot 6, index: ${slotIndex}`);
        const equipSuccess = await this.equipCharm(replacement.docId, slotIndex);
        if (equipSuccess) {
          console.log(`✅ Successfully replaced charm with #${replacement.GAME_ITEM_ID_CID}`);
        } else {
          console.log(`❌ Failed to equip replacement charm`);
        }

      } else {
        // Normal repair for gear or charms under repair limit
        const repairSuccess = await this.repairGear(item.gearInstanceId, item.type);

        if (repairSuccess) {
          console.log(`🔧 Repaired ${item.name} successfully!`);
        } else {
          console.log(`❌ Failed to repair ${item.name}`);
        }
      }

      // Small delay between operations
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