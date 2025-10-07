# Corruption Fix & Prevention Plan

## Root Cause Analysis

### What We Found:
1. **Accounts 2, 3, 4 are corrupted** - cannot be fixed via API
2. **Account 1 & 5 work perfectly** - same bot code, different account state
3. **Corruption is server-side** - server session stuck in invalid state
4. **No API endpoint can clear it** - tested all possible methods

### Why Current Accounts Are Corrupted:
- Server maintains session state with specific action tokens
- When bot crashes/stops mid-dungeon, server session remains active
- Bot loses sync with server's token
- Server enters deadlock: provides tokens that it won't accept
- Token chain is broken - every new token provided also fails

### Why Account 1 Works:
```
start_run without token → "Error handling action" (provides token)
→ Use token from error → SUCCESS
```

Server provides fresh valid token in error response, bot uses it = success.

## Prevention Strategy

### Core Principle:
**Never save/restore action tokens - they expire too quickly and cause corruption**

### Implementation:

1. **Remove Token Persistence** (ALREADY DONE)
   - Bot does NOT use saveActionToken/loadActionToken
   - This is correct - tokens expire in seconds

2. **Session State Recovery** (NEEDS IMPLEMENTATION)
   - When bot detects active dungeon on server:
     - DO NOT try to use saved tokens
     - Send action without token
     - Get fresh token from error response
     - Use that token to continue OR retreat

3. **Corruption Detection** (NEEDS IMPLEMENTATION)
   - If "Error handling action" persists after token recovery attempt:
     - Mark account as corrupted
     - Log clear message: "Account needs manual browser play"
     - Skip account until manually fixed
     - DO NOT keep retrying (causes more corruption)

4. **Graceful Shutdown** (NEEDS IMPLEMENTATION)
   - On bot shutdown signal (SIGINT/SIGTERM):
     - Finish current turn
     - Retreat from active dungeons
     - Clear session state
   - Prevents leaving dungeons in stuck state

5. **Session State Cleanup** (NEEDS IMPLEMENTATION)
   - Clear session-state.json for account when:
     - Dungeon completes successfully
     - Retreat succeeds
     - Corruption detected
   - Prevents bot from trying to resume old sessions

## Implementation Steps:

### Step 1: Add Corruption Detection
In `direct-api.mjs`, track consecutive "Error handling action" errors:
- If same error 3+ times in a row → account is corrupted
- Return special error code
- Calling code should skip this account

### Step 2: Implement Token Recovery
In `dungeon-player.mjs` `canPlay()` method:
```javascript
if (server has active dungeon) {
  // Try to get fresh token
  try action without token
  if "Error handling action":
    token = error.response.actionToken
    try again with token
    if still fails:
      return 'corrupted_account'
}
```

### Step 3: Clear Session State on Corruption
When corruption detected:
```javascript
clearSessionState(accountAddress)
clearActionToken(accountAddress)
```

### Step 4: Graceful Shutdown
Add signal handlers:
```javascript
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  // Retreat from active dungeons
  await player.safeShutdown();
  process.exit(0);
});
```

## Testing Plan:

1. **After user manually fixes Accounts 2, 3, 4:**
   - Run bot on all accounts
   - Verify no corruption
   - Stop bot mid-dungeon
   - Restart bot
   - Verify it recovers correctly

2. **Stress Test:**
   - Run bot
   - Kill process (SIGKILL) mid-dungeon
   - Restart
   - Should recover without corruption

3. **Long-term Monitoring:**
   - Run bot for 24 hours
   - Check for any new corruption
   - Verify graceful recovery from crashes

## Current Status:

✅ Analyzed corruption via API testing
✅ Confirmed no API fix available for current corruption
✅ Identified prevention strategy
⏳ User will manually fix Accounts 2, 3, 4 (one time)
⏳ Implement prevention measures (in progress)
⏳ Test solution

## Files to Modify:

1. `src/direct-api.mjs` - Add corruption detection
2. `src/dungeon-player.mjs` - Add token recovery & graceful shutdown
3. `src/session-persistence.mjs` - Ensure proper cleanup
4. `menu.mjs` or main entry - Add signal handlers
