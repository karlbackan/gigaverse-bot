# 🌟 Gigaverse API - Comprehensive Documentation

> **Generated from systematic endpoint discovery on 2025-08-08**  
> **Base URL:** `https://gigaverse.io/api`  
> **Endpoints Discovered:** 55 existing endpoints across 14 categories

---

## 📊 **API Overview**

### Discovery Summary
- **Total Endpoints Tested**: 113
- **Existing Endpoints Found**: 55  
- **Public Endpoints**: 7 (no auth required)
- **Authenticated Endpoints**: 27 (require JWT token)
- **Wrong Method (405)**: 21 (endpoints exist but need different HTTP method)

### Response Codes Guide
- **200**: Success - endpoint works
- **401**: Needs authentication (endpoint exists)
- **405**: Wrong HTTP method (endpoint exists, try different method)
- **500**: Server error (endpoint exists but has issues)
- **404**: Endpoint doesn't exist

---

## 🗂️ **API Categories**

## 🔓 **PUBLIC ENDPOINTS** (No Authentication Required)

### 👤 **User & Account Information**
```bash
GET /user/gameaccount/{address}           # Game account info by wallet address
GET /account/{address}                    # Full account details
```

**Example Response** (`/user/gameaccount/{address}`):
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "noob": null,
  "allowedToCreateAccount": true,
  "canEnterGame": false,
  "noobPassBalance": 0,
  "lastNoobId": 76291,
  "maxNoobId": 10000
}
```

**Example Response** (`/account/{address}`):
```json
{
  "accountEntity": {...},
  "checkpointProgress": {...},
  "noob": {...},
  "usernames": [...]
}
```

### ⚡ **Player Data**
```bash
GET /offchain/player/energy/{address}     # Player energy levels
GET /gear/instances/{address}             # Player's gear instances  
GET /importexport/balances/{address}      # Player's token balances
GET /indexer/player/gameitems/{address}   # Player's game items
```

### 📊 **Analytics**
```bash
POST /analytics/event                     # Track events (public analytics)
```

---

## 🔒 **AUTHENTICATED ENDPOINTS** (Require JWT Token)

### 👤 **User Management**
```bash
GET    /user/me                          # Current authenticated user info
POST   /user/me                          # Update user info
PUT    /user/me                          # Update user info (alt method)
DELETE /user/me                          # Delete user account
PATCH  /user/me                          # Partially update user info
```

### 🎮 **Game - Dungeon System**
```bash
# Dungeon State & Info
GET /game/dungeon/state                   # Current dungeon run state
GET /game/dungeon/today                   # Available dungeons today
GET /game/dungeon/history                 # Dungeon run history
GET /game/dungeon/stats                   # Player dungeon statistics
GET /game/dungeon/leaderboard             # Dungeon leaderboards

# Dungeon Actions  
POST   /game/dungeon/action              # Primary dungeon action endpoint
GET    /game/dungeon/action              # Alternative method (may return state)
PUT    /game/dungeon/action              # Alternative method
DELETE /game/dungeon/action              # Alternative method
PATCH  /game/dungeon/action              # Alternative method
```

**Dungeon Action Payload**:
```json
{
  "action": "start_run|rock|paper|scissors|select_loot_0|select_loot_1|select_loot_2",
  "dungeonType": 1,  // 1=Dungetron5000, 2=Juiced, 3=Underhaul
  "data": {
    "isJuiced": false,
    "consumables": [],
    "itemId": 0,
    "index": 0,
    "gearInstanceIds": []  // Required for Underhaul
  },
  "actionToken": "..." // From previous response
}
```

### 🔥 **Game - Underhaul System**
```bash
# Underhaul State & Info
GET /game/underhaul/state                 # Current Underhaul run state
GET /game/underhaul/today                 # Available Underhaul dungeons
GET /game/underhaul/history               # Underhaul run history  
GET /game/underhaul/stats                 # Player Underhaul statistics
GET /game/underhaul/leaderboard           # Underhaul leaderboards

