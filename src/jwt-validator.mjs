import { getDirectEnergy } from './direct-api.mjs';

export class JWTValidator {
  constructor() {
    this.cache = new Map(); // Cache validation results for 5 minutes
  }

  // Create a unique hash for the token to use as cache key
  hashToken(token) {
    // Simple hash function to create unique key from token
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Decode JWT without verification (to check expiration)
  decodeJWT(token) {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      
      // JWT has 3 parts separated by dots
      const parts = cleanToken.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode the payload (second part)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch (error) {
      return null;
    }
  }

  // Check if token is expired based on exp claim
  isTokenExpired(token) {
    const payload = this.decodeJWT(token);
    if (!payload || !payload.exp) {
      return true; // Consider invalid tokens as expired
    }

    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }

  // Validate token by making an API call
  async validateToken(token, accountName = 'Unknown') {
    // Check cache first - use full token hash as key to avoid collisions
    const cacheKey = this.hashToken(token);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.timestamp > Date.now() - 300000) { // 5 minute cache
      return cached.result;
    }

    const result = {
      accountName,
      token: token.substring(0, 20) + '...',
      valid: false,
      expired: false,
      error: null,
      walletAddress: null,
      energy: 0
    };

    try {
      // Skip JWT expiration check - test directly against API
      // The JWT exp claim might not be accurate, so we'll let the API decide
      
      // Save original token
      const originalToken = process.env.JWT_TOKEN;
      
      // Extract wallet address from token
      const payload = this.decodeJWT(token);
      const walletAddress = payload?.address || payload?.user?.caseSensitiveAddress;
      
      
      // Make API call to validate
      process.env.JWT_TOKEN = token; // Temporarily set for API call
      const energyData = await getDirectEnergy(walletAddress);
      
      if (energyData?.entities?.[0]) {
        result.energy = energyData.entities[0].parsedData?.energyValue || 0;
        result.walletAddress = energyData.entities[0].parsedData?.walletAddress || 
                               energyData.entities[0].PLAYER_CID || 
                               'Unknown';
        
        // Also check if token works for game endpoints
        try {
          const { getDirectDungeonState } = await import('./direct-api.mjs');
          await getDirectDungeonState();
          result.valid = true; // Token works for both energy AND game endpoints
        } catch (gameError) {
          if (gameError.response?.status === 401) {
            result.valid = false;
            result.error = 'Token invalid for game endpoints (works for energy only)';
          } else {
            // Other errors don't necessarily mean invalid token
            result.valid = true;
          }
        }
      } else {
        result.error = 'Invalid API response';
      }
      
      // Restore original token
      process.env.JWT_TOKEN = originalToken;
    } catch (error) {
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        result.expired = true;
        result.error = 'Token rejected by API (401 Unauthorized)';
      } else if (error.message?.includes('403')) {
        result.error = 'Token forbidden (403)';
      } else {
        result.error = error.message || 'Unknown error';
      }
    }

    // Cache the result with hashed token key
    this.cache.set(this.hashToken(token), { result, timestamp: Date.now() });
    return result;
  }

  // Validate multiple tokens
  async validateAll(accounts) {
    console.log('\n🔍 Validating JWT tokens...\n');
    
    const results = [];
    for (const account of accounts) {
      process.stdout.write(`Checking ${account.name}... `);
      const result = await this.validateToken(account.token, account.name);
      
      if (result.valid) {
        console.log(`✅ Valid (Energy: ${result.energy})`);
      } else if (result.expired) {
        console.log(`❌ Expired`);
      } else if (result.error?.includes('game endpoints')) {
        console.log(`⚠️  Invalid for dungeons (${result.error})`);
      } else {
        console.log(`⚠️  Invalid (${result.error})`);
      }
      
      
      results.push(result);
    }

    return results;
  }

  // Clear validation cache
  clearCache() {
    this.cache.clear();
  }
}