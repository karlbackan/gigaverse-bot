# 🐛 CRITICAL BUG FIX REPORT - October 11, 2025

## Problem: "Error handling action" causing stuck dungeons

### Symptoms
- Bot constantly receiving "Error handling action" errors
- Dungeons getting stuck after 3+ consecutive errors
- Required manual cancellation via web UI
- Multiple retry/fix attempts (9 previous commits) didn't solve it

### Root Cause Discovery

**Method:** Browser network capture comparison (Brave DevTools)

User provided 6 sequential working requests from the browser that **never fail**.
Comparison revealed critical API parameter mismatch.

## The Bug

### What the Browser Sends (WORKS):
```json
// Request 1: start_run
{
  "action": "start_run",
  "actionToken": "",
  "dungeonId": 3,  ← Uses actual dungeon type
  "data": {"isJuiced": true, ...}
}

// Request 2-6: All combat/loot actions
{
  "action": "rock/paper/scissor/loot_two",
  "actionToken": "1760191015682",
  "dungeonId": 0,  ← ALWAYS 0 after start_run!
  "data": {"isJuiced": false, ...}
}
```

### What the Bot Was Sending (FAILS):
```javascript
// ALL actions (start_run AND combat/loot)
const payload = {
  action,
  dungeonType: dungeonType,  // = 3
  dungeonId: dungeonType,    // = 3 ❌ WRONG for combat/loot!
  data
};
```

## The Fix

**Location:** `src/direct-api.mjs`

### sendDirectAction() - Before:
```javascript
const payload = {
  action,
  dungeonType: dungeonType,
  dungeonId: dungeonType,  // ❌ Always used dungeonType
  data
};

if (currentActionToken) {
  payload.actionToken = currentActionToken;
}
```

### sendDirectAction() - After:
```javascript
const payload = {
  action,
  actionToken: currentActionToken || "",  // ✅ Always included
  dungeonId: action === 'start_run' ? dungeonType : 0,  // ✅ Conditional!
  data
};
```

### Key Changes:
1. **dungeonId parameter:**
   - `start_run`: Uses `dungeonType` (e.g., 3 for Underhaul)
   - All other actions: Uses `0` (rock, paper, scissor, loot_one, etc.)

2. **actionToken parameter:**
   - Always included in payload
   - Empty string `""` when no token exists
   - Matches browser behavior exactly

3. **Removed dungeonType:**
   - Browser doesn't send this parameter
   - API only needs dungeonId

4. **Applied to all code paths:**
   - Main sendDirectAction()
   - "Error handling action" retry logic
   - "Invalid action token" retry logic
   - sendDirectLootAction()
   - All loot retry paths

## Testing Recommendation

Run the bot with these fixes and monitor for:
- ✅ No more "Error handling action" errors
- ✅ Smooth dungeon progression without getting stuck
- ✅ Proper action token chaining
- ✅ Successful loot selection

## Browser Reference Data

**Complete working sequence captured:**

1. start_run → actionToken: 1760191015682
2. rock (token: 1760191015682) → actionToken: 1760191021856
3. rock (token: 1760191021856) → actionToken: 1760191025839
4. loot_two (token: 1760191025839) → actionToken: 1760191043639
5. scissor (token: 1760191043639) → actionToken: 1760191049227
6. rock (token: 1760191049227) → ...continues

All requests used `dungeonId: 0` except the initial `start_run` which used `dungeonId: 3`.

## Impact

This fix should **eliminate the root cause** of "Error handling action" errors that have been plaguing the bot. The cancel_run functionality (added earlier) provides a safety net, but this fix prevents the errors from happening in the first place.

## Commit

```
32b2ce0 CRITICAL FIX: Match browser's dungeonId parameter behavior to prevent errors
```

## Credits

Bug discovered through systematic browser network inspection (Brave DevTools) and payload comparison with bot implementation. User provided the critical working request sequences that revealed the mismatch.
