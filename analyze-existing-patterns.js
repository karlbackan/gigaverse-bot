#!/usr/bin/env node

console.log('🔍 COMPLETE API REVERSE ENGINEERING ANALYSIS');
console.log('=' .repeat(60));

console.log('\n📋 KNOWN WORKING ENDPOINTS:');
const workingEndpoints = [
  { method: 'GET', endpoint: '/game/dungeon/state', purpose: 'Get current dungeon state' },
  { method: 'GET', endpoint: '/game/dungeon/today', purpose: 'Get available dungeons info' },
  { method: 'POST', endpoint: '/game/dungeon/action', purpose: 'Send game actions (moves, loot)' },
  { method: 'GET', endpoint: '/gear/instances/{address}', purpose: 'Get player gear' },
  { method: 'GET', endpoint: '/importexport/balances/{address}', purpose: 'Get inventory' }
];

workingEndpoints.forEach(ep => {
  console.log(`   ${ep.method.padEnd(4)} ${ep.endpoint.padEnd(35)} - ${ep.purpose}`);
});

console.log('\n🚫 CONFIRMED NON-WORKING PATTERNS FOR UNDERHAUL START:');
const triedEndpoints = [
  '/game/dungeon/action (with dungeonType: 3) → starts dungeon 1',
  '/game/dungeon/action (with dungeonId: 3) → 401 error', 
  '/game/underhaul/action → not found in investigation',
  '/game/dungeon/start → not found in investigation',
  '/game/dungeon/new → not found in investigation',
  '/underhaul/start → not found in investigation',
  '/v1/game/dungeon/action → not found in investigation',
  'GraphQL /graphql → returns 405'
];

triedEndpoints.forEach(ep => {
  console.log(`   ❌ ${ep}`);
});

console.log('\n🧩 PATTERN ANALYSIS:');

console.log('\n1. ENDPOINT STRUCTURE PATTERNS:');
console.log('   All working endpoints follow: /game/{resource}/{action}');
console.log('   Examples:');
console.log('     /game/dungeon/state  (resource=dungeon, action=state)');
console.log('     /game/dungeon/today  (resource=dungeon, action=today)');
console.log('     /game/dungeon/action (resource=dungeon, action=action)');

console.log('\n2. UNDERHAUL HYPOTHESIS:');
console.log('   If Underhaul follows the same pattern, possible endpoints:');
const hypotheticalEndpoints = [
  '/game/underhaul/state',
  '/game/underhaul/action', 
  '/game/underhaul/start',
  '/game/dungeon/underhaul',
  '/game/dungeon/action (with different parameter structure)'
];

hypotheticalEndpoints.forEach(ep => {
  console.log(`     • ${ep}`);
});

console.log('\n3. PARAMETER STRUCTURE ANALYSIS:');
console.log('   Regular dungeon start (that creates dungeon 1):');
console.log('   {');
console.log('     action: "start_run",');
console.log('     dungeonType: 3,        ← This parameter is IGNORED by server'); 
console.log('     data: { ... }');
console.log('   }');

console.log('\n   SDK uses different structure (from minified code):');
console.log('   {');
console.log('     action: "start_run",');
console.log('     dungeonId: 3,          ← Different parameter name');
console.log('     data: { ... }');
console.log('   }');

console.log('\n4. SERVER BEHAVIOR OBSERVATIONS:');
console.log('   • Server accepts dungeonType: 3 but starts dungeon 1');
console.log('   • Server returns different error for type 3 vs other invalid types'); 
console.log('   • Server recognizes the request structure but overrides the type');
console.log('   • This suggests intentional server-side blocking');

console.log('\n5. POSSIBLE MISSING PIECES:');
const missingPieces = [
  'Different endpoint entirely (not /game/dungeon/action)',
  'Additional authentication header or token',
  'Prerequisite API call to unlock/initialize Underhaul',
  'Different request structure specific to Underhaul',
  'Session state requirement (must be authenticated differently)',
  'Gear requirements (must have specific gear equipped)',
  'Account progression requirement (checkpoint unlocked)',
  'Time-based restriction (can only start at certain times)'
];

missingPieces.forEach((piece, i) => {
  console.log(`   ${i + 1}. ${piece}`);
});

console.log('\n6. NEXT INVESTIGATION STEPS:');
const nextSteps = [
  'Test /game/underhaul/* endpoints systematically',
  'Test different authentication patterns',
  'Check for prerequisite calls (state initialization)', 
  'Test with valid gear requirements',
  'Analyze actual browser network traffic',
  'Check for WebSocket or SSE connections',
  'Test alternative base URLs or API versions'
];

nextSteps.forEach((step, i) => {
  console.log(`   ${i + 1}. ${step}`);
});

console.log('\n7. THEORY: DIFFERENT ENDPOINT FOR UNDERHAUL');
console.log('   Most likely scenario: Underhaul uses completely different endpoint');
console.log('   Pattern could be:');
console.log('     Regular: POST /game/dungeon/action');
console.log('     Underhaul: POST /game/underhaul/action');
console.log('     or: POST /game/dungeon/underhaul/start');
console.log('     or: POST /underhaul/start');

console.log('\n📊 CONFIDENCE LEVELS:');
console.log('   🟢 High (90%+): Different endpoint required for Underhaul');
console.log('   🟡 Medium (60%): Endpoint is /game/underhaul/action or similar');
console.log('   🔴 Low (30%): Same endpoint with different auth/params');
console.log('   🔴 Low (20%): Server-side blocking is permanent');

console.log('\n🎯 RECOMMENDED NEXT TEST:');
console.log('   1. Test /game/underhaul/action with proper structure');
console.log('   2. Test /game/underhaul/start');
console.log('   3. Monitor actual website network traffic');
console.log('   4. Check for alternative base URLs');

console.log('\n⚠️  READY FOR FRESH JWT TOKENS TO CONTINUE TESTING');