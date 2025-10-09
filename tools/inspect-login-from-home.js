const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('request', req => {
    if (req.url().includes('/auth/login')) console.log('REQUEST', req.method(), req.url(), req.postData());
  });
  page.on('response', async res => {
    if (res.url().includes('/auth/login')) {
      console.log('RESPONSE', res.status(), await res.text());
    }
  });
  try {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    // Click the header Sign in link
    await page.locator('header a:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');
    console.log('AT LOGIN PAGE:', page.url());
    // Clear and fill
    await page.locator('input[type="email"]').fill('');
    await page.locator('input[type="password"]').fill('');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('user123');
    await page.locator('button:has-text("Sign in")').click();
    // wait a short while for navigation
    await page.waitForTimeout(1500);
    console.log('PAGE URL AFTER CLICK:', page.url());
    const token = await page.evaluate(() => window.localStorage.getItem('token'));
    console.log('LOCALSTORAGE token:', token ? token.slice(0,10)+'...' : token);
    const hasUserMenu = await page.locator('[data-testid="user-menu"]').count();
    console.log('user-menu count:', hasUserMenu);
  } catch (e) {
    console.error('ERR', e);
  }
  await browser.close();
})();
