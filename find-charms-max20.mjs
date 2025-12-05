import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const account5Token = process.env.JWT_TOKEN_5;
const account5Address = '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81';

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${account5Token}`
  }
});

console.log('Looking for items with MAX durability = 20 (charms)');
console.log('='.repeat(80));

try {
  const gearResponse = await api.get(`/gear/instances/${account5Address}`);
  const allItems = gearResponse.data?.entities || [];

  console.log(`\nTotal items: ${allItems.length}\n`);

  // Group items by GAME_ITEM_ID to analyze their durability patterns
  const itemGroups = {};

  allItems.forEach(item => {
    const id = item.GAME_ITEM_ID_CID;
    if (!itemGroups[id]) {
      itemGroups[id] = [];
    }
    itemGroups[id].push(item);
  });

  // Analyze each item ID
  console.log('Analyzing durability patterns by GAME_ITEM_ID:');
  console.log('='.repeat(80));

  const potentialCharms = [];

  Object.keys(itemGroups).sort((a, b) => Number(a) - Number(b)).forEach(id => {
    const items = itemGroups[id];

    // Get max durability seen for this item ID
    const maxDurabilitySeen = Math.max(...items.map(i => i.DURABILITY_CID));

    // Get all rarities for this item ID
    const rarities = [...new Set(items.map(i => i.RARITY_CID))];

    // Calculate expected max durability based on rarity
    const expectedMaxDurs = rarities.map(r => [40, 50, 60, 70][r] || 40);
    const minExpectedMax = Math.min(...expectedMaxDurs);

    // If max durability seen is 20 or less, this might be a charm
    if (maxDurabilitySeen <= 20) {
      potentialCharms.push({ id, items, maxDurabilitySeen });
      console.log(`✅ Item #${id}: Max durability seen = ${maxDurabilitySeen} (${items.length} instances) ⭐ POTENTIAL CHARM`);
    } else {
      console.log(`   Item #${id}: Max durability seen = ${maxDurabilitySeen} (${items.length} instances)`);
    }
  });

  // Show detailed info for potential charms
  if (potentialCharms.length > 0) {
    console.log('\n\n' + '='.repeat(80));
    console.log('POTENTIAL CHARMS (max durability <= 20):');
    console.log('='.repeat(80));

    potentialCharms.forEach(({ id, items, maxDurabilitySeen }) => {
      console.log(`\n📦 GAME_ITEM_ID #${id} (${items.length} instances, max dur seen: ${maxDurabilitySeen})`);

      const equipped = items.filter(i => i.EQUIPPED_TO_SLOT_CID > -1);
      const unequipped = items.filter(i => i.EQUIPPED_TO_SLOT_CID === -1);

      console.log(`   Equipped: ${equipped.length}`);
      equipped.forEach(item => {
        console.log(`     - Slot ${item.EQUIPPED_TO_SLOT_CID}: ${item.DURABILITY_CID} dur, ${item.REPAIR_COUNT_CID || 0} repairs`);
      });

      console.log(`   Unequipped: ${unequipped.length}`);
      unequipped.slice(0, 3).forEach(item => {
        console.log(`     - ${item.DURABILITY_CID} dur, ${item.REPAIR_COUNT_CID || 0} repairs`);
      });
      if (unequipped.length > 3) {
        console.log(`     - ... and ${unequipped.length - 3} more`);
      }
    });
  } else {
    console.log('\n❌ No items found with max durability <= 20');
  }

} catch (error) {
  console.error('Error:', error.message);
}
