import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_FILE = path.join(__dirname, '../data/action-token.json');

/**
 * Save action token to file for persistence across sessions
 */
export function saveActionToken(token, accountAddress) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load existing tokens or create new object
    let tokens = {};
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      tokens = JSON.parse(data);
    }
    
    // Save token for this account
    tokens[accountAddress] = {
      token: token,
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString()
    };
    
    // Write back to file
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log(`💾 Token saved for ${accountAddress}: ${token}`);
  } catch (error) {
    console.error('Error saving token:', error.message);
  }
}

/**
 * Load action token from file
 */
export function loadActionToken(accountAddress) {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    const tokens = JSON.parse(data);

    if (tokens[accountAddress]) {
      const savedToken = tokens[accountAddress].token;
      const age = Date.now() - tokens[accountAddress].timestamp;
      const ageSeconds = Math.floor(age / 1000);
      const ageMinutes = Math.floor(age / 60000);

      // CORRUPTION FIX: Reject tokens older than 30 seconds
      // Action tokens are timestamp-based and become stale quickly
      if (age > 30000) { // 30 seconds
        console.log(`⏰ Token too old (${ageSeconds}s), discarding to prevent corruption`);
        clearActionToken(accountAddress);
        return null;
      }

      console.log(`💾 Loaded token for ${accountAddress}: ${savedToken} (${ageSeconds}s old)`);
      return savedToken;
    }

    return null;
  } catch (error) {
    console.error('Error loading token:', error.message);
    return null;
  }
}

/**
 * Extract expected token from error message
 * Error format: "Invalid action token undefined != 1756748732718"
 */
export function extractTokenFromError(errorMessage) {
  if (!errorMessage) return null;
  
  const match = errorMessage.match(/Invalid action token .* != (\d+)/);
  if (match && match[1]) {
    const extractedToken = match[1];
    console.log(`🔍 Extracted expected token from error: ${extractedToken}`);
    return extractedToken;
  }
  
  return null;
}

/**
 * Clear saved token for an account
 */
export function clearActionToken(accountAddress) {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return;
    }
    
    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    const tokens = JSON.parse(data);
    
    if (tokens[accountAddress]) {
      delete tokens[accountAddress];
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
      console.log(`🗑️ Cleared token for ${accountAddress}`);
    }
  } catch (error) {
    console.error('Error clearing token:', error.message);
  }
}