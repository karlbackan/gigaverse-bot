# 🧪 Endpoint Testing Guide - 200+ Discovered Endpoints

> **Purpose:** Systematic testing approach for the 200+ newly discovered Gigaverse API endpoints  
> **Status:** Ready for authenticated testing with JWT tokens

---

## 🎯 **Testing Strategy**

### **Key Discovery Insight**
- **405 Method Not Allowed** responses indicate endpoints exist but need correct HTTP method + authentication
- **204 OPTIONS** responses confirm endpoints are active and CORS-enabled
- **Pattern:** Most endpoints likely work with GET (read) and POST (action) when properly authenticated

---

## 🔧 **Quick Testing Script**

```javascript
#!/usr/bin/env node

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://gigaverse.io/api',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer YOUR_JWT_TOKEN_HERE`
  }
});

// Test endpoint with authentication
async function testEndpointAuth(path, methods = ['GET', 'POST']) {
  const results = [];
  
  for (const method of methods) {
    try {
      let response;
      if (method === 'GET') {
        response = await api.get(path);
      } else {
        response = await api.post(path, { test: true });
      }
      
      console.log(`✅ ${method} ${path} → ${response.status} SUCCESS`);
      results.push({ method, path, status: response.status, success: true });
      
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.response?.statusText;
      
      if (status === 200 || status === 201 || status === 204) {
        console.log(`✅ ${method} ${path} → ${status} SUCCESS`);
        results.push({ method, path, status, success: true });
      } else if (status === 401) {
        console.log(`🔒 ${method} ${path} → ${status} AUTH_NEEDED (token expired?)`);
        results.push({ method, path, status, needsAuth: true });
      } else if (status === 403) {
        console.log(`🚫 ${method} ${path} → ${status} FORBIDDEN (insufficient permissions)`);
        results.push({ method, path, status, forbidden: true });
      } else if (status === 405) {
        console.log(`🔄 ${method} ${path} → ${status} WRONG_METHOD (try different method)`);
        results.push({ method, path, status, wrongMethod: true });
      } else if (status === 400) {
        console.log(`⚠️  ${method} ${path} → ${status} BAD_REQUEST: ${message}`);
        results.push({ method, path, status, badRequest: true, message });
      } else {
        console.log(`❓ ${method} ${path} → ${status} ${message}`);
        results.push({ method, path, status, unknown: true, message });
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
  }
  
  return results;
}

// Test high-priority endpoint categories
async function testPriorityEndpoints() {
  const priorityEndpoints = [
    // Admin endpoints (highest value)
    '/admin', '/admin/users', '/admin/stats', '/admin/config',
    
    // Analytics endpoints
    '/analytics', '/analytics/stats', '/analytics/event',
    
    // Achievement endpoints  
    '/achievement', '/achievement/list', '/achievement/me',
    
    // Combat system
    '/combat', '/combat/state', '/combat/action', '/combat/history',
    
    // Battle system
    '/battle', '/battle/state', '/battle/action', '/battle/leaderboard',
    
    // Enemy system
    '/enemy', '/enemy/stats', '/enemy/list',
    
    // Chat system
    '/chat', '/chat/history', '/chat/me',
    
    // Auth system
    '/auth', '/auth/me', '/auth/settings',
    
    // Config system
    '/config', '/config/list', '/config/settings',
    
    // Dungeon alternatives
    '/dungeon', '/dungeon/state', '/dungeon/action', '/dungeon/today'
  ];
  
  console.log(`Testing ${priorityEndpoints.length} priority endpoints...`);
  
  const allResults = [];
  for (const endpoint of priorityEndpoints) {
    console.log(`\nTesting: ${endpoint}`);
    const results = await testEndpointAuth(endpoint);
    allResults.push(...results);
  }
  
  return allResults;
}

// Run the test
testPriorityEndpoints()
  .then(results => {
    console.log('\n📊 TESTING SUMMARY:');
    const working = results.filter(r => r.success);
    const authNeeded = results.filter(r => r.needsAuth);
    const forbidden = results.filter(r => r.forbidden);
    const wrongMethod = results.filter(r => r.wrongMethod);
    
    console.log(`✅ Working endpoints: ${working.length}`);
    console.log(`🔒 Auth needed: ${authNeeded.length}`);
    console.log(`🚫 Forbidden: ${forbidden.length}`);
    console.log(`🔄 Wrong method: ${wrongMethod.length}`);
    
    if (working.length > 0) {
      console.log('\n✅ WORKING ENDPOINTS:');
      working.forEach(r => console.log(`   ${r.method} ${r.path}`));
    }
  })
  .catch(console.error);
```

---

## 🏆 **Priority Testing Order**

### **Phase 1: High-Value Systems** (Test First)
```bash
# Admin System (21 endpoints) - Highest business value
/admin, /admin/users, /admin/stats, /admin/config, /admin/games
/admin/logs, /admin/metrics, /admin/history, /admin/leaderboard

# Analytics System (17 endpoints) - High data value  
/analytics, /analytics/event, /analytics/stats, /analytics/history
/analytics/leaderboard, /analytics/me, /analytics/today

# Achievement System (16 endpoints) - User engagement
/achievement, /achievement/list, /achievement/me, /achievement/stats
/achievement/leaderboard, /achievement/today, /achievement/history
```

### **Phase 2: Game Enhancement** (Test Second)
```bash
# Combat System (25 endpoints) - Game mechanics
/combat, /combat/action, /combat/state, /combat/stats
/combat/history, /combat/leaderboard, /combat/me

# Battle System (25 endpoints) - PvP features
/battle, /battle/action, /battle/state, /battle/start
/battle/history, /battle/leaderboard, /battle/stats

# Enemy System (20 endpoints) - Content management  
/enemy, /enemy/list, /enemy/stats, /enemy/action
/enemy/history, /enemy/leaderboard, /enemy/me
```

### **Phase 3: Platform Features** (Test Third)
```bash
# Chat System (16 endpoints) - Social features
/chat, /chat/history, /chat/me, /chat/list
/chat/settings, /chat/stats, /chat/action

# Auth System (16 endpoints) - Security
/auth, /auth/me, /auth/settings, /auth/history
/auth/stats, /auth/action, /auth/list

# Config System (16 endpoints) - Configuration
/config, /config/list, /config/settings, /config/me
/config/stats, /config/action, /config/history
```

---

## 🔍 **Manual Testing Commands**

### **Quick Individual Tests**
```bash
# Test admin endpoint with auth
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://gigaverse.io/api/admin"

# Test analytics endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://gigaverse.io/api/analytics"

# Test achievement endpoint  
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://gigaverse.io/api/achievement"

# Test combat endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://gigaverse.io/api/combat"
```

### **Test Specific Actions**
```bash
# Test admin stats
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://gigaverse.io/api/admin/stats"

# Test analytics events
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"event":"test","data":{}}' \
     "https://gigaverse.io/api/analytics/event"

# Test achievement list  
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://gigaverse.io/api/achievement/list"
```

---

## 📊 **Expected Results Guide**

### **Success Indicators**
- **200 OK**: Endpoint works, returns data
- **201 Created**: Successfully created resource
- **204 No Content**: Action completed successfully

### **Authentication Issues**
- **401 Unauthorized**: JWT token expired/invalid
- **403 Forbidden**: Token valid but insufficient permissions

### **Method Issues**
- **405 Method Not Allowed**: Try different HTTP method (GET vs POST)
- **400 Bad Request**: Check request format/parameters

### **Implementation Ready**
When you find working endpoints:
1. Document the exact request format
2. Note required authentication level
3. Record response structure
4. Test different parameters
5. Add to bot implementation

---

## 🎯 **Integration Priority**

### **Immediate Implementation** (High Impact, Low Complexity)
```bash
1. /analytics/event - Enhanced tracking
2. /achievement/list - Player achievements  
3. /admin/stats - System monitoring
4. /combat/stats - Enhanced combat data
```

### **Medium-term Integration** (High Impact, Medium Complexity)
```bash
1. /admin/* endpoints - Administrative dashboard
2. /analytics/* endpoints - Comprehensive analytics  
3. /achievement/* endpoints - Full progression system
4. /chat/* endpoints - Social features
```

### **Advanced Integration** (High Impact, High Complexity)
```bash
1. /combat/* endpoints - Advanced battle mechanics
2. /battle/* endpoints - PvP system
3. /enemy/* endpoints - AI management
4. /auth/* endpoints - Advanced security
```

---

## 🚀 **Testing Automation**

### **Batch Testing Script**
```bash
# Save all 200 endpoints to file
node -e "
const data = require('./GIGAVERSE_API_COMPLETE_DISCOVERY_ADVANCED.json');
const endpoints = data.publicEndpoints.map(ep => ep.path);
console.log(endpoints.join('\n'));
" > all_endpoints.txt

# Test each endpoint
while read endpoint; do
  echo "Testing: $endpoint"
  curl -s -o /dev/null -w "%{http_code}" \
       -H "Authorization: Bearer YOUR_JWT_TOKEN" \
       "https://gigaverse.io/api$endpoint"
  echo ""
done < all_endpoints.txt
```

---

**This testing guide provides systematic approaches to unlock the full potential of the 200+ discovered Gigaverse API endpoints.**