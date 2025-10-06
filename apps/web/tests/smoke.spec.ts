import { test, expect } from '@playwright/test';

test('home renders', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Everything you love. Delivered fast./i })).toBeVisible();
});
