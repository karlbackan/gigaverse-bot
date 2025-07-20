import fs from 'fs';

// Read the minified SDK file
const sdkContent = fs.readFileSync('./node_modules/@fireballgg/gigaverse-sdk/dist/gigaverse-api/index.js', 'utf8');

// Extract all string literals that look like API endpoints
const endpointRegex = /["'`](\/[a-zA-Z0-9/_-]+)["'`]/g;
const endpoints = [];
let match;

while ((match = endpointRegex.exec(sdkContent)) !== null) {
  const endpoint = match[1];
  if (!endpoints.includes(endpoint)) {
    endpoints.push(endpoint);
  }
}

// Also extract template literal patterns like `/something/${variable}`
const templateRegex = /["'`](\/[a-zA-Z0-9/_-]+)\$\{[^}]+\}[a-zA-Z0-9/_-]*["'`]/g;
while ((match = templateRegex.exec(sdkContent)) !== null) {
  const endpoint = match[0].replace(/\$\{[^}]+\}/g, '{param}');
  if (!endpoints.includes(endpoint)) {
    endpoints.push(endpoint);
  }
}

console.log('=== Extracted API Endpoints ===\n');
endpoints.sort().forEach(endpoint => {
  console.log(endpoint);
});

// Also look for method names
console.log('\n=== SDK Methods ===\n');
const methodRegex = /async\s+(\w+)\s*\(/g;
const methods = [];
while ((match = methodRegex.exec(sdkContent)) !== null) {
  methods.push(match[1]);
}

methods.forEach(method => {
  console.log(method);
});