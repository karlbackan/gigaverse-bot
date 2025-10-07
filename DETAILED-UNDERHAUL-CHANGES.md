# Detailed Underhaul Changes Analysis

## Complete Change History (What Actually Changed)

### Early Implementation (Working State?)
**Commit 50375f3** - Add fallback mechanism
```javascript
// Simple error handling with automatic fallback
if (error.response?.status === 400 && 
    error.response?.data?.message === 'Error handling action' &&
    this.currentDungeonType === 3) {
  // Automatically fall back to Dungetron 5000
  this.currentDungeonType = 1;
  return await this.startDungeon();
}
```
**Key Features:**
- Simple payload: `{isJuiced: true/false, consumables: [], itemId: 0, index: 0, gearInstanceIds: []}`
- Automatic fallback to Dungetron 5000
- No gear fetching
- No token management complexity

### Breaking Changes Started Here

**Commit b914416** - Remove forced isJuiced
```javascript
// Changed from:
isJuiced: this.currentDungeonType === 3 ? true : (config.isJuiced || false)
// To:
isJuiced: config.isJuiced || false  // Same for both dungeons
```

**Commit 20ed05b** - **ADDED GEAR IDS** (Potential Problem Source)
```javascript
// Added gear fetching:
if (this.currentDungeonType === 3) {
  gearInstanceIds = await getEquippedGearIds();
  console.log(`Found ${gearInstanceIds.length} equipped gear items`);
}
// Passes gear IDs in payload
data.gearInstanceIds = gearInstanceIds;
```

**Commit a294d0a** - **DISABLED FALLBACK** (Made things worse)
```javascript
// REMOVED automatic fallback:
console.log('❌ Underhaul start failed. NOT falling back to Dungetron 5000.');
console.log('To start Underhaul, you must do it manually in the browser.');
return false; // Just fail instead of fallback
```

**Commit b6a4b46** - Claimed "SOLVED" but issues persist
- Unified API approach
- Claimed same endpoint works for everything
- But server still returns "Error handling action"

### Current State Problems

**Current code has:**
1. Gear ID fetching and passing (adds complexity)
2. No delays between actions (identified as fix but never added)
3. Complex retry logic with token management
4. Disabled fallback in some paths

## Good Candidate Configurations to Try

### Configuration 1: Revert to Early Simple State
Based on **commit 50375f3** (before gear complexity):
```javascript
// Simple payload without gear
const data = {
  isJuiced: false,  // Don't send isJuiced at all
  consumables: [],
  itemId: 0,
  index: 0,
  gearInstanceIds: []  // Always empty
};

// Simple error handling with fallback
if (error.response?.data?.message === 'Error handling action') {
  this.currentDungeonType = 1;
  return await this.startDungeon();
}
```

### Configuration 2: Minimal Payload (Current style but simpler)
```javascript
// Ultra-minimal - send nothing
const data = {};
await sendDirectAction('start_run', 3, data);
```

### Configuration 3: Add Delays (Never implemented fix)
```javascript
// Add 2-3 second delay before EVERY action
await sleep(2000);
const response = await sendDirectAction(action, this.currentDungeonType, {});
```

### Configuration 4: No Gear IDs Ever
```javascript
// Remove all gear fetching code
// Always pass empty gearInstanceIds or omit entirely
const data = {
  consumables: [],
  itemId: 0, 
  index: 0
  // NO gearInstanceIds field at all
};
```

### Configuration 5: Force Token Reset on Every Action
```javascript
// Before EVERY action:
resetActionToken();
await sleep(1000);
// Then send action
```

## The Real Problem Pattern

Looking at all changes, the corruption got worse when:
1. **Gear IDs were added** (20ed05b) - Server takes longer to process
2. **Fallback was disabled** (a294d0a) - Can't recover from corruption
3. **Complex retry logic added** - Makes corruption cascade worse
4. **No delays between actions** - Race condition happens

## Most Promising Fix Combination

Based on the analysis, try this:
1. **Remove gear ID fetching entirely** (revert 20ed05b changes)
2. **Add 2-3 second delays** (implement 8ddbf1d fix)
3. **Re-enable automatic fallback** (revert a294d0a)
4. **Use minimal payloads** (empty object {})
5. **Stop on first error** (no retries)

## Testing Order

1. First: Try removing gear IDs completely
2. Second: Add delays if still corrupting
3. Third: Revert to commit 50375f3 code structure
4. Fourth: Try ultra-minimal payload {}
5. Fifth: Force clean token state on every action