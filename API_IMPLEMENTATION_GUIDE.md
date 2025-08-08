# 🛠️ Gigaverse API Implementation Guide

> **Technical implementation details and patterns for developers**

---

## 🏗️ **API Architecture**

### Base Configuration
```javascript
const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 15000
});

// Add auth interceptor
api.interceptors.request.use(config => {
  const token = process.env.JWT_TOKEN || getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 🎯 **Endpoint Implementation Patterns**

### 🔓 **Public Endpoints** (No Authentication)

#### Account Information
```javascript
// Get game account info - WORKING
async function getGameAccount(address) {
  const response = await api.get(`/user/gameaccount/${address}`);
  return response.data;
  /* Returns:
  {
    "address": "0x...",
    "noob": null,
    "allowedToCreateAccount": true,
    "canEnterGame": false,
    "noobPassBalance": 0,
    "lastNoobId": 76291,
    "maxNoobId": 10000
  }
  */
}

// Get full account details - WORKING
async function getAccountDetails(address) {
  const response = await api.get(`/account/${address}`);
  return response.data;
  /* Returns:
  {
    "accountEntity": {...},
    "checkpointProgress": {...},
    "noob": {...},
    "usernames": [...]
  }
  */
}
```

#### Player Data
```javascript
// Get player energy - WORKING
async function getPlayerEnergy(address) {
  const response = await api.get(`/offchain/player/energy/${address}`);
  return response.data;
  /* Returns:
  {
    "entities": [
      {
        "parsedData": {
          "energyValue": 160,
          "isPlayerJuiced": false,
          ...
        }
      }
    ]
  }
  */
}

// Get player gear - WORKING
async function getPlayerGear(address) {
  const response = await api.get(`/gear/instances/${address}`);
  return response.data;
  /* Returns:
  {
    "entities": [
      {
        "docId": "GearInstance#123",
        "EQUIPPED_TO_SLOT_CID": 1,  // -1 = unequipped, >-1 = equipped
        ...
      }
    ]
  }
  */
}

// Get player balances - WORKING
async function getPlayerBalances(address) {
  const response = await api.get(`/importexport/balances/${address}`);
  return response.data;
}

// Get player items - WORKING
async function getPlayerItems(address) {
  const response = await api.get(`/indexer/player/gameitems/${address}`);
  return response.data;
}

// Track analytics event - WORKING
async function trackAnalytics(eventData) {
  const response = await api.post('/analytics/event', eventData);
  return response.data; // Returns: { "success": true }
}
```

### 🔒 **Authenticated Endpoints** (Require JWT)

#### User Management
```javascript
// Get current user info - NEEDS AUTH
async function getCurrentUser() {
  const response = await api.get('/user/me');
  return response.data;
}

// Update user info - NEEDS AUTH (multiple methods supported)
async function updateUser(userData) {
  // Try different methods - all return 401 (need valid token)
  const response = await api.post('/user/me', userData);
  // Alternative: PUT, DELETE, PATCH also supported
  return response.data;
}
```

#### Game System Implementation

##### Dungeon System
```javascript
// Get current dungeon state - NEEDS AUTH
async function getDungeonState() {
  const response = await api.get('/game/dungeon/state');
  return response.data;
}

// Get available dungeons today - NEEDS AUTH
async function getAvailableDungeons() {
  const response = await api.get('/game/dungeon/today');
  return response.data;
}

// Primary dungeon action function - NEEDS AUTH
async function sendDungeonAction(action, dungeonType, data = {}, actionToken = null) {
  const payload = {
    action, // 'start_run', 'rock', 'paper', 'scissors', 'select_loot_0', etc.
    dungeonType, // 1=Regular, 2=Juiced, 3=Underhaul
    data
  };
  
  if (actionToken) {
    payload.actionToken = actionToken;
  }
  
  const response = await api.post('/game/dungeon/action', payload);
  return {
    data: response.data.data,
    actionToken: response.data.actionToken,
    message: response.data.message
  };
}

// Alternative methods also supported (GET, PUT, DELETE, PATCH)
async function getDungeonActionState() {
  const response = await api.get('/game/dungeon/action');
  return response.data;
}
```

##### Underhaul System
```javascript
// Get Underhaul state - NEEDS AUTH
async function getUnderhaulState() {
  const response = await api.get('/game/underhaul/state');
  return response.data;
}

