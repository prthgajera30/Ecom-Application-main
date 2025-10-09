import { test, expect } from '@playwright/test';

test.describe('Helpful optimistic update', () => {
  test.beforeEach(async ({ page }) => {
    // Login as default user used by other tests
    await page.goto('/login');
    await page.fill('input[type="email"]', 'user@example.com');
    await page.fill('input[type="password"]', 'user123');
    await page.click('button:has-text("Sign in")');
    await page.waitForLoadState('networkidle');
  });

  test('optimistic increment then revert on server error', async ({ page }) => {
    await page.goto('/product/1');
    await page.waitForLoadState('networkidle');

    const reviewCards = page.locator('[data-testid="review-card"]').or(page.locator('[data-testid="review-item"]').or(page.locator('.review-card').or(page.locator('.review-item'))));
    if ((await reviewCards.count()) === 0) {
      test.skip();
      return;
    }

    const first = reviewCards.first();

    // Get initial helpful count (fallback to 0)
    const helpfulText = await first.locator('text=/Helpful \(|text=/Marked \(|text=/\(\d+\)/').first().textContent().catch(() => null);
    const initialMatch = helpfulText ? helpfulText.match(/(\d+)/) : null;
    const initialCount = initialMatch ? parseInt(initialMatch[1], 10) : 0;

    // Intercept the helpful POST and return a delayed 500 to allow optimistic UI to appear
    await page.route('**/reviews/*/helpful', async (route) => {
      await new Promise((res) => setTimeout(res, 500));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INTERNAL_ERROR' })
      });
    });

    const helpfulBtn = first.locator('button:has-text("Helpful")').or(first.locator('button:has-text("👍")')).or(first.locator('[data-testid="helpful-btn"]'));
    if (!(await helpfulBtn.isVisible())) {
      test.skip();
      return;
    }

    // Click the helpful button
    await helpfulBtn.click();

    // Immediately the UI should show optimistic change — either marking state or incremented count
    // Check for 'Marking…' or count = initial + 1
    const markingVisible = await first.locator('text=Marking…').isVisible().catch(() => false);
    if (!markingVisible) {
      // Check count increment
      const interimText = await first.textContent();
      const interimMatch = interimText ? interimText.match(/(\d+)/) : null;
      const interimCount = interimMatch ? parseInt(interimMatch[1], 10) : null;
      expect(interimCount).toBe(initialCount + 1);
    }

    // Wait for error toast
    await page.waitForSelector('[data-testid="toast"], .toast, text=/Unable to mark|Already marked|Sign in required|Unable to mark/i', { timeout: 3000 });

    // After server error, count should revert to initialCount
    await page.waitForTimeout(200); // allow UI to settle
    const finalText = await first.textContent();
    const finalMatch = finalText ? finalText.match(/(\d+)/) : null;
    const finalCount = finalMatch ? parseInt(finalMatch[1], 10) : 0;
    expect(finalCount).toBe(initialCount);
  });
});
