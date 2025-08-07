import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const accounts = [
  { name: 'Account 1', jwt: process.env.JWT_TOKEN_1, address: '0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0' },
  { name: 'Account 2', jwt: process.env.JWT_TOKEN_2, address: '0x9eA5626fCEdac54de64A87243743f0CE7AaC5816' },
  { name: 'Account 3', jwt: process.env.JWT_TOKEN_3, address: '0xAa2FCFc89E9Cc49FdcAF56E2a03EB58154066963' },
  { name: 'Account 4', jwt: process.env.JWT_TOKEN_4, address: '0x2153433D4c13f72b5b10af5dF5fC93866Eea046b' },
  { name: 'Account 5', jwt: process.env.JWT_TOKEN_5, address: '0x7E42Ab34A82CbdA332B4Ab1a26D9F4C4fdAA9a81' }
];

async function checkAccounts() {
  for (const account of accounts) {
    const jwt = account.jwt;
    if (!jwt) {
      console.log(`${account.name}: No JWT token`);
      continue;
    }
    
    const api = axios.create({
      baseURL: 'https://gigaverse.io/api',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'User-Agent': 'Gigaverse-Bot/1.0'
      }
    });
    
    try {
      const res = await api.get('/game/dungeon/state');
      if (res.data?.data?.run) {
        const entity = res.data.data.entity;
        const dungeonType = entity?.DUNGEON_TYPE_CID || 1;
        const room = entity?.ROOM_NUM_CID || 0;
        console.log(`${account.name}: Active dungeon type ${dungeonType}, room ${room}`);
      } else {
        console.log(`${account.name}: No active dungeon`);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`${account.name}: No active dungeon`);
      } else {
        console.log(`${account.name}: Error - ${error.message}`);
      }
    }
  }
}

checkAccounts().catch(console.error);