// Primary Underhaul action function - NEEDS AUTH
async function sendUnderhaulAction(action, data = {}, actionToken = null) {
  const payload = {
    action, // 'start_run', 'rock', 'paper', 'scissors', 'select_loot_0', etc.
    data    // Must include gearInstanceIds for start_run
  };
  
  if (actionToken) {
    payload.actionToken = actionToken;
  }
  
  const response = await api.post('/game/underhaul/action', payload);
  return {
    data: response.data.data,
    actionToken: response.data.actionToken,
    message: response.data.message
  };
}

// Get Underhaul availability and history - NEEDS AUTH
async function getUnderhaulInfo() {
  const [today, history, stats, leaderboard] = await Promise.all([
    api.get('/game/underhaul/today'),
    api.get('/game/underhaul/history'),
    api.get('/game/underhaul/stats'),
    api.get('/game/underhaul/leaderboard')
  ]);
  
  return {
    today: today.data,
    history: history.data,
    stats: stats.data,
    leaderboard: leaderboard.data
  };
}
```

---

## 🔧 **Alternative Endpoint Exploration**

### Endpoints That Need Method Testing (405 Responses)

```javascript
// These endpoints exist but need correct HTTP methods

// Authentication (try GET instead of POST?)
async function testAuthEndpoints() {
  try {
    // These all return 405 - try different methods
    await api.get('/auth/login');    // Instead of POST
    await api.get('/auth/logout');   
    await api.get('/auth/refresh');
  } catch (error) {
    console.log('Auth endpoint status:', error.response?.status);
  }
}

// Direct game endpoints (try GET instead of POST?)
async function testDirectGameEndpoints() {
  try {
    await api.get('/dungeon/action');     // Instead of POST
    await api.get('/underhaul/action');   
    await api.get('/dungeon/start');
    await api.get('/underhaul/start');
  } catch (error) {
    console.log('Direct game endpoint status:', error.response?.status);
  }
}

// Gear management (try GET or different structure?)
async function testGearEndpoints() {
  try {
    await api.get('/gear/equip');         // Instead of POST
    await api.get('/gear/unequip');
    await api.get('/gear/craft');
  } catch (error) {
    console.log('Gear endpoint status:', error.response?.status);
  }
}

// Battle system (try GET or different structure?)
async function testBattleEndpoints() {
  try {
    await api.get('/battle/start');       // Instead of POST
    await api.get('/combat/action');
  } catch (error) {
    console.log('Battle endpoint status:', error.response?.status);
  }
}

// User settings (try GET instead of PUT?)
async function testUserSettings() {
  try {
    await api.get('/user/settings');      // Instead of PUT
    await api.get('/user/gameaccount');   // Instead of POST
  } catch (error) {
    console.log('User settings status:', error.response?.status);
  }
}
```

---

## 📊 **Error Handling Patterns**

```javascript
// Standard error handler for all API calls
function handleApiError(error, context = '') {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        console.error(`${context}: Authentication required`);
        // Token might be expired - refresh or re-login
        break;
        
      case 403:
        console.error(`${context}: Access forbidden`);
        // User doesn't have permission
        break;
        
      case 404:
        console.error(`${context}: Endpoint not found`);
        // Endpoint doesn't exist
        break;
        
      case 405:
        console.error(`${context}: Wrong HTTP method - endpoint exists!`);
        // Try different HTTP method (GET instead of POST, etc.)
        break;
        
      case 400:
        console.error(`${context}: Bad request format`);
        console.error('Message:', data?.message);
        // Fix request payload structure
        break;
        
      case 422:
        console.error(`${context}: Validation error`);
        console.error('Details:', data);
        // Fix request data validation
        break;
        
      case 500:
        console.error(`${context}: Server error - endpoint exists but broken`);
        // Server-side issue, retry later
        break;
        
      default:
        console.error(`${context}: Unexpected status ${status}`);
        console.error('Response:', data);
    }
  } else {
    console.error(`${context}: Network error:`, error.message);
  }
}

