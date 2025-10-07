# Critical Bugs Fixed in direct-api.mjs

## Date: 2025-10-07

## Summary
Fixed three critical bugs that caused account corruption and infinite retry loops:
1. **Shared token bug** - All accounts used same token
2. **No retry logic** - Bot gave up when server provided updated tokens
3. **Shared error counter** - Error counter was global, not per-account

---

## Bug 1: Shared Token Variable (CRITICAL)

### Problem
```javascript
// OLD CODE - BROKEN:
let currentActionToken = null;  // Global variable shared by ALL accounts!
```

**Impact:**
- When Account 1 played and got token `1759832219143`, that token was stored globally
- When Account 2 tried to play, it used Account 1's token
- Server rejected it → corruption
- When graceful shutdown tried to retreat all accounts, it used same token for all
- **Result: All 5 accounts corrupted during graceful shutdown**

### Fix Applied
```javascript
// NEW CODE - FIXED:
const accountTokens = new Map();  // Per-account token storage

function getCurrentToken(accountAddress) {
  return accountTokens.get(accountAddress) || null;
}

function setCurrentToken(accountAddress, token) {
  accountTokens.set(accountAddress, token);
}
```

**Changes:**
- `src/direct-api.mjs:6` - Created `accountTokens` Map
- `src/direct-api.mjs:13-20` - Added helper functions
- `src/direct-api.mjs:96` - Modified `sendDirectAction()` to accept account address
- `src/direct-api.mjs:114-116` - Use per-account token: `getCurrentToken(accountAddress)`
- `src/direct-api.mjs:126` - Save per-account token: `setCurrentToken(accountAddress, newToken)`
- `src/direct-api.mjs:221-239` - Fixed `getDirectDungeonState()` to use per-account tokens
- `src/direct-api.mjs:292-382` - Fixed `sendDirectLootAction()` to use per-account tokens

---

## Bug 2: No Retry Logic

### Problem
```javascript
// OLD CODE - Bot had the function but NEVER used it:
// token-persistence.mjs exports extractTokenFromError()
// But direct-api.mjs never imported or called it!

// When error occurred:
if (error.response?.data?.message?.includes('Invalid action token')) {
  console.log('Token error - giving up...');  // Just logged and gave up!
  throw error;
}
```

**Impact:**
- Server provides expected token in error: `Invalid action token undefined != 1759832047633`
- Bot logged the error but didn't extract the token
- Bot gave up instead of retrying with correct token
- User had to manually fix every time

### Fix Applied
```javascript
// NEW CODE - FIXED:
import { extractTokenFromError } from './token-persistence.mjs';

export async function sendDirectAction(action, dungeonType, data = {}, retryCount = 0) {
  const MAX_RETRIES = 2;

  try {
    // ... send action ...
  } catch (error) {
    // Method 1: Token in error response data
    let updatedToken = null;
    if (error.response?.data?.actionToken) {
      updatedToken = error.response.data.actionToken.toString();
    }

    // Method 2: Extract from "Invalid action token X != Y" error message
    if (!updatedToken && message?.includes('Invalid action token')) {
      updatedToken = extractTokenFromError(message);
    }

    // RETRY with updated token (up to 2 times)
    if (updatedToken && retryCount < MAX_RETRIES) {
      setCurrentToken(accountAddress, updatedToken);
      return sendDirectAction(action, dungeonType, data, retryCount + 1);
    }
  }
}
```

**Changes:**
- `src/direct-api.mjs:3` - Import `extractTokenFromError()`
- `src/direct-api.mjs:95` - Added `retryCount = 0` parameter
- `src/direct-api.mjs:97` - Added `MAX_RETRIES = 2` constant
- `src/direct-api.mjs:162-188` - Extract updated token from error response OR error message
- `src/direct-api.mjs:179-188` - Automatically retry with updated token
- `src/direct-api.mjs:292` - Same fix applied to `sendDirectLootAction()`

**Example:**
```
First attempt: action with token undefined
  ❌ Invalid action token undefined != 1759832047633
  🔧 Extracted expected token: 1759832047633
  🔄 Retry 1/2 with updated token: undefined → 1759832047633

Second attempt: action with token 1759832047633
  ✅ Success!
```

---

## Bug 3: Shared Error Counter

### Problem
```javascript
// OLD CODE - BROKEN:
let consecutiveErrorHandlingCount = 0;  // Global counter!

// When Account 2 had error:
consecutiveErrorHandlingCount++;  // Increments to 1

// When Account 3 had error:
consecutiveErrorHandlingCount++;  // Increments to 2

// When Account 4 had error:
consecutiveErrorHandlingCount++;  // Increments to 3

// ... continues for all accounts until it hits 11
```

