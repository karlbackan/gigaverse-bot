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

console.log('Looking for FRESH items (never repaired) to determine max durability');
console.log('='.repeat(80));

try {
  const gearResponse = await api.get(`/gear/instances/${account5Address}`);
  const allItems = gearResponse.data?.entities || [];

  // Find items that have never been repaired
  const freshItems = allItems.filter(item =>
    !item.REPAIR_COUNT_CID || item.REPAIR_COUNT_CID === 0
  );

  console.log(`\nTotal items: ${allItems.length}`);
  console.log(`Fresh items (0 repairs): ${freshItems.length}\n`);

  // Group by GAME_ITEM_ID and rarity
  const groups = {};

  freshItems.forEach(item => {
    const key = `${item.GAME_ITEM_ID_CID}_R${item.RARITY_CID}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  console.log('Fresh items grouped by GAME_ITEM_ID and RARITY:');
  console.log('='.repeat(80));

  const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];

  Object.keys(groups).sort().forEach(key => {
    const items = groups[key];
    const firstItem = items[0];
    const id = firstItem.GAME_ITEM_ID_CID;
    const rarity = firstItem.RARITY_CID;
    const rarityName = rarityNames[rarity] || 'Unknown';

    // Get all durabilities for this group
    const durabilities = items.map(i => i.DURABILITY_CID);
    const maxDur = Math.max(...durabilities);
    const minDur = Math.min(...durabilities);

    // Highlight items with max dur around 20
    const isCharm = maxDur >= 18 && maxDur <= 22;

    console.log(`${isCharm ? '⭐' : '  '} Item #${id} (${rarityName}): ${minDur === maxDur ? maxDur : `${minDur}-${maxDur}`} durability (${items.length} instances)${isCharm ? ' ⭐ CHARM!' : ''}`);
  });

  // Look specifically for items with durability 20
  const dur20Items = freshItems.filter(i => i.DURABILITY_CID === 20);

  if (dur20Items.length > 0) {
    console.log('\n\n' + '='.repeat(80));
    console.log('FRESH ITEMS WITH EXACTLY 20 DURABILITY (likely charms):');
    console.log('='.repeat(80));

    dur20Items.forEach(item => {
      console.log(`\n✅ Item #${item.GAME_ITEM_ID_CID} (${rarityNames[item.RARITY_CID]})`);
      console.log(`   Durability: ${item.DURABILITY_CID}/20`);
      console.log(`   Equipped: ${item.EQUIPPED_TO_SLOT_CID > -1 ? `Slot ${item.EQUIPPED_TO_SLOT_CID}` : 'No'}`);
      console.log(`   DocId: ${item.docId}`);
    });
  }

} catch (error) {
  console.error('Error:', error.message);
}