# Underhaul Actions
POST   /game/underhaul/action            # Primary Underhaul action endpoint ⭐
GET    /game/underhaul/action            # Alternative method
PUT    /game/underhaul/action            # Alternative method
DELETE /game/underhaul/action            # Alternative method
PATCH  /game/underhaul/action            # Alternative method
```

**Underhaul Action Payload**:
```json
{
  "action": "start_run|rock|paper|scissors|select_loot_0|select_loot_1|select_loot_2",
  "data": {
    "isJuiced": false,
    "consumables": [],
    "itemId": 0,
    "index": 0,
    "gearInstanceIds": ["GearInstance#123", "GearInstance#456"]  // REQUIRED
  },
  "actionToken": "..." // From previous response
}
```

### 📦 **Import/Export** 
```bash
POST /importexport/import                 # Import game data
POST /importexport/export                 # Export game data
```

---

## 🔧 **ENDPOINTS WITH ALTERNATIVE METHODS** (405 Responses)

These endpoints exist but return "Method Not Allowed" - they may work with different HTTP methods:

### 👤 **User Endpoints**
```bash
PUT  /user/settings                       # User settings (try GET or POST)
POST /user/gameaccount                    # Game account creation (try GET)
```

### 🛡️ **Authentication**
```bash
POST /auth/login                          # Login endpoint (might need different method)
POST /auth/logout                         # Logout endpoint
POST /auth/refresh                        # Token refresh endpoint
```

### ⚔️ **Combat & Battle**
```bash
POST /battle/start                        # Battle initiation
POST /combat/action                       # Combat actions
```

### 🎮 **Direct Game Endpoints** (Alternative Paths)
```bash
POST /dungeon/action                      # Direct dungeon actions
POST /dungeon/start                       # Direct dungeon start
POST /underhaul/action                    # Direct Underhaul actions
POST /underhaul/start                     # Direct Underhaul start
```

### 🔧 **Gear Management**
```bash
POST /gear/equip                          # Equip gear items
POST /gear/unequip                        # Unequip gear items  
POST /gear/craft                          # Craft new gear
```

### 📊 **Analytics**
```bash
POST /analytics/track                     # Track user actions
```

### 🔍 **GraphQL**
```bash
POST /graphql                             # GraphQL endpoint (try with proper query)
```

---

## 💡 **Implementation Patterns**

### 🔑 **Authentication**
All authenticated endpoints require JWT token in header:
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### 🎯 **Action Token Pattern** 
Game endpoints use action token chaining:
```json
// Request
{
  "action": "start_run",
  "actionToken": "previous_token_here"
}

// Response  
{
  "data": {...},
  "actionToken": "new_token_for_next_request"
}
```

### 📝 **Standard Request Headers**
```bash
Content-Type: application/json
Accept: application/json
Authorization: Bearer YOUR_JWT_TOKEN  # For auth endpoints
```

---

## 🎮 **Game-Specific Implementation Guide**

### 🏰 **Starting a Dungeon**
1. **Check daily availability**: `GET /game/dungeon/today`
2. **Check current state**: `GET /game/dungeon/state` 
3. **Start run**: `POST /game/dungeon/action` with `action: "start_run"`

### 🔥 **Starting Underhaul**
1. **Get equipped gear**: `GET /gear/instances/{address}` (filter EQUIPPED_TO_SLOT_CID > -1)
2. **Check availability**: `GET /game/underhaul/today`
3. **Start run**: `POST /game/underhaul/action` with gear IDs

### ⚔️ **Combat Actions**
```json
{
  "action": "rock|paper|scissors",
  "dungeonType": 1,  // Only for regular dungeons
  "data": { ... },
  "actionToken": "from_previous_response"
}
```

### 🎁 **Loot Selection**
```json
{
  "action": "select_loot_0|select_loot_1|select_loot_2",
  "dungeonType": 1,  // Only for regular dungeons  
  "actionToken": "from_previous_response"
}
```

---

## 🔍 **Endpoint Testing**

### Direct Testing Examples:
```bash
# Test public endpoint
curl "https://gigaverse.io/api/account/YOUR_ADDRESS"

# Test authenticated endpoint  
curl -H "Authorization: Bearer YOUR_JWT" \
     "https://gigaverse.io/api/user/me"

# Test game action
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT" \
     -H "Content-Type: application/json" \
     -d '{"action":"start_run","dungeonType":1,"data":{...}}' \
     "https://gigaverse.io/api/game/dungeon/action"
```

---

## 📚 **Future Development Opportunities**

### 🎯 **High Priority** (Confirmed Working)
- **User profile management** (`/user/me` endpoints)
- **Dungeon history & statistics** (`/game/dungeon/history`, `/game/dungeon/stats`)
- **Leaderboards** (`/game/dungeon/leaderboard`, `/game/underhaul/leaderboard`)
- **Import/Export functionality** (`/importexport/*`)

### 🔧 **Medium Priority** (Need Method Testing)
- **Authentication system** (`/auth/*` endpoints)
- **Gear management** (`/gear/equip`, `/gear/unequip`)
- **Battle system** (`/battle/start`, `/combat/action`)
- **Direct dungeon control** (`/dungeon/action`, `/underhaul/action`)

### 📊 **Low Priority** (Exploration)
- **GraphQL interface** (`/graphql`)  
- **Advanced analytics** (`/analytics/track`)
- **User settings** (`/user/settings`)

---

## ⚠️ **Known Issues**

1. **`/user/auth` returns 500** - Server error, needs investigation
2. **Many 405 errors** - Endpoints exist but need correct HTTP methods
3. **No versioning found** - API doesn't use `/v1/`, `/v2/` patterns
4. **No public documentation** - No `/docs`, `/swagger` endpoints found

---

## 🎯 **Next Steps for Development**

1. **Test 405 endpoints** with different HTTP methods (GET vs POST)
2. **Implement authentication flow** using `/auth/*` endpoints  
3. **Add dungeon history/stats** features using discovered endpoints
4. **Create leaderboard functionality** 
5. **Build gear management system**
6. **Explore GraphQL capabilities**

---

**This documentation provides a complete foundation for future Gigaverse API development and integration work.**