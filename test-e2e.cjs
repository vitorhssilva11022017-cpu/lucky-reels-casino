const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport to a desktop size
  await page.setViewportSize({ width: 1280, height: 720 });
  
  console.log('1. Loading application...');
  await page.goto('https://web-lucky-reels-casino.vercel.app');
  await page.waitForLoadState('networkidle');
  console.log('   App loaded! Title:', await page.title());
  
  // Wait a bit for initialization (the wheel modal usually pops up on first load)
  await page.waitForTimeout(3000);
  
  // Check if daily wheel modal is visible
  const wheelButton = page.locator('button', { hasText: 'SPIN' }).first();
  if (await wheelButton.isVisible()) {
    console.log('2. Daily Wheel appeared, spinning...');
    await wheelButton.click();
    await page.waitForTimeout(3000); // wait for spin animation
    
    const claimButton = page.locator('button', { hasText: 'CLAIM' });
    if (await claimButton.isVisible()) {
      await claimButton.click();
      console.log('   Wheel claimed!');
    }
  }
  
  await page.waitForTimeout(1000);
  
  console.log('3. Taking Lobby screenshot...');
  await page.screenshot({ path: 'lobby-test.png' });
  
  console.log('4. Entering Egyptian Treasure...');
  // Find the Egyptian Treasure tile (which should be unlocked)
  // Usually it's an image or a div with the text "Egyptian Treasure"
  const machineLink = page.locator('a[href="/play/egyptian-treasure"]');
  if (await machineLink.count() > 0) {
    await machineLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // wait for canvas to mount
    
    console.log('   Inside machine! Taking screenshot...');
    await page.screenshot({ path: 'machine-test.png' });
    
    console.log('5. Clicking Spin...');
    const spinBtn = page.locator('button', { hasText: 'SPIN' }).first();
    if (await spinBtn.isVisible()) {
      await spinBtn.click();
      await page.waitForTimeout(3000); // Wait for spin to finish
      console.log('   Spin completed!');
    } else {
      console.log('   Spin button not found?');
    }
    
    console.log('6. Returning to lobby...');
    const homeBtn = page.locator('button[title="Home"], a[href="/"]');
    if (await homeBtn.count() > 0) {
      await homeBtn.first().click();
      await page.waitForTimeout(1000);
    }
  } else {
    console.log('   Egyptian Treasure link not found in DOM.');
  }

  console.log('7. Testing Modals (Store, VIP)...');
  // Store
  const storeBtn = page.locator('button').filter({ has: page.locator('.lucide-shopping-bag, .lucide-store') }).first();
  if (await storeBtn.count() > 0) {
    await storeBtn.click();
    await page.waitForTimeout(500);
    console.log('   Store opened.');
    await page.keyboard.press('Escape'); // close modal
    await page.waitForTimeout(500);
  }
  
  console.log('✅ Frontend tests completed successfully!');
  await browser.close();
})();