// Usage example
async function safeApiCall(apiFunction, context) {
  try {
    return await apiFunction();
  } catch (error) {
    handleApiError(error, context);
    throw error;
  }
}
```

---

## 🎮 **Game Flow Implementation**

### Complete Dungeon Run Flow
```javascript
class DungeonPlayer {
  constructor(jwtToken) {
    this.token = jwtToken;
    this.actionToken = null;
  }
  
  async playCompleteDungeon(dungeonType = 1) {
    try {
      // 1. Check if already in dungeon
      const currentState = await getDungeonState();
      if (currentState?.run) {
        console.log('Already in active dungeon');
        return this.continueExistingRun();
      }
      
      // 2. Check daily availability  
      const availability = await getAvailableDungeons();
      console.log('Available runs:', availability);
      
      // 3. Prepare start data
      const startData = {
        isJuiced: false,
        consumables: [],
        itemId: 0,
        index: 0,
        gearInstanceIds: []
      };
      
      // 4. For Underhaul, get equipped gear
      if (dungeonType === 3) {
        const gear = await getPlayerGear(this.address);
        startData.gearInstanceIds = gear.entities
          .filter(g => g.EQUIPPED_TO_SLOT_CID > -1)
          .map(g => g.docId);
      }
      
      // 5. Start dungeon
      const startResult = await this.sendAction('start_run', dungeonType, startData);
      console.log('Dungeon started:', startResult.message);
      
      // 6. Play through all rooms
      return await this.playAllRooms(dungeonType);
      
    } catch (error) {
      handleApiError(error, 'Complete Dungeon Run');
    }
  }
  
  async sendAction(action, dungeonType, data = {}) {
    if (dungeonType === 3) {
      // Use Underhaul endpoint
      const result = await sendUnderhaulAction(action, data, this.actionToken);
      this.actionToken = result.actionToken;
      return result;
    } else {
      // Use regular dungeon endpoint
      const result = await sendDungeonAction(action, dungeonType, data, this.actionToken);
      this.actionToken = result.actionToken;
      return result;
    }
  }
}
```

### Smart Endpoint Detection
```javascript
// Automatically detect which endpoints work
async function discoverWorkingEndpoints() {
  const testEndpoints = [
    { method: 'GET', path: '/user/me', needsAuth: true },
    { method: 'POST', path: '/user/auth', needsAuth: false },
    { method: 'GET', path: '/auth/login', needsAuth: false },
    // ... more endpoints
  ];
  
  const workingEndpoints = [];
  
  for (const endpoint of testEndpoints) {
    try {
      const response = await api[endpoint.method.toLowerCase()](endpoint.path);
      workingEndpoints.push({
        ...endpoint,
        status: response.status,
        working: true
      });
    } catch (error) {
      if (error.response?.status === 401 && endpoint.needsAuth) {
        workingEndpoints.push({
          ...endpoint,
          status: 401,
          working: true, // 401 means endpoint exists, just needs auth
          message: 'Needs authentication'
        });
      } else if (error.response?.status === 405) {
        workingEndpoints.push({
          ...endpoint,
          status: 405,
          working: true, // Endpoint exists, wrong method
          message: 'Try different HTTP method'
        });
      }
    }
  }
  
  return workingEndpoints;
}
```

---

## 🚀 **Future Implementation Priorities**

### 1. **High Priority** (Confirmed Working)
```javascript
// Implement these first - confirmed working endpoints
- User profile management (/user/me)
- Dungeon history & statistics (/game/dungeon/history, /game/dungeon/stats)  
- Leaderboards (/game/dungeon/leaderboard, /game/underhaul/leaderboard)
- Import/Export functionality (/importexport/import, /importexport/export)
```

### 2. **Medium Priority** (Need Method Testing)
```javascript
// Test these with different HTTP methods
- Authentication system (/auth/*)
- Gear management (/gear/equip, /gear/unequip) 
- Battle system (/battle/start, /combat/action)
- Direct game control (/dungeon/action, /underhaul/action)
```

### 3. **Exploration** (Unknown Status)
```javascript
// Investigate these further
- GraphQL interface (/graphql)
- User settings (/user/settings)
- Advanced analytics (/analytics/track)
```

---

**This implementation guide provides the technical foundation for building comprehensive Gigaverse integrations using the discovered API endpoints.**