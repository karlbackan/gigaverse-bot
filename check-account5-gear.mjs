import { GearManager } from './src/gear-manager.mjs';
import { config } from './src/config.mjs';
import { resetGearConnections } from './src/direct-api-gear.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Set JWT token and wallet address to Account 5
const account5Token = process.env.JWT_TOKEN_5;
const account5Address = '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81';

process.env.JWT_TOKEN = account5Token;
config.jwtToken = account5Token;
config.walletAddress = account5Address;

// Reset gear API connections to ensure fresh token
resetGearConnections();

console.log('Checking gear for Account 5 (0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81)');
console.log('='.repeat(80));

const gearManager = new GearManager();

try {
  const items = await gearManager.checkGearStatus();

  if (items.length === 0) {
    console.log('\n✅ All gear and charms are in good condition (no items need repair)');
  } else {
    console.log(`\nFound ${items.length} item(s) needing attention:\n`);

    for (const item of items) {
      console.log(`${item.type === 'gear' ? '⚙️' : '💎'} ${item.name}`);
      console.log(`   Durability: ${item.durability}/${item.maxDurability} (${item.durabilityPercent.toFixed(1)}%)`);
      console.log(`   Repair Count: ${item.repairCount}/${item.type === 'gear' ? '5' : '2'}`);

      if (item.shouldRestore) {
        console.log(`   ⚠️ Status: Needs RESTORE (gear at max repairs)`);
      } else if (item.shouldSalvage) {
        console.log(`   ⚠️ Status: Needs SALVAGE (charm at max repairs)`);
      } else {
        console.log(`   ✅ Status: Can be repaired`);
      }

      console.log('');
    }
  }

  // Now get all gear items to show repair counts even for items not needing repair
  console.log('\n' + '='.repeat(80));
  console.log('ALL EQUIPPED ITEMS (including healthy items):');
  console.log('='.repeat(80) + '\n');

  const { getDirectGearInstances } = await import('./src/direct-api-gear.mjs');

  // Explicitly pass Account 5 address
  const account5Address = '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81';
  const gearResponse = await getDirectGearInstances(account5Address);
  const allItems = gearResponse?.entities || [];

  const equippedItems = allItems.filter(item =>
    item.EQUIPPED_TO_SLOT_CID !== null && item.EQUIPPED_TO_SLOT_CID > -1
  );

  // Separate gear (slots 0-5) and charms (slot 6)
  const equippedGear = equippedItems.filter(item => item.EQUIPPED_TO_SLOT_CID !== 6);
  const equippedCharms = equippedItems.filter(item => item.EQUIPPED_TO_SLOT_CID === 6);

  if (equippedGear.length > 0) {
    console.log('GEAR (Slots 0-5):');
    for (const item of equippedGear) {
      const maxDurability = [40, 50, 60, 70][item.RARITY_CID] || 40;
      const repairCount = item.REPAIR_COUNT_CID || 0;
      const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
      const rarityName = rarityNames[item.RARITY_CID] || 'Unknown';

      console.log(`   ⚙️ Gear #${item.GAME_ITEM_ID_CID} (Slot ${item.EQUIPPED_TO_SLOT_CID})`);
      console.log(`      Rarity: ${rarityName}`);
      console.log(`      Durability: ${item.DURABILITY_CID}/${maxDurability}`);
      console.log(`      Repair Count: ${repairCount}/5`);
      console.log('');
    }
  }

  if (equippedCharms.length > 0) {
    console.log('CHARMS (Slot 6):');
    for (const item of equippedCharms) {
      // Charms have different max durability: 20/22/24/26
      const maxDurability = [20, 22, 24, 26][item.RARITY_CID] || 20;
      const repairCount = item.REPAIR_COUNT_CID || 0;
      const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
      const rarityName = rarityNames[item.RARITY_CID] || 'Unknown';

      console.log(`   💎 Charm #${item.GAME_ITEM_ID_CID} (Index ${item.EQUIPPED_TO_INDEX_CID})`);
      console.log(`      Rarity: ${rarityName}`);
      console.log(`      Durability: ${item.DURABILITY_CID}/${maxDurability}`);
      console.log(`      Repair Count: ${repairCount}/2`);
      console.log('');
    }
  }

} catch (error) {
  console.error('Error checking gear:', error);
  process.exit(1);
}
