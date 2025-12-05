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

console.log('Analyzing equipped items and their slot indices');
console.log('='.repeat(80));

try {
  const gearResponse = await getDirectGearInstances(account5Address);
  const allItems = gearResponse?.entities || [];

  const equippedItems = allItems.filter(item =>
    item.EQUIPPED_TO_SLOT_CID !== null && item.EQUIPPED_TO_SLOT_CID > -1
  );

  // Group by slot
  const slotGroups = {};
  equippedItems.forEach(item => {
    const slot = item.EQUIPPED_TO_SLOT_CID;
    if (!slotGroups[slot]) {
      slotGroups[slot] = [];
    }
    slotGroups[slot].push(item);
  });

  console.log('\n📊 EQUIPPED ITEMS BY SLOT:\n');

  Object.keys(slotGroups).sort((a, b) => Number(a) - Number(b)).forEach(slot => {
    const items = slotGroups[slot];
    console.log(`Slot ${slot}: ${items.length} item(s)`);

    items.forEach(item => {
      const isCharm = item.GAME_ITEM_ID_CID === 227 || item.GAME_ITEM_ID_CID === 228;
      const type = isCharm ? '💎 Charm' : '⚙️  Gear';

      console.log(`  ${type} #${item.GAME_ITEM_ID_CID}`);
      console.log(`    Index: ${item.EQUIPPED_TO_INDEX_CID}`);
      console.log(`    Durability: ${item.DURABILITY_CID}`);
      console.log(`    Repair Count: ${item.REPAIR_COUNT_CID || 0}`);
    });
    console.log('');
  });

  // Check for charm slots specifically
  console.log('='.repeat(80));
  console.log('CHARM SLOT ANALYSIS (Slot 6):');
  console.log('='.repeat(80));

  const charmSlot = slotGroups[6] || [];

  console.log(`\nCurrently equipped in Slot 6: ${charmSlot.length} charm(s)`);

  const occupiedIndices = new Set(charmSlot.map(item => item.EQUIPPED_TO_INDEX_CID));
  const allPossibleIndices = [0, 1]; // Assuming 2 charm slots

  console.log(`Occupied indices: [${Array.from(occupiedIndices).join(', ')}]`);

  const emptyIndices = allPossibleIndices.filter(idx => !occupiedIndices.has(idx));
  console.log(`Empty indices: [${emptyIndices.join(', ')}]`);

  if (emptyIndices.length > 0) {
    console.log(`\n⚠️  There are ${emptyIndices.length} empty charm slot(s) that could be filled!`);
    emptyIndices.forEach(idx => {
      console.log(`   - Slot 6, Index ${idx} is EMPTY`);
    });
  } else {
    console.log('\n✅ All charm slots are filled');
  }

} catch (error) {
  console.error('Error:', error.message);
}
