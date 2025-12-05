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

console.log('Finding ALL charms (items with max durability < 30)');
console.log('='.repeat(80));

try {
  const gearResponse = await api.get(`/gear/instances/${account5Address}`);
  const allItems = gearResponse.data?.entities || [];

  // Find fresh items (0 repairs) to determine max durability
  const freshItems = allItems.filter(item => !item.REPAIR_COUNT_CID || item.REPAIR_COUNT_CID === 0);

  // Group by GAME_ITEM_ID
  const itemGroups = {};
  freshItems.forEach(item => {
    const id = item.GAME_ITEM_ID_CID;
    if (!itemGroups[id]) {
      itemGroups[id] = [];
    }
    itemGroups[id].push(item);
  });

  const charmIds = [];
  const gearIds = [];

  console.log('\nAnalyzing all items by max durability:');
  console.log('='.repeat(80));

  Object.keys(itemGroups).sort((a, b) => Number(a) - Number(b)).forEach(id => {
    const items = itemGroups[id];
    const maxDur = Math.max(...items.map(i => i.DURABILITY_CID));

    const isCharm = maxDur < 30;

    if (isCharm) {
      charmIds.push(Number(id));
      console.log(`⭐ Item #${id}: Max durability = ${maxDur} ⭐ CHARM`);
    } else {
      gearIds.push(Number(id));
      console.log(`   Item #${id}: Max durability = ${maxDur} (gear)`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log('='.repeat(80));
  console.log(`\n📦 CHARM IDs (max dur < 30): ${charmIds.join(', ')}`);
  console.log(`⚙️  GEAR IDs (max dur >= 30): ${gearIds.join(', ')}`);

  // Count total charms in inventory
  const allCharms = allItems.filter(item => charmIds.includes(item.GAME_ITEM_ID_CID));
  const equippedCharms = allCharms.filter(item => item.EQUIPPED_TO_SLOT_CID > -1);
  const unequippedCharms = allCharms.filter(item => item.EQUIPPED_TO_SLOT_CID === -1);

  console.log(`\n📊 CHARM INVENTORY:`);
  console.log(`   Total charms: ${allCharms.length}`);
  console.log(`   Equipped: ${equippedCharms.length}`);
  console.log(`   Unequipped: ${unequippedCharms.length}`);

  // Show breakdown by ID
  console.log(`\n📋 BREAKDOWN BY CHARM ID:`);
  charmIds.forEach(id => {
    const items = allItems.filter(i => i.GAME_ITEM_ID_CID === id);
    const equipped = items.filter(i => i.EQUIPPED_TO_SLOT_CID > -1);
    console.log(`   Charm #${id}: ${items.length} total (${equipped.length} equipped, ${items.length - equipped.length} unequipped)`);
  });

} catch (error) {
  console.error('Error:', error.message);
}
