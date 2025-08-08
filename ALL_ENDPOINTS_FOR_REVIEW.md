# 🚨 ALL DISCOVERED ENDPOINTS - FOR SAFETY REVIEW

## ⚠️ **CRITICAL: DO NOT TEST WITHOUT APPROVAL**

---

## 🟢 **SAFE READ-ONLY ENDPOINTS** (Should not affect game state)

### **Account/Info Endpoints**
```
GET /api/account/{address} - Account info
GET /api/user/gameaccount/{address} - Game account status  
GET /api/offchain/player/energy/{address} - Energy levels
GET /api/gear/instances/{address} - Gear inventory
GET /api/importexport/balances/{address} - Account balances
GET /api/indexer/player/gameitems/{address} - Game items
```

### **Admin Info Endpoints** 
```
GET /api/admin - Admin dashboard info
GET /api/admin/users - User list
GET /api/admin/stats - System statistics  
GET /api/admin/metrics - System metrics
GET /api/admin/logs - System logs
GET /api/admin/history - Admin history
GET /api/admin/leaderboard - Admin leaderboards
GET /api/admin/config - Admin configuration
```

### **Analytics Info Endpoints**
```
GET /api/analytics - Analytics dashboard
GET /api/analytics/stats - Analytics statistics
GET /api/analytics/history - Analytics history  
GET /api/analytics/leaderboard - Analytics leaderboards
GET /api/analytics/me - My analytics
GET /api/analytics/today - Today's analytics
```

### **Achievement Info Endpoints**
```
GET /api/achievement - Achievement dashboard
GET /api/achievement/list - All achievements
GET /api/achievement/me - My achievements
GET /api/achievement/stats - Achievement statistics
GET /api/achievement/history - Achievement history
GET /api/achievement/leaderboard - Achievement leaderboards  
GET /api/achievement/today - Today's achievements
```

### **Combat Info Endpoints** 
```
GET /api/combat - Combat dashboard
GET /api/combat/stats - Combat statistics
GET /api/combat/history - Combat history
GET /api/combat/leaderboard - Combat leaderboards
GET /api/combat/me - My combat data
GET /api/combat/today - Today's combat
```

### **Battle Info Endpoints**
```
GET /api/battle - Battle dashboard  
GET /api/battle/stats - Battle statistics
GET /api/battle/history - Battle history
GET /api/battle/leaderboard - Battle leaderboards
GET /api/battle/me - My battle data
GET /api/battle/today - Today's battles
```

### **Enemy Info Endpoints**
```
GET /api/enemy - Enemy dashboard
GET /api/enemy/list - Enemy list
GET /api/enemy/stats - Enemy statistics
GET /api/enemy/history - Enemy history
GET /api/enemy/me - My enemy data
```

### **Chat Info Endpoints** 
```
GET /api/chat - Chat dashboard
GET /api/chat/history - Chat history
GET /api/chat/me - My chat data
GET /api/chat/list - Chat list
GET /api/chat/stats - Chat statistics
```

### **Auth Info Endpoints**
```
GET /api/auth - Auth dashboard
GET /api/auth/me - My auth info
GET /api/auth/settings - Auth settings  
GET /api/auth/history - Auth history
GET /api/auth/stats - Auth statistics
```

### **Config Info Endpoints**
```  
GET /api/config - Config dashboard
GET /api/config/list - Config list
GET /api/config/settings - Config settings
GET /api/config/me - My config
GET /api/config/stats - Config statistics
```

### **Dungeon Info Endpoints**
```
GET /api/dungeon - Dungeon dashboard
GET /api/dungeon/stats - Dungeon statistics  
GET /api/dungeon/history - Dungeon history
GET /api/dungeon/leaderboard - Dungeon leaderboards
GET /api/dungeon/me - My dungeon data
GET /api/dungeon/today - Today's dungeons
```

---

## 🟡 **MEDIUM RISK - MIGHT CHANGE STATE** (Proceed with caution)

### **Analytics Actions**
```  
POST /api/analytics/event - Track custom events
```

### **Search/Filter Endpoints**
```
GET /api/admin/search - Search admin data
GET /api/admin/filter - Filter admin data  
GET /api/analytics/search - Search analytics
GET /api/analytics/filter - Filter analytics
GET /api/achievement/search - Search achievements
GET /api/achievement/filter - Filter achievements
GET /api/combat/search - Search combat data
GET /api/combat/filter - Filter combat data
GET /api/battle/search - Search battles
GET /api/battle/filter - Filter battles  
GET /api/enemy/search - Search enemies
GET /api/enemy/filter - Filter enemies
GET /api/chat/search - Search chat
GET /api/chat/filter - Filter chat
GET /api/auth/search - Search auth data
GET /api/auth/filter - Filter auth data
GET /api/config/search - Search config
GET /api/config/filter - Filter config
GET /api/dungeon/search - Search dungeons
GET /api/dungeon/filter - Filter dungeons
```

---

## 🔴 **HIGH RISK - WILL CHANGE GAME STATE** (DO NOT TEST WITHOUT EXPLICIT APPROVAL)

### **Game Action Endpoints** ⚠️ **DANGEROUS - WILL USE ENERGY/AFFECT GEAR**
```
POST /api/game/dungeon/action - Dungeon actions (USES ENERGY!)
POST /api/game/underhaul/action - Underhaul actions (USES ENERGY!)  
POST /api/dungeon/action - Dungeon actions (USES ENERGY!)
POST /api/dungeon/start - Start dungeon (USES ENERGY!)
POST /api/dungeon/stop - Stop dungeon  
POST /api/dungeon/pause - Pause dungeon
POST /api/dungeon/resume - Resume dungeon  
POST /api/dungeon/submit - Submit dungeon results
```

