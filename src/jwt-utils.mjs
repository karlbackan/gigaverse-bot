// Decode JWT token to extract game data
export function decodeJWT(token) {
  if (!token) return null;
  
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // The payload is the second part, base64 encoded
    const payload = parts[1];
    
    // Decode base64 (handle URL-safe base64)
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

// Extract noobId from JWT
export function getNoobIdFromJWT(token) {
  const decoded = decodeJWT(token);
  if (!decoded) return null;
  
  // Check various possible locations for noobId
  return decoded.gameAccount?.lastNoobId ||
         decoded.gameAccount?.noob?.ID ||
         decoded.lastNoobId ||
         decoded.noobId ||
         null;
}

// Extract wallet address from JWT
export function getWalletFromJWT(token) {
  const decoded = decodeJWT(token);
  if (!decoded) return null;
  
  return decoded.address || decoded.walletAddress || null;
}