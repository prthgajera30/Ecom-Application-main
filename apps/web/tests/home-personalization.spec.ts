import { test, expect } from '@playwright/test';

test.describe('home personalization', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows hero content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Everything you love. Delivered fast./i })).toBeVisible();
    await expect(page.getByText('Pulse Market')).toBeVisible();
  });
});
