import axios from 'axios';
import { config, validateConfig } from './config.mjs';

console.log('=== Gigaverse API Documentation Generator ===\n');

validateConfig();

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Authorization': `Bearer ${config.jwtToken}`,
    'Content-Type': 'application/json'
  },
  validateStatus: () => true // Don't throw on any status
});

// All discovered endpoints
const endpoints = {
  // Core Game Endpoints
  dungeon: {
    state: { path: '/game/dungeon/state', method: 'GET' },
    today: { path: '/game/dungeon/today', method: 'GET' },
    action: { path: '/game/dungeon/action', method: 'POST' }
  },
  
  // Player Data
  player: {
    energy: { path: `/offchain/player/energy/${config.walletAddress}`, method: 'GET' },
    account: { path: `/account/${config.walletAddress}`, method: 'GET' },
    faction: { path: `/factions/player/${config.walletAddress}`, method: 'GET' },
    username: { path: `/indexer/player/usernames/${config.walletAddress}`, method: 'GET' },
    activeDungeon: { path: `/offchain/player/activeDungeon/${config.walletAddress}`, method: 'GET' },
    gameItems: { path: `/indexer/player/gameitems/${config.walletAddress}`, method: 'GET' },
    importExport: { path: `/importexport/balances/${config.walletAddress}`, method: 'GET' }
  },
  
  // Fishing
  fishing: {
    state: { path: `/fishing/state/${config.walletAddress}`, method: 'GET' },
    action: { path: '/fishing/action', method: 'POST' }
  },
  
  // Items & Skills
  offchain: {
    gameItems: { path: '/offchain/gameitems', method: 'GET' },
    skills: { path: '/offchain/skills', method: 'GET' },
    skillsProgress: { path: `/offchain/skills/progress/1`, method: 'GET' }, // Need noob ID
    static: { path: '/offchain/static', method: 'GET' },
    recipesStart: { path: '/offchain/recipes/start', method: 'POST' }
  },
  
  // Gear
  gear: {
    items: { path: '/gear/items', method: 'GET' },
    instances: { path: `/gear/instances/${config.walletAddress}`, method: 'GET' },
    repair: { path: '/gear/repair', method: 'POST' }
  },
  
  // Marketplace
  marketplace: {
    floorPrices: { path: '/marketplace/item/floor/all', method: 'GET' }
  },
  
  // ROMs
  roms: {
    player: { path: `/roms/player/${config.walletAddress}`, method: 'GET' },
    claim: { path: '/roms/factory/claim', method: 'POST' }
  },
  
  // Juice
  juice: {
    player: { path: `/gigajuice/player/${config.walletAddress}`, method: 'GET' }
  },
  
  // Indexer
  indexer: {
    enemies: { path: '/indexer/enemies', method: 'GET' }
  }
};

async function testEndpoint(name, config) {
  try {
    const response = await api({
      method: config.method,
      url: config.path,
      timeout: 10000,
      data: config.data
    });
    
    return {
      name,
      ...config,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    return {
      name,
      ...config,
      error: error.message
    };
  }
}

async function documentAPI() {
  const results = [];
  let documentation = '# Gigaverse API Documentation\n\n';
  documentation += 'Generated from reverse engineering the API\n\n';
  documentation += '## Base URL\n`https://gigaverse.io/api`\n\n';
  documentation += '## Authentication\nAll endpoints require JWT Bearer token in Authorization header\n\n';
  documentation += '---\n\n';
  
  // Test all endpoints
  for (const [category, endpoints_in_category] of Object.entries(endpoints)) {
    console.log(`\nTesting ${category} endpoints...`);
    documentation += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Endpoints\n\n`;
    
    for (const [name, config] of Object.entries(endpoints_in_category)) {
      console.log(`  Testing ${name}...`);
      const result = await testEndpoint(name, config);
      results.push(result);
      
      // Add to documentation
      documentation += `### ${name}\n`;
      documentation += `- **Path**: \`${config.path}\`\n`;
      documentation += `- **Method**: ${config.method}\n`;
      documentation += `- **Status**: ${result.status || 'Error'} ${result.statusText || result.error || ''}\n`;
      
      if (result.status === 200 && result.data) {
        documentation += `- **Response Structure**:\n`;
        documentation += '```json\n';
        
        // Show structure without full data
        const structure = getStructure(result.data);
        documentation += JSON.stringify(structure, null, 2);
        documentation += '\n```\n';
        
        // Save full response for analysis
        if (result.data && typeof result.data === 'object') {
          await saveResponse(category, name, result.data);
        }
      } else if (result.status && result.status !== 200) {
        documentation += `- **Error Response**:\n`;
        documentation += '```json\n';
        documentation += JSON.stringify(result.data, null, 2);
        documentation += '\n```\n';
      }
      
      documentation += '\n';
    }
  }
  
  // Test different action formats
  console.log('\nTesting action endpoint formats...');
  documentation += '## Action Endpoint Formats\n\n';
  
  const actionTests = [
    {
      name: 'Combat Action (rock)',
      data: { action: 'rock', dungeonType: 3 }
    },
    {
      name: 'Loot Action',
      data: { action: 'loot_one' }
    },
    {
      name: 'Start Dungeon',
      data: { action: 'start', dungeonType: 3, data: { isJuiced: false } }
    },
    {
      name: 'Use Consumable',
      data: { action: 'rock', dungeonType: 3, data: { consumables: [1] } }
    }
  ];
  
  for (const test of actionTests) {
    console.log(`  Testing ${test.name}...`);
    const result = await testEndpoint(test.name, {
      path: '/game/dungeon/action',
      method: 'POST',
      data: test.data
    });
    
    documentation += `### ${test.name}\n`;
    documentation += '- **Request**:\n```json\n';
    documentation += JSON.stringify(test.data, null, 2);
    documentation += '\n```\n';
    documentation += `- **Response Status**: ${result.status}\n`;
    if (result.data) {
      documentation += '- **Response**:\n```json\n';
      documentation += JSON.stringify(result.data, null, 2);
      documentation += '\n```\n';
    }
    documentation += '\n';
  }
  
  // Save documentation
  const fs = await import('fs/promises');
  await fs.writeFile('API_DOCUMENTATION.md', documentation);
  console.log('\n✅ Documentation saved to API_DOCUMENTATION.md');
  
  return results;
}

function getStructure(obj, depth = 0) {
  if (depth > 3) return '...';
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [];
    return [getStructure(obj[0], depth + 1)];
  }
  
  if (obj === null) return null;
  if (typeof obj !== 'object') return typeof obj;
  
  const structure = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      structure[key] = value.length > 0 ? [getStructure(value[0], depth + 1)] : [];
    } else if (value === null) {
      structure[key] = null;
    } else if (typeof value === 'object') {
      structure[key] = getStructure(value, depth + 1);
    } else {
      structure[key] = typeof value;
    }
  }
  
  return structure;
}

async function saveResponse(category, name, data) {
  const fs = await import('fs/promises');
  const dir = `./api-responses/${category}`;
  
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      `${dir}/${name}.json`,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error(`Failed to save response for ${category}/${name}:`, error.message);
  }
}

// Run documentation
(async () => {
  try {
    await documentAPI();
    console.log('\n=== Documentation Complete ===');
  } catch (error) {
    console.error('Fatal error:', error);
  }
})();