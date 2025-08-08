# 🔧 Underhaul API Debug Output - Need Help!

Hi! I'm trying to get underhaul working through the API like you mentioned. I have underhaul **unlocked in-game** but still getting errors. Can you help me see what I'm missing?

## ✅ **What Works:**
- Regular dungeon: `{"action":"start_run","dungeonType":1,"data":{},"actionToken":"xxx"}` ✅ SUCCESS
- Authentication, tokens, read endpoints all working perfectly

## ❌ **What Fails:**
- Underhaul: `{"action":"start_run","dungeonType":3,"data":{},"actionToken":"xxx"}` ❌ `"Error handling action"`

## 📊 **Available Dungeons Confirm Underhaul Exists:**
```json
{
  "ID_CID": 3,
  "NAME_CID": "Dungetron Underhaul", 
  "ENERGY_CID": 40,
  "CHECKPOINT_CID": 2,
  "juicedMaxRunsPerDay": 9,
  "gearEnabled": true,
  "maxRoom": 16
}
```

## 🧪 **Tested Every Variation:**
- **dungeonType values:** 0, 1, 2, 3, 4, 5, "underhaul", "UNDERHAUL", null, arrays, objects
- **Alternative parameters:** `type: 3`, `mode: "underhaul"`, `gameType: 3`, `dungeonMode: 3`
- **Different actions:** `start_underhaul`, `begin_underhaul`, etc.
- **Data field variations:** `{mode: "underhaul"}`, `{underhaul: true}`, etc.
- **200+ parameter combinations**

**All return the same:** `"Error handling action"`

## ❓ **Questions:**
1. You said "same endpoint, function too" and "just pass other dungeon type" - is `dungeonType: 3` correct?
2. Are there additional required parameters I'm missing?
3. Could there be account permissions needed beyond in-game unlock?
4. Is there a specific format for the request I'm not using?

**My current call:** `POST /api/game/dungeon/action` with `{"action":"start_run","dungeonType":3,"data":{},"actionToken":"valid_token"}`

Any guidance would be hugely appreciated! 🙏