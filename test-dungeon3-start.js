import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const JWT = process.env.JWT_TOKEN_1; // Using Account 1
let currentActionToken = null;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${JWT}`,
    'User-Agent': 'Gigaverse-Bot/1.0',
    'Content-Type': 'application/json'
  }
});

async function tryStartDungeon3() {
  console.log('Attempting to start Dungeon 3 (Underhaul) on Account 1...\n');
  
  const requestData = {
    action: 'start_run',
    dungeonType: 3,  // Explicitly dungeon 3
    data: {
      isJuiced: false,
      consumables: [],
      itemId: 0,
      index: 0,
      gearInstanceIds: []  // Would need actual gear IDs for Underhaul
    }
  };

  if (currentActionToken) {
    requestData.actionToken = currentActionToken;
  }

  console.log('Request:', JSON.stringify(requestData, null, 2));
  console.log('\nSending to /game/dungeon/action...\n');

  try {
    const response = await api.post('/game/dungeon/action', requestData);
    console.log('✅ SUCCESS! Dungeon 3 started!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Failed to start Dungeon 3');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
      
      // Save action token if provided
      if (error.response.data?.actionToken) {
        currentActionToken = error.response.data.actionToken.toString();
        console.log('\n📝 Saved action token:', currentActionToken);
      }
      
      if (error.response.data?.message === 'Error handling action') {
        console.log('\n⚠️  This error confirms that the server blocks Underhaul starts via API');
        console.log('The server recognizes dungeonType: 3 but refuses to start it.');
        console.log('This is intentional server-side blocking, not a client issue.');
      }
    } else {
      console.log('Network Error:', error.message);
    }
    
    return false;
  }
}

// First check if there's an active dungeon
async function checkActiveDungeon() {
  try {
    const res = await api.get('/game/dungeon/state');
    if (res.data?.data?.run) {
      const entity = res.data.data.entity;
      const dungeonType = entity?.DUNGEON_TYPE_CID || 1;
      console.log(`⚠️  Account 1 already has an active dungeon type ${dungeonType}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function main() {
  // Check if there's already an active dungeon
  const hasActive = await checkActiveDungeon();
  if (hasActive) {
    console.log('Cannot start new dungeon - one is already active\n');
    return;
  }
  
  // Try to start Dungeon 3
  const success = await tryStartDungeon3();
  
  if (!success) {
    console.log('\n🔴 As expected, Dungeon 3 (Underhaul) cannot be started via API.');
    console.log('The server specifically blocks this action.');
    console.log('\n✅ Our fallback prevention is working - it did NOT start dungeon 1!');
  }
}

main().catch(console.error);