import { config } from './src/config.mjs';
import { resetGearConnections } from './src/direct-api-gear.mjs';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Set JWT token and wallet address to Account 5
const account5Token = process.env.JWT_TOKEN_5;
const account5Address = '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81';

process.env.JWT_TOKEN = account5Token;
config.jwtToken = account5Token;
config.walletAddress = account5Address;

resetGearConnections();

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${account5Token}`
  }
});

console.log('Comparing inventory sources for Account 5');
console.log('='.repeat(80));

try {
  // 1. Get gear instances (what we've been using)
  console.log('\n1️⃣  GEAR INSTANCES API (/gear/instances/)');
  console.log('='.repeat(80));
  const gearResponse = await api.get(`/gear/instances/${account5Address}`);
  const gearItems = gearResponse.data?.entities || [];

  console.log(`Total items: ${gearItems.length}`);

  // Count unequipped items
  const unequippedGearItems = gearItems.filter(item =>
    item.EQUIPPED_TO_SLOT_CID === null || item.EQUIPPED_TO_SLOT_CID === -1
  );

  console.log(`Unequipped items: ${unequippedGearItems.length}`);

  // Show first 5 unequipped items
  console.log('\nFirst 5 unequipped items:');
  unequippedGearItems.slice(0, 5).forEach(item => {
    const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
    console.log(`  - Item #${item.GAME_ITEM_ID_CID} (${rarityNames[item.RARITY_CID]}): ${item.DURABILITY_CID} durability, ${item.REPAIR_COUNT_CID || 0} repairs`);
  });

  // 2. Get inventory from indexer (what findReplacementCharm uses)
  console.log('\n\n2️⃣  INVENTORY API (/indexer/player/gameitems/)');
  console.log('='.repeat(80));
  const inventoryResponse = await api.get(`/indexer/player/gameitems/${account5Address}`);
  const inventoryItems = inventoryResponse.data?.entities || [];

  console.log(`Total items: ${inventoryItems.length}`);

  // Count items with durability (potential charms/gear)
  const itemsWithDurability = inventoryItems.filter(item =>
    item.DURABILITY_CID !== undefined
  );

  console.log(`Items with durability: ${itemsWithDurability.length}`);

  // Count unequipped items with durability
  const unequippedInventoryItems = itemsWithDurability.filter(item =>
    item.EQUIPPED_TO_SLOT_CID === null || item.EQUIPPED_TO_SLOT_CID === -1
  );

  console.log(`Unequipped items with durability: ${unequippedInventoryItems.length}`);

  // Show first 5 unequipped items with durability
  console.log('\nFirst 5 unequipped items with durability:');
  unequippedInventoryItems.slice(0, 5).forEach(item => {
    const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
    console.log(`  - Item #${item.GAME_ITEM_ID_CID} (${rarityNames[item.RARITY_CID]}): ${item.DURABILITY_CID} durability, ${item.REPAIR_COUNT_CID || 0} repairs`);
  });

  // 3. Compare the two sources
  console.log('\n\n3️⃣  COMPARISON');
  console.log('='.repeat(80));

  // Check if they have the same items
  const gearItemIds = new Set(gearItems.map(item => item.docId));
  const inventoryItemIds = new Set(inventoryItems.map(item => item.docId));

  console.log(`\nUnique items in GEAR API: ${gearItemIds.size}`);
  console.log(`Unique items in INVENTORY API: ${inventoryItemIds.size}`);

  // Find items that are in one but not the other
  const onlyInGear = gearItems.filter(item => !inventoryItemIds.has(item.docId));
  const onlyInInventory = inventoryItems.filter(item => !gearItemIds.has(item.docId));

  console.log(`\nItems only in GEAR API: ${onlyInGear.length}`);
  console.log(`Items only in INVENTORY API: ${onlyInInventory.length}`);

  if (onlyInInventory.length > 0) {
    console.log('\nSample items only in INVENTORY API:');
    onlyInInventory.slice(0, 5).forEach(item => {
      console.log(`  - Item #${item.GAME_ITEM_ID_CID}: durability=${item.DURABILITY_CID}, equipped=${item.EQUIPPED_TO_SLOT_CID}`);
    });
  }

  // 4. Which should we use for replacement charms?
  console.log('\n\n4️⃣  RECOMMENDATION');
  console.log('='.repeat(80));

  const unequippedWithDurabilityGear = unequippedGearItems.filter(item =>
    item.DURABILITY_CID !== undefined && (item.REPAIR_COUNT_CID || 0) < 2
  );

  const unequippedWithDurabilityInventory = unequippedInventoryItems.filter(item =>
    (item.REPAIR_COUNT_CID || 0) < 2
  );

  console.log(`\nGEAR API: ${unequippedWithDurabilityGear.length} unequipped items with durability and <2 repairs`);
  console.log(`INVENTORY API: ${unequippedWithDurabilityInventory.length} unequipped items with durability and <2 repairs`);

  console.log('\n✅ BEST SOURCE: ' + (unequippedWithDurabilityGear.length > 0 ? 'GEAR INSTANCES API' : 'INVENTORY API'));

} catch (error) {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', JSON.stringify(error.response.data, null, 2));
  }
}
