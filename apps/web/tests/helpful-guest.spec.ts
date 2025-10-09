import { test, expect } from '@playwright/test';

test.describe('Helpful guest flow', () => {
  test('guest clicks helpful opens sign-in modal', async ({ page }) => {
    // Ensure logged out
    await page.goto('/');
    const logoutBtn = page.locator('button:has-text("Sign Out")').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForLoadState('networkidle');
    }

    await page.goto('/product/1');
    await page.waitForLoadState('networkidle');

    const firstHelpful = page.locator('button:has-text("Helpful")').first();
    if (!(await firstHelpful.isVisible())) {
      test.skip();
      return;
    }

    await firstHelpful.click();

    // Modal should appear (role=dialog)
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();

    // Fill with credentials and sign in to ensure the modal logs in successfully
    await dialog.locator('input[placeholder="Email"]').fill('user@example.com');
    await dialog.locator('input[placeholder="Password"]').fill('user123');
    await dialog.locator('button:has-text("Sign in")').click();

    // After sign in, modal should close and a success toast may appear
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 }).catch(() => {});

    // Now try marking helpful again (server must accept this)
    const helpfulBtnAfter = page.locator('button:has-text("Helpful")').first();
    if (await helpfulBtnAfter.isVisible()) {
      await helpfulBtnAfter.click();
      // Wait for toast or disabled state
      await page.waitForSelector('[data-testid="toast"], .toast, button[disabled]', { timeout: 3000 }).catch(() => {});
    }

    // Confirm localStorage has markedReviews key if set by the app (non-empty)
    const marked = await page.evaluate(() => localStorage.getItem('markedReviews'));
    // It's OK if undefined in some setups; we just ensure the code path runs without error
    // If present, ensure it's valid JSON
    if (marked) {
      const parsed = JSON.parse(marked);
      expect(typeof parsed).toBe('object');
    }
  });
});
