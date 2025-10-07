import fs from 'fs';
import path from 'path';

const SESSION_FILE = './data/session-state.json';

// Ensure data directory exists
const dataDir = path.dirname(SESSION_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Save session state to file
export function saveSessionState(accountAddress, dungeonType, enemyId, turn, room) {
  try {
    let sessions = {};
    
    // Load existing sessions if file exists
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      sessions = JSON.parse(data);
    }
    
    // Update session for this account
    sessions[accountAddress] = {
      dungeonType,
      enemyId,
      turn,
      room,
      timestamp: Date.now()
    };
    
    // Write back to file
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
    console.log(`  📝 Session saved: Enemy ${enemyId} Turn ${turn}`);
  } catch (error) {
    console.log(`  ⚠️ Could not save session: ${error.message}`);
  }
}

// Load session state from file
export function loadSessionState(accountAddress) {
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      return null;
    }
    
    const data = fs.readFileSync(SESSION_FILE, 'utf8');
    const sessions = JSON.parse(data);
    const session = sessions[accountAddress];
    
    if (!session) {
      return null;
    }
    
    // Check if session is recent (within last hour)
    const age = Date.now() - session.timestamp;
    if (age > 3600000) { // 1 hour
      console.log(`  ⏰ Session too old (${Math.round(age/60000)} minutes)`);
      return null;
    }
    
    console.log(`  📖 Restored session: Enemy ${session.enemyId} Turn ${session.turn}`);
    return session;
  } catch (error) {
    console.log(`  ⚠️ Could not load session: ${error.message}`);
    return null;
  }
}

// Clear session for an account
export function clearSessionState(accountAddress) {
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      return;
    }
    
    const data = fs.readFileSync(SESSION_FILE, 'utf8');
    const sessions = JSON.parse(data);
    
    if (sessions[accountAddress]) {
      delete sessions[accountAddress];
      fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
      console.log(`  🗑️ Session cleared for ${accountAddress}`);
    }
  } catch (error) {
    console.log(`  ⚠️ Could not clear session: ${error.message}`);
  }
}

// Clear all sessions
export function clearAllSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
      console.log('  🗑️ All sessions cleared');
    }
  } catch (error) {
    console.log(`  ⚠️ Could not clear sessions: ${error.message}`);
  }
}