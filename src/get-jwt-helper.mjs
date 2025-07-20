// Helper script to show how to get JWT token programmatically
// This shows the JavaScript code to run in browser console

console.log(`
╔═══════════════════════════════════════════════════════╗
║           Gigaverse JWT Token Extractor               ║
╚═══════════════════════════════════════════════════════╝

To get your JWT token, run this in the browser console while logged into Gigaverse:

`);

const extractorCode = `
// Run this in browser console at gigaverse.io
const authResponse = localStorage.getItem('authResponse');
if (authResponse) {
  const data = JSON.parse(authResponse);
  console.log('JWT Token:', data.jwt);
  console.log('Wallet Address:', data.user.caseSensitiveAddress);
  console.log('\\nCopy the JWT token and update your .env file');
} else {
  console.log('No auth data found. Make sure you are logged in.');
}
`;

console.log('```javascript');
console.log(extractorCode);
console.log('```');

console.log(`
For future reference, in Gigaverse the JWT is stored in:
- localStorage key: 'authResponse'
- Inside JSON field: 'jwt'

The token expires at: ${new Date(1752792053066).toLocaleString()} (from your current token)
`);