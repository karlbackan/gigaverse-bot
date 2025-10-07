# Underhaul Changes Timeline

## Key Changes to Underhaul Handling Throughout Git History

### 1. **Initial Implementation (July-August 2025)**
- **b4a0aec**: Add automatic Underhaul fallback when daily limits reached
- **80f6460, 4cae9b7**: Improve Underhaul error handling and configuration
- **a8119b8**: Improve Underhaul unlock error handling
- **1650a3b**: Implement separate statistics tracking for Dungetron and Underhaul dungeons
- **593ba6b**: Make Underhaul the primary dungeon mode
- **50375f3**: Add fallback mechanism when Underhaul is not accessible

### 2. **Gear Implementation Phase (August 5, 2025)**
- **42f7857**: Implement proper charge recharging mechanics for Underhaul
- **b914416**: Fix Underhaul API - Remove forced `isJuiced:true` parameter
- **20ed05b**: **CRITICAL CHANGE** - Pass equipped gear IDs when starting Underhaul dungeons
  - Added `direct-api-gear.mjs` module
  - Fetch gear IDs for type 3 dungeons
  - Pass `gearInstanceIds` array in start_run

### 3. **API Discovery Phase (August 2025)**
- **f695923**: Fix critical bug - Update statistics engine when falling back
- **f510fa7**: Add comprehensive Underhaul API investigation findings
- **f715036**: Fix dungeon type confusion and clear corrupted data
- **a294d0a**: Disable automatic fallback from dungeon 3 to dungeon 1
- **e2c4f85**: MAJOR DISCOVERY - Found correct API base URL through reverse engineering

### 4. **"Solved" Phase (August 8, 2025)**
- **02e2d1f**: Complete definitive Underhaul API endpoint discovery
- **9840d1c**: Implement correct Underhaul API endpoints for all actions
- **eef8226**: Update documentation for complete Underhaul implementation
- **19500e0**: Complete comprehensive Gigaverse API discovery
- **27cccfa**: Complete underhaul API reverse engineering with breakthrough findings
- **b6a4b46**: **"SOLVED"** - Underhaul API fully functional
  - Claimed same endpoint works: `/api/game/dungeon/action`
  - Same payload structure as regular dungeons
  - Only requirement: Clean dungeon state

### 5. **Breakthrough Phase (August 2025)**
- **4997691**: BREAKTHROUGH - Fix Underhaul API parameter - use dungeonId not dungeonType
- **91f63e0**: COMPATIBILITY - Send both dungeonType AND dungeonId parameters
- **cbf09b1**: FINAL DOCUMENTATION - Underhaul API confirmed working on Account 1

### 6. **Major Revision (August 2025)**
- **1848bc4**: MAJOR BOT REVISION - Auto-Switch Strategy + Unified API Implementation
  - Removed separate Underhaul endpoints
  - Unified everything to use `sendDirectAction`

### 7. **Corruption Fixes Phase (August-September 2025)**
- **daa1d5e**: Clean - Remove contaminated enemy data from Underhaul statistics
- **4612c96**: Fix - Derive room number from enemy ID instead of trusting API room field
- **78f2cd1**: Fix - Allow dungeon switching when progress data is missing
- **105a375**: FALLBACK FIXES - Fix action token sync and dungeon state detection
  - Re-enabled fallback to Dungetron 5000
  - Added dungeon state checking before fallback

### 8. **Root Cause Analysis (September 1, 2025)**
- **8ddbf1d**: **DIAGNOSIS - Found root cause of dungeon corruption**
  - ROOT CAUSE: Race condition from rapid-fire API requests
  - Server processes requests out of order
  - Token desynchronization occurs
  - Underhaul more affected due to gear calculations (slower)
  - **CONFIRMED FIX**: 2-3 second delays between actions

## Critical Differences Between Versions

### What Changed from "SOLVED" to Current:

1. **Action Data Structure**:
   - **BEFORE**: Full payload with all fields
   ```javascript
   {
     consumables: [],
     itemId: 0,
     index: 0,
     isJuiced: false,
     gearInstanceIds: []
   }
   ```
   - **CURRENT**: Minimal payload
   ```javascript
   {}  // Empty object for actions
   ```

2. **Gear Handling**:
   - **BEFORE**: Always passed empty `gearInstanceIds: []`
   - **MIDDLE**: Fetched and passed actual gear IDs for Underhaul
   - **CURRENT**: Still fetches gear but doesn't pass in action data

3. **API Endpoints**:
   - **EARLY**: Separate `sendUnderhaulAction` functions
   - **SOLVED**: Unified to single `sendDirectAction`
   - **CURRENT**: Still unified but with corruption issues

4. **Timing**:
   - **BEFORE**: No delays between actions
   - **DIAGNOSIS**: Identified race condition from rapid requests
   - **ATTEMPTED FIX**: Added 2-second delays (but removed later)

5. **Token Management**:
   - **EARLY**: Token passed in every request
   - **CURRENT**: Token corruption causing "Error handling action"

## Key Findings

1. **The "SOLVED" commit (b6a4b46) claimed it worked** but may have only worked in specific conditions (clean session state)

2. **Gear IDs were added (20ed05b)** as a critical requirement but later simplified to empty object

3. **Race condition identified (8ddbf1d)** as root cause - Underhaul slower due to gear calculations

4. **Current implementation removes delays** that were identified as the fix

## Recommended Configuration to Try

Based on the history, the most stable configuration appears to be:

1. **Add back the 2-3 second delays** between actions (from commit 8ddbf1d)
2. **Use minimal action data** (current approach is correct)
3. **Don't pass gear IDs in actions** (they complicate server processing)
4. **Reset token on new dungeon start** (current implementation does this)
5. **Allow fallback to Dungetron 5000** when Underhaul corrupts

The key insight is that **manual play works because humans are slower** - the 2-3 second delay mimics human timing and prevents the race condition.