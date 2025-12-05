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

console.log('Inspecting item properties to find charms');
console.log('='.repeat(80));

try {
  const gearResponse = await api.get(`/gear/instances/${account5Address}`);
  const allItems = gearResponse.data?.entities || [];

  // Get one item from slot 6 (gear)
  const slot6Item = allItems.find(item => item.EQUIPPED_TO_SLOT_CID === 6);

  // Get one item with 20 durability (possible charm)
  const durability20Item = allItems.find(item => item.DURABILITY_CID === 20);

  console.log('\n1️⃣  ITEM IN SLOT 6 (I thought was charm):');
  console.log('='.repeat(80));
  if (slot6Item) {
    console.log(JSON.stringify(slot6Item, null, 2));
  }

  console.log('\n\n2️⃣  ITEM WITH 20 DURABILITY:');
  console.log('='.repeat(80));
  if (durability20Item) {
    console.log(JSON.stringify(durability20Item, null, 2));
  }

  // Check if there's a pattern in GAME_ITEM_ID
  console.log('\n\n3️⃣  GAME_ITEM_ID ANALYSIS:');
  console.log('='.repeat(80));

  const itemsByGameId = {};
  allItems.forEach(item => {
    const id = item.GAME_ITEM_ID_CID;
    if (!itemsByGameId[id]) {
      itemsByGameId[id] = [];
    }
    itemsByGameId[id].push(item);
  });

  console.log('\nItem IDs and their typical max durability:');
  Object.keys(itemsByGameId).sort((a, b) => Number(a) - Number(b)).forEach(id => {
    const items = itemsByGameId[id];
    const maxDurs = items.map(i => {
      const rarity = i.RARITY_CID;
      return [40, 50, 60, 70][rarity] || 40;
    });
    const uniqueMaxDurs = [...new Set(maxDurs)];

    // Check if any have current durability of 20
    const hasDur20 = items.some(i => i.DURABILITY_CID === 20);
    const maxDur20 = uniqueMaxDurs.includes(20);

    console.log(`  Item #${id}: max dur = ${uniqueMaxDurs.join('/')}${hasDur20 ? ' (has items with 20 current dur)' : ''}${maxDur20 ? ' ⭐ MAX=20!' : ''}`);
  });

} catch (error) {
  console.error('Error:', error.message);
}
