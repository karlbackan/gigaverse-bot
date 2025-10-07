# API Investigation Results - No Assumptions

## Test Setup
- Tested all 5 accounts with fresh API calls
- Used Account 3 as primary test subject (per user request)
- Checked payload variations, timing, and token handling

## Key Findings

### 1. Normal API Flow (Account 1 & 5)
```
start_run WITHOUT token → "Error handling action" (provides token in response)
→ Use token from error → SUCCESS
→ Continue with returned tokens → SUCCESS
→ Rapid fire (no delay) → SUCCESS
```

**Conclusion**:
- "Error handling action" on first call is NORMAL behavior
- Server provides valid token in error response
- Timing/delays are NOT required - rapid requests work fine
- Bot code correctly extracts and uses tokens from error responses (direct-api.mjs:120-126)

### 2. Corrupted State (Accounts 2, 3, 4)
```
start_run WITHOUT token → "Error handling action" (provides token)
→ Use token from error → "Error handling action" again
→ Token is invalid, cannot recover
```

**Conclusion**:
- These accounts have **server-side session corruption**
- Cannot be fixed from API/client side
- Token from error response doesn't work
- Requires manual intervention

### 3. Payload Testing
All accounts tested with:
1. `data: {}` (empty)
2. `data: { consumables: [] }`
3. `data: { consumables: [], itemId: 0, index: 0 }`

**Result**: Payload structure doesn't matter - corrupted accounts fail with all payloads

### 4. Timing Analysis
- Rapid fire requests (0ms delay): Work fine on healthy accounts
- Account 1 completed 3 consecutive actions with no delays
- No "race condition" observed

**Conclusion**: Timing is NOT the issue

## Root Cause

**The corruption is SERVER-SIDE, not client-side:**

1. Server maintains dungeon session state with action tokens
2. Some server sessions become corrupted (unknown server bug)
3. Once corrupted, server provides tokens that it won't accept
4. API cannot fix corrupted server sessions
5. Manual browser play forces server to reset session state

## What the Bot IS Doing Correctly

- ✅ Extracting tokens from error responses (direct-api.mjs:120-126)
- ✅ Sending tokens with subsequent requests (direct-api.mjs:94-96)
- ✅ Converting tokens to strings (direct-api.mjs:98)
- ✅ Minimal payload structure (dungeon-player.mjs:236-253)

## Solution

**For corrupted accounts (2, 3, 4):**
1. User must manually play 1 turn in browser at https://gigaverse.io
2. This forces server to create fresh session state
3. Bot can then continue normally

**No code changes needed** - the bot is working correctly. The issue is server-side corruption that only manual browser play can fix.

## Test Evidence

See test scripts:
- `check-all-accounts.mjs` - Comprehensive analysis of all accounts
- `test-normal-flow.mjs` - Demonstrates working flow on Account 1
- `test-token-recovery.mjs` - Shows Account 3 corruption
- `test-account4-active.mjs` - Shows Account 4 active dungeon corruption

All tests confirm: bot code is correct, server sessions are corrupted.
