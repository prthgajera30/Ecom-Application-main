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
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'user@example.com');
    await page.fill('input[type="password"]', 'user123');
    await page.click('button:has-text("Sign in")');
    await page.waitForTimeout(1500);
    console.log('PAGE URL AFTER CLICK:', page.url());
    const token = await page.evaluate(() => window.localStorage.getItem('token'));
    console.log('LOCALSTORAGE token:', token ? token.slice(0,10)+'...' : token);
  const clientEnv = await page.evaluate(() => (typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_API_BASE : undefined));
  console.log('CLIENT process.env.NEXT_PUBLIC_API_BASE =', clientEnv);
    // Try a client-side fetch to /api/auth/me to see whether the token is accepted in the browser context
    try {
      const me = await page.evaluate(async () => {
        const t = window.localStorage.getItem('token');
        if (!t) return { ok: false, error: 'no-token' };
        const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } });
        const text = await r.text();
        return { ok: r.ok, status: r.status, body: text };
      });
      console.log('CLIENT /api/auth/me:', me);
    } catch (e) {
      console.log('CLIENT FETCH ERROR', e.toString());
    }
  } catch (e) {
    console.error('ERR', e);
  }
  await browser.close();
})();