import { config } from './src/config.mjs';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Set JWT token to Account 5
const account5Token = process.env.JWT_TOKEN_5;
process.env.JWT_TOKEN = account5Token;
config.jwtToken = account5Token;

console.log('DEBUG: Checking gear for Account 5');
console.log('Token (last 20 chars):', account5Token.slice(-20));
console.log('Expected Address: 0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81');
console.log('='.repeat(80));

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${account5Token}`
  }
});

try {
  // Direct API call
  const response = await api.get('/gear/instances/0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81');

  console.log('\nRAW API RESPONSE:');
  console.log('Total entities:', response.data?.entities?.length);
  console.log('\nALL GEAR ITEMS FROM API:');

  const allGear = response.data?.entities || [];

  allGear.forEach((gear, index) => {
    console.log(`\n[${index}] Gear #${gear.GAME_ITEM_ID_CID} (docId: ${gear.docId})`);
    console.log(`    EQUIPPED_TO_SLOT_CID: ${gear.EQUIPPED_TO_SLOT_CID}`);
    console.log(`    EQUIPPED_TO_INDEX_CID: ${gear.EQUIPPED_TO_INDEX_CID}`);
    console.log(`    DURABILITY_CID: ${gear.DURABILITY_CID}`);
    console.log(`    REPAIR_COUNT_CID: ${gear.REPAIR_COUNT_CID}`);
    console.log(`    RARITY_CID: ${gear.RARITY_CID}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('FILTERING FOR EQUIPPED GEAR (EQUIPPED_TO_SLOT_CID > -1):');
  console.log('='.repeat(80));

  const equipped = allGear.filter(gear =>
    gear.EQUIPPED_TO_SLOT_CID !== null &&
    gear.EQUIPPED_TO_SLOT_CID > -1
  );

  console.log(`\nFound ${equipped.length} equipped items:`);

  equipped.forEach((gear) => {
    const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
    const rarityName = rarityNames[gear.RARITY_CID] || 'Unknown';
    const maxDurability = [40, 50, 60, 70][gear.RARITY_CID] || 40;

    console.log(`\n⚙️ Gear #${gear.GAME_ITEM_ID_CID} (docId: ${gear.docId})`);
    console.log(`   Slot: ${gear.EQUIPPED_TO_SLOT_CID}, Index: ${gear.EQUIPPED_TO_INDEX_CID}`);
    console.log(`   Rarity: ${rarityName}`);
    console.log(`   Durability: ${gear.DURABILITY_CID}/${maxDurability}`);
    console.log(`   Repair Count: ${gear.REPAIR_COUNT_CID || 0}/5`);
  });

} catch (error) {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', error.response.data);
  }
}
