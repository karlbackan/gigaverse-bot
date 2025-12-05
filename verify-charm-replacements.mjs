import dotenv from 'dotenv';
dotenv.config();

import { getDirectGearInstances } from './src/direct-api-gear.mjs';
import { GearManager } from './src/gear-manager.mjs';

const accounts = [
  { name: 'Account 2', address: '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816' },
  { name: 'Account 4', address: '0x2153433D4c13f72b5b10af5dF5fC93866Eea046b' }
];

console.log('=== VERIFYING CHARM REPLACEMENTS ===\n');

for (const account of accounts) {
  console.log(`\n📦 ${account.name} (${account.address})`);
  console.log('─'.repeat(70));
  
  try {
    const gearResponse = await getDirectGearInstances(account.address);
    const allItems = gearResponse?.entities || [];
    
    // Filter for equipped charms (slot 6)
    const equippedCharms = allItems.filter(item => {
      const slot = item.EQUIPPED_TO_SLOT_CID;
      return slot === 6;
    });
    
    if (equippedCharms.length === 0) {
      console.log('  ⚠️  No charms equipped!');
      continue;
    }
    
    const gearManager = new GearManager(account.address);
    await gearManager.initializeItemClassification();
    
    console.log(`  Found ${equippedCharms.length} equipped charm(s):\n`);
    
    equippedCharms.forEach(item => {
      const itemId = item.GAME_ITEM_ID_CID;
      const slotIndex = item.EQUIPPED_TO_INDEX_CID;
      const rarity = item.RARITY_CID || 0;
      const durability = item.DURABILITY_CID || 0;
      const repairCount = item.REPAIR_COUNT_CID || 0;
      const maxDurability = gearManager.getMaxDurability(rarity, true);
      
      const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
      const rarityName = rarityNames[rarity] || 'Unknown';
      
      const status = durability === 0 ? '⚠️  BROKEN' : 
                     repairCount === 0 ? '✨ FRESH' : 
                     repairCount < 2 ? '✅ GOOD' : '⚠️  MAX REPAIRS';
      
      console.log(`  💎 Charm #${itemId} (${rarityName}) - Slot 6 [Index ${slotIndex}]`);
      console.log(`     Durability: ${durability}/${maxDurability}`);
      console.log(`     Repairs: ${repairCount}/2`);
      console.log(`     Status: ${status}`);
      console.log('');
    });
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

console.log('✅ Verification complete!\n');