**Impact:**
- User logs showed: "Consecutive errors: 11" (should stop at 3)
- Counter was shared across ALL accounts
- Bot kept retrying past the 3-error limit
- Infinite loop on corrupted accounts

### Fix Applied
```javascript
// NEW CODE - FIXED:
const accountErrorCounts = new Map();  // Per-account error tracking
const MAX_ERROR_HANDLING_RETRIES = 3;

function getErrorCount(accountAddress) {
  return accountErrorCounts.get(accountAddress) || 0;
}

function incrementErrorCount(accountAddress) {
  const count = getErrorCount(accountAddress) + 1;
  accountErrorCounts.set(accountAddress, count);
  return count;
}

function resetErrorCount(accountAddress) {
  accountErrorCounts.set(accountAddress, 0);
}

// In sendDirectAction():
if (message === 'Error handling action') {
  const errorCount = incrementErrorCount(accountAddress);
  console.log(`  ⚠️  Session sync lost with server (${errorCount}/${MAX_ERROR_HANDLING_RETRIES} for this account)`);

  if (errorCount >= MAX_ERROR_HANDLING_RETRIES) {
    // Stop after 3 attempts for THIS account
    const corruptionError = new Error('ACCOUNT_CORRUPTED');
    corruptionError.isCorruption = true;
    corruptionError.accountAddress = accountAddress;
    throw corruptionError;
  }
}
```

**Changes:**
- `src/direct-api.mjs:8-10` - Created `accountErrorCounts` Map and `MAX_ERROR_HANDLING_RETRIES`
- `src/direct-api.mjs:22-37` - Added per-account error tracking functions
- `src/direct-api.mjs:133` - Reset error count on success: `resetErrorCount(accountAddress)`
- `src/direct-api.mjs:192` - Use per-account error count: `incrementErrorCount(accountAddress)`
- `src/direct-api.mjs:195` - Check per-account limit: `errorCount >= MAX_ERROR_HANDLING_RETRIES`

---

## What This Fixes

### Before:
1. ❌ All accounts shared same token → cross-contamination
2. ❌ Bot gave up on first error with valid token in response
3. ❌ Error counter shared → infinite loops
4. ❌ Graceful shutdown corrupted all accounts

### After:
1. ✅ Each account has its own token → no cross-contamination
2. ✅ Bot automatically retries with updated token (up to 2 times)
3. ✅ Each account tracks its own error count → stops at 3 per account
4. ✅ Should handle restarts gracefully (needs testing on clean account)

---

## What Still Needs Manual Fix

**Accounts 2, 3, 4 are already corrupted at server level:**
- These accounts need one-time manual intervention
- Play 1 turn in browser at https://gigaverse.io
- After manual fix, bot should prevent future corruption

**To test if fixes work:**
1. User manually fixes one corrupted account (e.g., Account 2)
2. Run bot with fixed account
3. Verify:
   - No "consecutive errors: 11" messages
   - Bot auto-recovers from "Invalid action token" errors
   - Each account maintains separate state

---

## Technical Details

### Token Lifecycle (Fixed)
```
Account 1:
  start_run → token: null
  ← Server: token 1000001
  rock → token: 1000001
  ← Server: token 1000002

Account 2:
  start_run → token: null  (NOT Account 1's token!)
  ← Server: token 2000001
  paper → token: 2000001
  ← Server: token 2000002
```

### Retry Logic (New)
```
Attempt 1: Send action with token X
  ↓
  Error: "Invalid action token X != Y"
  ↓
  Extract Y from error message
  ↓
Attempt 2: Send action with token Y
  ↓
  Success!
```

### Error Counter (Fixed)
```
Account 1: Error 1/3 → continue
Account 1: Error 2/3 → continue
Account 1: Error 3/3 → STOP (corrupted)

Account 2: Error 1/3 → continue (independent counter)
Account 2: Success → reset to 0/3
```

---

## Files Modified
- `src/direct-api.mjs` - All three bugs fixed
  - Lines 3: Added import
  - Lines 5-37: Per-account token and error tracking
  - Lines 95-218: Fixed `sendDirectAction()`
  - Lines 221-239: Fixed `getDirectDungeonState()`
  - Lines 292-382: Fixed `sendDirectLootAction()`

## Testing Required
- ⏳ Pending: Test on clean account after user manually fixes one account
- ⏳ Pending: Verify no cross-contamination between accounts
- ⏳ Pending: Verify error counter stops at 3 per account
- ⏳ Pending: Verify automatic retry with updated tokens works
