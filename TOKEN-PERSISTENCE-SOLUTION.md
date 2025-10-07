# Token Persistence Solution

## Problem Solved

The bot was getting "Invalid action token" errors when restarting because:
- Server maintains persistent token state
- Bot resets to `null` on restart
- Mismatch causes immediate failure

## Solution Implemented

### 1. **Token Persistence System** (`src/token-persistence.mjs`)
- Saves tokens to `data/action-token.json`
- Persists across bot restarts
- Per-account token storage

### 2. **Automatic Token Recovery**
- Loads saved token on startup
- Extracts expected token from error messages
- Auto-recovers from token mismatches

### 3. **Error Message Parsing**
When server says: `"Invalid action token undefined != 1756748732718"`
- Bot extracts: `1756748732718`
- Uses it for next request
- Saves for future sessions

## How It Works

### On Startup:
```javascript
// Automatically loads saved token
const savedToken = loadActionToken(config.walletAddress);
if (savedToken) {
  currentActionToken = savedToken;
}
```

### On Success:
```javascript
// Saves token for next session
if (response.data?.actionToken) {
  saveActionToken(currentActionToken, config.walletAddress);
}
```

### On Error:
```javascript
// Extracts and uses expected token
if (message?.includes('Invalid action token')) {
  const expectedToken = extractTokenFromError(message);
  currentActionToken = expectedToken;
  saveActionToken(expectedToken, config.walletAddress);
}
```

## Benefits

1. **No More Token Corruption** - Tokens persist across restarts
2. **Automatic Recovery** - Extracts correct token from errors
3. **Per-Account Storage** - Each account maintains its own token
4. **Zero Manual Intervention** - No need to play manually to fix

## Token File Structure

`data/action-token.json`:
```json
{
  "0xBC68aBe3Bfd01A35050d46fE8659475E1Eab59F0": {
    "token": "1756748732718",
    "timestamp": 1756748732718,
    "lastUpdated": "2025-09-01T18:00:00.000Z"
  }
}
```

## Testing

Run the test to verify:
```bash
node test-token-persistence.mjs
```

## Result

The bot now automatically:
1. Saves tokens when playing
2. Loads tokens on startup
3. Recovers from token mismatches
4. Prevents corruption errors

No more "Invalid action token" errors on restart!