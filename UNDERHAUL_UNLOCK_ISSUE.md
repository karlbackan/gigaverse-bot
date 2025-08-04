# Dungetron Underhaul Unlock Issue

## The Problem

The bot is working correctly, but **Dungetron Underhaul is not unlocked** on your account.

### What's Happening:
1. ✅ Dungetron 5000 daily limit reached (12/12)
2. ✅ Bot correctly tries to switch to Underhaul
3. ❌ API rejects with error 400 - Underhaul not unlocked

### Why It's Failing:
- Dungetron Underhaul requires **checkpoint 2** to be unlocked first
- Your account hasn't reached this checkpoint yet
- The game API prevents starting Underhaul until you meet the requirements

## Solution

### Immediate Fix (Applied):
- Set `AUTO_SWITCH_UNDERHAUL=false` in `.env`
- This prevents the bot from trying to access Underhaul

### Long-term Fix:
1. Play more Dungetron 5000 manually or with the bot tomorrow
2. Reach checkpoint 2 (usually requires completing floor 2 multiple times)
3. Once Underhaul is unlocked, change `.env` to `AUTO_SWITCH_UNDERHAUL=true`

## Bot Status

**The bot code is working perfectly:**
- ✅ Statistics tracking works
- ✅ Decision making works
- ✅ Multi-account management works
- ✅ Daily limit detection works

The only issue is that Underhaul isn't available on your account yet.

## What to Do Now

Since you've hit the daily limit for Dungetron 5000:
1. Wait until tomorrow (daily reset)
2. The bot will automatically run Dungetron 5000 again
3. After more runs, you'll eventually unlock checkpoint 2
4. Then Underhaul will become available

No code changes needed - just need to progress further in the game!