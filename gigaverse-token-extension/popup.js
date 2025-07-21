// Get the current tab
chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
  const tab = tabs[0];
  const content = document.getElementById('content');
  const statusDiv = document.getElementById('status');
  
  // Check if we're on gigaverse.io
  if (!tab.url || !tab.url.includes('gigaverse.io')) {
    content.innerHTML = `
      <div class="error" style="color: #d32f2f; text-align: center;">
        <h3>❌ Not on Gigaverse.io</h3>
        <p>Please navigate to <a href="https://gigaverse.io" target="_blank">gigaverse.io</a> and try again.</p>
      </div>
    `;
    return;
  }
  
  try {
    // Execute script to get the token
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try multiple methods to find the token
        let token = null;
        let tokenInfo = { source: 'not found' };
        
        // Method 1: Check localStorage for various token keys
        const tokenKeys = ['authToken', 'token', 'jwt', 'auth_token', 'jwtToken', 'bearerToken'];
        for (const key of tokenKeys) {
          const value = localStorage.getItem(key);
          if (value && value.startsWith('eyJ')) {
            token = value;
            tokenInfo.source = `localStorage['${key}']`;
            break;
          }
        }
        
        // Method 2: Check sessionStorage
        if (!token) {
          for (const key of tokenKeys) {
            const value = sessionStorage.getItem(key);
            if (value && value.startsWith('eyJ')) {
              token = value;
              tokenInfo.source = `sessionStorage['${key}']`;
              break;
            }
          }
        }
        
        // Method 3: Check all localStorage keys
        if (!token) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            if (value && value.includes('eyJ') && value.length > 100) {
              // Check if it looks like a JWT
              if (value.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)) {
                token = value.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)[0];
                tokenInfo.source = `localStorage['${key}'] (extracted)`;
                break;
              }
            }
          }
        }
        
        // Method 4: Log all storage for debugging
        const debugInfo = {
          localStorageKeys: Object.keys(localStorage),
          sessionStorageKeys: Object.keys(sessionStorage),
          cookies: document.cookie
        };
        
        // Get other info
        const address = localStorage.getItem('walletAddress') || localStorage.getItem('address');
        const username = localStorage.getItem('username') || localStorage.getItem('user');
        
        // Try to decode JWT to get expiration
        let expiry = null;
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp) {
              expiry = new Date(payload.exp * 1000).toLocaleString();
            }
          } catch (e) {}
        }
        
        return { token, address, username, expiry, tokenInfo, debugInfo };
      }
    });
    
    const data = results[0].result;
    
    if (data.token) {
      content.innerHTML = `
        <div class="info">
          <strong>Account:</strong> ${data.username || 'Unknown'}<br>
          <strong>Wallet:</strong> ${data.address || 'Unknown'}<br>
          ${data.expiry ? `<strong>Token Expires:</strong> ${data.expiry}` : ''}
        </div>
        
        <div class="token-box" id="tokenBox">${data.token}</div>
        
        <div class="button-group">
          <button class="copy-btn" id="copyToken">📋 Copy Token</button>
          <button class="copy-btn" id="copyEnv">📋 Copy as .env</button>
          <button class="refresh-btn" id="refresh">🔄 Refresh</button>
        </div>
        
        <div class="info" style="margin-top: 15px;">
          <strong>How to use:</strong><br>
          1. Copy the token above<br>
          2. Add to your .env file as JWT_TOKEN=...<br>
          3. For multiple accounts, use JWT_TOKEN_1, JWT_TOKEN_2, etc.
        </div>
      `;
      
      // Add click handlers
      document.getElementById('copyToken').onclick = function() {
        copyToClipboard(data.token, 'Token copied!');
      };
      
      document.getElementById('copyEnv').onclick = function() {
        const envLine = `JWT_TOKEN=${data.token}`;
        copyToClipboard(envLine, '.env line copied!');
      };
      
      document.getElementById('refresh').onclick = function() {
        location.reload();
      };
      
    } else {
      // Show debug info to help find the token
      content.innerHTML = `
        <div class="error" style="color: #d32f2f;">
          <h3>⚠️ No Token Found</h3>
          <p>Debug Info - Storage Keys Found:</p>
          <div class="token-box" style="font-size: 10px; max-height: 200px;">
            <strong>localStorage keys:</strong><br>
            ${data.debugInfo.localStorageKeys.join(', ') || 'None'}<br><br>
            <strong>sessionStorage keys:</strong><br>
            ${data.debugInfo.sessionStorageKeys.join(', ') || 'None'}<br><br>
            <strong>Searched for:</strong> authToken, token, jwt, auth_token, jwtToken, bearerToken
          </div>
          <button class="refresh-btn" onclick="location.reload()" style="margin-top: 10px;">🔄 Try Again</button>
          <div class="info" style="margin-top: 10px;">
            <strong>Alternative method:</strong><br>
            1. Open DevTools (F12)<br>
            2. Go to Application → Local Storage<br>
            3. Look for any token-like values<br>
            4. Or run in Console: <code>localStorage.getItem('authToken')</code>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    content.innerHTML = `
      <div class="error" style="color: #d32f2f;">
        <h3>❌ Error</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
});

function copyToClipboard(text, message) {
  navigator.clipboard.writeText(text).then(() => {
    showStatus(message, 'success');
  }).catch(() => {
    // Fallback method
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showStatus(message, 'success');
  });
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}