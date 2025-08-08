import { chromium } from 'playwright';

async function interceptWebAPI() {
  console.log('🕷️  Launching browser to intercept web API calls...');
  
  const browser = await chromium.launch({ 
    headless: false,  // Show browser so we can see what's happening
    slowMo: 1000     // Slow down for visibility
  });
  
  const page = await browser.newPage();
  
  // Intercept all network requests
  const networkRequests = [];
  
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const postData = request.postData();
    
    // Log all API requests
    if (url.includes('api') || url.includes('game') || url.includes('dungeon') || url.includes('underhaul')) {
      console.log(`\n📡 ${method} ${url}`);
      if (postData) {
        try {
          const parsedData = JSON.parse(postData);
          console.log('📄 Body:', JSON.stringify(parsedData, null, 2));
        } catch {
          console.log('📄 Body (raw):', postData);
        }
      }
      
      networkRequests.push({
        method,
        url,
        postData,
        timestamp: Date.now()
      });
    }
  });
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('api') || url.includes('game') || url.includes('dungeon') || url.includes('underhaul')) {
      console.log(`   ↳ Status: ${response.status()}`);
    }
  });
  
  try {
    // Navigate to Gigaverse
    console.log('🌐 Navigating to gigaverse.io...');
    await page.goto('https://gigaverse.io');
    
    console.log('⏰ Waiting for page to load...');
    await page.waitForTimeout(3000);
    
    console.log('🔍 Looking for game interface...');
    
    // Look for connect button or game elements
    const connectButton = await page.locator('button:has-text("Connect")').first();
    if (await connectButton.isVisible()) {
      console.log('🔘 Found Connect button, clicking...');
      await connectButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Look for any game-related buttons or interfaces
    const gameElements = await page.locator('[class*="game"], [class*="dungeon"], [class*="play"]').all();
    if (gameElements.length > 0) {
      console.log(`🎮 Found ${gameElements.length} game elements`);
      for (const element of gameElements.slice(0, 3)) {
        try {
          const text = await element.textContent();
          console.log(`   - Element: "${text}"`);
        } catch {}
      }
    }
    
    console.log('\n📊 Network Summary:');
    console.log(`Total API requests intercepted: ${networkRequests.length}`);
    
    if (networkRequests.length > 0) {
      console.log('\n📋 All API Endpoints Found:');
      const uniqueUrls = [...new Set(networkRequests.map(r => r.url))];
      uniqueUrls.forEach(url => {
        console.log(`   ${url}`);
      });
      
      // Look for dungeon/underhaul specific endpoints
      const dungeonRequests = networkRequests.filter(r => 
        r.url.includes('dungeon') || r.url.includes('underhaul') || 
        (r.postData && (r.postData.includes('dungeon') || r.postData.includes('underhaul')))
      );
      
      if (dungeonRequests.length > 0) {
        console.log('\n🏰 Dungeon-related requests:');
        dungeonRequests.forEach(req => {
          console.log(`   ${req.method} ${req.url}`);
          if (req.postData) {
            console.log(`   Data: ${req.postData}`);
          }
        });
      } else {
        console.log('\n⚠️  No dungeon-specific requests found yet');
        console.log('   This might be because:');
        console.log('   1. Need to authenticate first');
        console.log('   2. Need to navigate to game area');
        console.log('   3. Game interface is loaded dynamically');
      }
    }
    
    console.log('\n⏸️  Keeping browser open for 30 seconds for manual inspection...');
    console.log('   You can manually navigate the game interface to trigger API calls');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed');
  }
}

interceptWebAPI().catch(console.error);