# ✅ Underhaul API Solution - WORKING

## 🎉 **SUCCESS! Underhaul API Confirmed Working**

After extensive reverse engineering, **underhaul is fully functional** through the API with the exact same structure as regular dungeons.

---

## 🚀 **Working Implementation**

### **Endpoint:**
```
POST https://gigaverse.io/api/game/dungeon/action
```

### **Payload:**
```json
{
  "action": "start_run",
  "dungeonId": 3,
  "data": {},
  "actionToken": "your_action_token"
}
```

### **⚠️ CRITICAL FIX:**
**The API uses `dungeonId`, NOT `dungeonType`!**  
- ❌ `dungeonType: 3` → starts Dungetron 5000 (ID_CID: 1)
- ✅ `dungeonId: 3` → starts Dungetron Underhaul (ID_CID: 3)

### **Requirements:**
1. ✅ **Account must have underhaul unlocked in-game**
2. ✅ **No active dungeon running** (critical requirement)
3. ✅ **Sufficient energy** (40 energy required)
4. ✅ **Valid action token**

---

## 📊 **Dungeon Types Confirmed**

| Type | Name | Energy | Max Rooms |
|------|------|--------|-----------|
| 1 | Dungetron 5000 | 40 | 16 |
| 2 | Gigus Dungeon | 200 | 16 |
| **3** | **Dungetron Underhaul** | **40** | **16** |
| 4 | Dungetron Void | 20 | 9 |

---

## 🔍 **Key Discovery: The Blocking Issue**

### **❌ What Was Blocking Underhaul:**
- **Active dungeon state** - accounts with running dungeons cannot start new ones
- NOT server-side blocks, validation issues, or missing parameters

### **✅ Solution:**
- Test/use accounts with **clean dungeon state** (no active runs)
- Same exact payload structure as regular dungeons
- Only difference: `dungeonId: 1` → `dungeonId: 3`

---

## 🧪 **Testing Results**

### **Account Status Test:**
```javascript
// Account 1: ❌ Had active dungeon (blocked all new runs)
// Account 2: ✅ Clean state - underhaul worked immediately

const payload = {
  action: 'start_run',
  dungeonId: 3,  // ← CRITICAL: Use dungeonId, not dungeonType!
  data: {},
  actionToken: actionToken
};

// Result: ✅ SUCCESS - "Dungeon run started"
```

### **Response Confirmation:**
- Message: `"Dungeon run started"`
- Dungeon ID assigned (e.g., 13147517)
- Player and enemy stats loaded
- Action token updated for next action

---

## 🛠 **Implementation for Bots**

### **Bot Code Integration:**
```javascript
// In sendDirectAction function - FIXED to use dungeonId!
const dungeonType = config.dungeonType; // 1 = Regular, 3 = Underhaul

const payload = {
  action: 'start_run',
  dungeonId: dungeonType,  // API uses dungeonId, not dungeonType
  data: {},
  actionToken: currentActionToken
};
```

### **⚠️ CRITICAL UPDATE:**
Bot code has been updated in `src/direct-api.mjs`:
- Line 43: `dungeonId: dungeonType` (was `dungeonType`)
- Line 343: `dungeonId: dungeonType` (was `dungeonType`)
- All retry logic updated to use `dungeonId`

### **Configuration:**
```javascript
// In config.mjs
dungeonType: process.env.DUNGEON_TYPE === 'UNDERHAUL' ? 3 : 1
```

### **Environment Variable:**
```bash
DUNGEON_TYPE=UNDERHAUL  # For underhaul mode
# or leave unset for regular Dungetron 5000
```

---

## 💡 **Key Insights**

1. **Same API Architecture:** Underhaul uses identical request/response structure
2. **CRITICAL Parameter Discovery:** API uses `dungeonId`, not `dungeonType`!
3. **Parameter Mapping:** `dungeonType: 3` → starts wrong dungeon (ID_CID: 1)
4. **Correct Usage:** `dungeonId: 3` → starts Underhaul (ID_CID: 3)
5. **Account State Critical:** Must not have active dungeon
6. **Energy Management:** 40 energy per run (same as regular)
7. **Authentication:** Same JWT token system

---

## 🎯 **Next Steps**

1. ✅ **Update bot configuration** to support both dungeon types
2. ✅ **Add dungeon state checking** before starting new runs  
3. ✅ **Test account rotation** for clean states
4. ✅ **Monitor underhaul-specific mechanics** (checkpoint system, etc.)

---

## 🔧 **Troubleshooting**

### **"Error handling action" Response:**
- ❌ Account has active dungeon
- ✅ **Solution:** Complete current dungeon or use different account

### **"Invalid action token" Response:**
- ❌ Token expired or incorrect
- ✅ **Solution:** Get fresh action token

### **Account Requirements:**
- ❌ Underhaul not unlocked in-game
- ✅ **Solution:** Unlock through normal gameplay first

---

---

## 🚀 **BREAKTHROUGH DISCOVERY**

### **Parameter Name Issue:**
After extensive testing showing `dungeonType: 3` was starting the wrong dungeon (Dungetron 5000 instead of Underhaul), the root cause was discovered:

**❌ WRONG:** `dungeonType: 3`  
**✅ CORRECT:** `dungeonId: 3`

### **API Response Analysis:**
```json
// dungeonType: 3 response (WRONG)
{
  "data": {
    "entity": { "ID_CID": "1" },  // ← Dungetron 5000!
    "run": { "DUNGEON_ID_CID": "1" }
  }
}

// dungeonId: 3 response (CORRECT)  
{
  "data": {
    "entity": { "ID_CID": "3" },  // ← Dungetron Underhaul!
    "run": { "DUNGEON_ID_CID": "3" }
  }
}
```

### **Fix Applied:**
✅ Bot code updated in `src/direct-api.mjs`  
✅ All API calls now use `dungeonId` instead of `dungeonType`  
✅ Documentation corrected to reflect actual API behavior

---

**Status:** ✅ **FULLY OPERATIONAL WITH CORRECT PARAMETER**  
**Discovery:** 🎯 **dungeonId is the correct API parameter**  
**Integration:** ✅ **Bot updated and ready for Underhaul mode**