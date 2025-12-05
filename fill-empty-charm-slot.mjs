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

resetGearConnections();

console.log('Filling empty charm slot (Slot 6, Index 0)');
console.log('='.repeat(80));

const gearManager = new GearManager();

try {
  console.log('\n1️⃣  Finding replacement charm...');
  const replacement = await gearManager.findReplacementCharm();

  if (!replacement) {
    console.log('❌ No replacement charm available');
    process.exit(1);
  }

  const rarityNames = ['Common', 'Uncommon', 'Rare', 'Epic'];
  console.log(`✅ Found: Charm #${replacement.GAME_ITEM_ID_CID} (${rarityNames[replacement.RARITY_CID]})`);
  console.log(`   Durability: ${replacement.DURABILITY_CID}`);
  console.log(`   Repair Count: ${replacement.REPAIR_COUNT_CID || 0}/2`);

  console.log('\n2️⃣  Equipping to Slot 6, Index 0...');
  const equipSuccess = await gearManager.equipCharm(replacement.docId, 0);

  if (equipSuccess) {
    console.log('✅ Successfully equipped charm to Index 0!');
  } else {
    console.log('❌ Failed to equip charm');
  }

  console.log('\n3️⃣  Verifying both charm slots are filled...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  const { getDirectGearInstances } = await import('./src/direct-api-gear.mjs');
  const gearResponse = await getDirectGearInstances(account5Address);
  const allItems = gearResponse?.entities || [];

  const equippedCharms = allItems.filter(item =>
    item.EQUIPPED_TO_SLOT_CID === 6 &&
    (item.GAME_ITEM_ID_CID === 227 || item.GAME_ITEM_ID_CID === 228)
  );

  console.log(`\nCharms equipped in Slot 6: ${equippedCharms.length}`);
  equippedCharms.forEach(charm => {
    console.log(`  💎 Charm #${charm.GAME_ITEM_ID_CID} at Index ${charm.EQUIPPED_TO_INDEX_CID}`);
  });

  if (equippedCharms.length === 2) {
    console.log('\n✅ SUCCESS! Both charm slots are now filled!');
  } else {
    console.log(`\n⚠️  Only ${equippedCharms.length} charm(s) equipped`);
  }

} catch (error) {
  console.error('Error:', error);
}
