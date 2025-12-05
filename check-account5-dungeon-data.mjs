import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const account5Token = process.env.JWT_TOKEN_5;

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${account5Token}`,
    'Content-Type': 'application/json'
  }
});

console.log('=== Checking Account 5 Dungeon Data ===\n');

try {
  const todayResponse = await api.get('/game/dungeon/today');
  const todayData = todayResponse.data;

  console.log('Day Progress Entities:');
  todayData.dayProgressEntities?.forEach(e => {
    const dungeonId = e.ID_CID;
    const runs = e.UINT256_CID || 0;
    const name = dungeonId === 1 ? 'Dungetron 5000' :
                 dungeonId === 3 ? 'Underhaul' : `Unknown (${dungeonId})`;
    console.log(`  ${name} (ID ${dungeonId}): ${runs} runs today`);
  });

  console.log('\nDungeon Data Entities:');
  todayData.dungeonDataEntities?.forEach(d => {
    const dungeonId = d.ID_CID;
    const maxRuns = d.UINT256_CID;
    const juicedMax = d.juicedMaxRunsPerDay;
    const name = dungeonId === 1 ? 'Dungetron 5000' :
                 dungeonId === 3 ? 'Underhaul' : `Unknown (${dungeonId})`;
    console.log(`  ${name} (ID ${dungeonId}): Max runs = ${maxRuns}, Juiced max = ${juicedMax}`);
  });

  // Check specifically for Dungetron 5000
  const dungetron5000Info = todayData.dungeonDataEntities?.find(d => d.ID_CID === 1 || d.ID_CID === "1");
  const dungetron5000Progress = todayData.dayProgressEntities?.find(e => e.ID_CID === "1" || e.ID_CID === 1);

  console.log('\n=== Dungetron 5000 Specific Data ===');
  console.log('Info data:', dungetron5000Info ? 'EXISTS' : 'MISSING');
  const progressText = dungetron5000Progress ? `EXISTS (${dungetron5000Progress.UINT256_CID || 0} runs)` : 'MISSING (assuming 0 runs)';
  console.log('Progress data:', progressText);

  if (!dungetron5000Info) {
    console.log('\n⚠️  PROBLEM: Dungetron 5000 info is missing!');
    console.log('   This will cause the bot to skip Dungetron 5000 even if it\'s available.');
  }

} catch (error) {
  console.error('Error:', error.message);
  if (error.response?.data) {
    console.error('Response data:', error.response.data);
  }
}
