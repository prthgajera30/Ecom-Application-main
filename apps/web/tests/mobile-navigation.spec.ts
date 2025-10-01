import { test, expect } from '@playwright/test';

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders the menu toggle control', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button[aria-label="Open menu"]', { state: 'attached' });
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
  });
});
