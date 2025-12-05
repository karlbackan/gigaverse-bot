import { config } from './src/config.mjs';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Set JWT token and wallet address to Account 5
const account5Token = process.env.JWT_TOKEN_5;
const account5Address = '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81';

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${account5Token}`
  }
});

console.log('Searching for REAL charms (max durability = 20) for Account 5');
console.log('='.repeat(80));

try {
  // Get all gear instances
  const gearResponse = await api.get(`/gear/instances/${account5Address}`);
  const allItems = gearResponse.data?.entities || [];

  console.log(`\nTotal items from /gear/instances: ${allItems.length}`);

  // Look for items with 20 durability (charms)
  const charmsBy20Durability = allItems.filter(item =>
    item.DURABILITY_CID === 20 || item.DURABILITY_CID <= 20
  );

  console.log(`\nItems with durability <= 20: ${charmsBy20Durability.length}`);

  if (charmsBy20Durability.length > 0) {
    console.log('\nItems with durability <= 20:');
    charmsBy20Durability.forEach(item => {
      const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
      console.log(`  - Item #${item.GAME_ITEM_ID_CID} (${rarityNames[item.RARITY_CID]}): ${item.DURABILITY_CID}/? durability, slot ${item.EQUIPPED_TO_SLOT_CID}, repairs: ${item.REPAIR_COUNT_CID || 0}`);
    });
  }

  // Try the inventory API
  console.log('\n' + '='.repeat(80));
  console.log('Checking /indexer/player/gameitems API:');
  console.log('='.repeat(80));

  const inventoryResponse = await api.get(`/indexer/player/gameitems/${account5Address}`);
  const inventoryItems = inventoryResponse.data?.entities || [];

  console.log(`\nTotal items from /indexer/player/gameitems: ${inventoryItems.length}`);

  if (inventoryItems.length > 0) {
    console.log('\nFirst 10 items:');
    inventoryItems.slice(0, 10).forEach(item => {
      console.log(`  - Item #${item.GAME_ITEM_ID_CID}: durability=${item.DURABILITY_CID}, slot=${item.EQUIPPED_TO_SLOT_CID}, type=${item.type}`);
      console.log(`    Keys: ${Object.keys(item).slice(0, 10).join(', ')}`);
    });
  }

  // Check for items in slot 6 specifically
  console.log('\n' + '='.repeat(80));
  console.log('Items in Slot 6 (what I thought were charms):');
  console.log('='.repeat(80));

  const slot6Items = allItems.filter(item => item.EQUIPPED_TO_SLOT_CID === 6);
  console.log(`\nTotal items in slot 6: ${slot6Items.length}`);

  slot6Items.forEach(item => {
    const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
    const maxDurability = [40, 50, 60, 70][item.RARITY_CID] || 40;
    console.log(`  - Item #${item.GAME_ITEM_ID_CID} (${rarityNames[item.RARITY_CID]}): ${item.DURABILITY_CID}/${maxDurability} durability, repairs: ${item.REPAIR_COUNT_CID || 0}`);
  });

} catch (error) {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
  }
}
