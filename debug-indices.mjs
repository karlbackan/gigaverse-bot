import { config } from './src/config.mjs';
import { resetGearConnections, getDirectGearInstances } from './src/direct-api-gear.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Set JWT token and wallet address to Account 5
const account5Token = process.env.JWT_TOKEN_5;
const account5Address = '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81';

process.env.JWT_TOKEN = account5Token;
config.jwtToken = account5Token;
config.walletAddress = account5Address;

resetGearConnections();

console.log('Checking EQUIPPED_TO_INDEX_CID values in raw API response');
console.log('='.repeat(80));

try {
  const gearResponse = await getDirectGearInstances(account5Address);
  const allItems = gearResponse?.entities || [];

  const equippedItems = allItems.filter(item =>
    item.EQUIPPED_TO_SLOT_CID !== null && item.EQUIPPED_TO_SLOT_CID > -1
  );

  console.log(`\nFound ${equippedItems.length} equipped items:\n`);

  equippedItems.forEach(item => {
    console.log(`Item #${item.GAME_ITEM_ID_CID} (${item.docId})`);
    console.log(`  EQUIPPED_TO_SLOT_CID: ${item.EQUIPPED_TO_SLOT_CID}`);
    console.log(`  EQUIPPED_TO_INDEX_CID: ${item.EQUIPPED_TO_INDEX_CID}`);
    console.log(`  Type: ${typeof item.EQUIPPED_TO_INDEX_CID}`);
    console.log(`  Durability: ${item.DURABILITY_CID}`);
    console.log(`  Repair Count: ${item.REPAIR_COUNT_CID || 0}`);
    console.log('');
  });

} catch (error) {
  console.error('Error:', error.message);
}
