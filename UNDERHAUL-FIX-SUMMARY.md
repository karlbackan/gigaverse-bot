# Underhaul Fix Summary

## Critical Finding

**The fix was identified but NEVER implemented!**

### What the Investigation Found:

1. **Root Cause (Commit 8ddbf1d)**:
   - Race condition from rapid-fire API requests
   - Server processes requests out of order  
   - Token desynchronization occurs
   - Underhaul more affected because:
     - Has gear calculations (slower server processing)
     - More complex weapon recharge mechanics
     - Longer processing time = higher chance of out-of-order execution

2. **The Fix That Was Identified**:
   - **2-3 second delays between actions** (prevents race condition)
   - Minimal payloads reduce processing time
   - Stop on errors instead of retry (prevents cascade)
   - Manual play fixes it because **human timing is slower**

3. **The Problem**:
   - The fix was documented but **NEVER ADDED TO THE CODE**
   - Current code has NO delays between actions
   - That's why corruption still happens

## Key Timeline of Changes:

### What Actually Happened:

1. **Early commits**: Added gear IDs, complex payloads
2. **"SOLVED" commit (b6a4b46)**: Claimed it worked (but only in clean state)
3. **Diagnosis commit (8ddbf1d)**: Found the root cause and solution
4. **Current state**: Solution never implemented!

### Current Code Issues:

1. **No delays between actions** (the main fix)
2. Still trying token recovery (which doesn't work for race conditions)
3. Complex retry logic that makes corruption worse

## The Working Configuration:

Based on all commits, the configuration that SHOULD work:

```javascript
// In dungeon-player.mjs playTurn() method:

// BEFORE sending action
await sleep(2000); // 2-3 second delay prevents race condition

// Send action with minimal data
const actionData = {}; // Don't send gear IDs or complex data
response = await sendDirectAction(action, this.currentDungeonType, actionData);

// DON'T retry on "Error handling action" - just stop
// The corruption has already happened, retrying makes it worse
```

## Why Manual Play Works:

- Humans naturally have 2-3 seconds between clicks
- This delay allows server to process each action fully
- No race condition = no corruption

## Why Dungetron 5000 Works Better:

- No gear calculations
- Simpler server processing
- Faster response time
- Less chance of race condition even without delays

## Immediate Fix Needed:

**Add 2-3 second delays between ALL dungeon actions** as identified in the diagnosis but never implemented.