### **Combat Action Endpoints** ⚠️ **DANGEROUS**
```
POST /api/combat/action - Combat actions
POST /api/combat/start - Start combat
POST /api/combat/stop - Stop combat
POST /api/combat/pause - Pause combat
POST /api/combat/resume - Resume combat
POST /api/combat/submit - Submit combat
POST /api/combat/accept - Accept combat
POST /api/combat/reject - Reject combat
POST /api/combat/cancel - Cancel combat
```

### **Battle Action Endpoints** ⚠️ **DANGEROUS** 
```
POST /api/battle/action - Battle actions
POST /api/battle/start - Start battle
POST /api/battle/stop - Stop battle  
POST /api/battle/pause - Pause battle
POST /api/battle/resume - Resume battle
POST /api/battle/submit - Submit battle
POST /api/battle/accept - Accept battle
POST /api/battle/reject - Reject battle
POST /api/battle/cancel - Cancel battle
```

### **Enemy Action Endpoints** ⚠️ **DANGEROUS**
```
POST /api/enemy/action - Enemy actions
POST /api/enemy/accept - Accept enemy
POST /api/enemy/reject - Reject enemy
POST /api/enemy/cancel - Cancel enemy action
```

### **Creation/Modification Endpoints** ⚠️ **DANGEROUS - WILL MODIFY DATA**
```
POST /api/admin/create - Create admin data
PUT /api/admin/update - Update admin data  
DELETE /api/admin/delete - Delete admin data

POST /api/analytics/create - Create analytics
PUT /api/analytics/update - Update analytics
DELETE /api/analytics/delete - Delete analytics

POST /api/achievement/create - Create achievement
PUT /api/achievement/update - Update achievement  
DELETE /api/achievement/delete - Delete achievement

POST /api/combat/create - Create combat
PUT /api/combat/update - Update combat
DELETE /api/combat/delete - Delete combat

POST /api/battle/create - Create battle
PUT /api/battle/update - Update battle
DELETE /api/battle/delete - Delete battle

POST /api/enemy/create - Create enemy
PUT /api/enemy/update - Update enemy
DELETE /api/enemy/delete - Delete enemy

POST /api/chat/create - Create chat  
PUT /api/chat/update - Update chat
DELETE /api/chat/delete - Delete chat

POST /api/auth/create - Create auth
PUT /api/auth/update - Update auth
DELETE /api/auth/delete - Delete auth

POST /api/config/create - Create config
PUT /api/config/update - Update config
DELETE /api/config/delete - Delete config

POST /api/dungeon/create - Create dungeon
PUT /api/dungeon/update - Update dungeon
DELETE /api/dungeon/delete - Delete dungeon
```

### **Chat Actions**
```
POST /api/chat/action - Send chat messages
```

### **Auth Actions**  
```
POST /api/auth/action - Authentication actions
```

### **Config Actions**
```
POST /api/config/action - Configuration actions
```

---

## 🔴 **EXTREMELY HIGH RISK - BATCH/BULK OPERATIONS**

### **Batch Endpoints** ⚠️ **COULD TRIGGER MULTIPLE ACTIONS**
```
POST /api/batch - Batch operations (UNKNOWN SCOPE!)
POST /api/bulk - Bulk operations (UNKNOWN SCOPE!)  
POST /api/_batch - Batch operations (UNKNOWN SCOPE!)
POST /api/multi - Multi operations (UNKNOWN SCOPE!)
```

---

## 🔮 **UNKNOWN RISK - GRAPHQL ENDPOINTS**  

### **GraphQL Endpoints** ⚠️ **UNKNOWN QUERIES/MUTATIONS**
```
POST /api/graphql - GraphQL endpoint (UNKNOWN OPERATIONS!)
POST /api/gql - GraphQL endpoint (UNKNOWN OPERATIONS!)
POST /graphql - GraphQL endpoint (UNKNOWN OPERATIONS!)  
POST /gql - GraphQL endpoint (UNKNOWN OPERATIONS!)
POST /query - GraphQL endpoint (UNKNOWN OPERATIONS!)
```

---

## 📝 **MY TESTING PLAN** (Waiting for your approval)

### **Phase 1: Safe Read-Only Testing**
1. Test all GET endpoints for account info, stats, history
2. Document response formats and data available
3. **NO ACTION ENDPOINTS** 

### **Phase 2: Medium Risk Testing** (If approved)  
1. Test search/filter endpoints (read-only but might require params)
2. Test single analytics event tracking
3. **AVOID ALL ACTION ENDPOINTS**

### **Phase 3: High Risk Testing** (Only with explicit permission)
1. **WILL NOT TEST WITHOUT YOUR SPECIFIC APPROVAL FOR EACH ENDPOINT**

---

## ❓ **QUESTIONS FOR YOU:**

1. **Can I test the 🟢 GREEN (read-only) endpoints?** 
2. **Should I test 🟡 YELLOW (search/filter) endpoints?**
3. **Which specific HIGH RISK endpoints (if any) are you willing to let me test?**  
4. **Are there any endpoints you absolutely DO NOT want me to touch?**

**I will wait for your explicit approval before testing ANY endpoints with authentication.**