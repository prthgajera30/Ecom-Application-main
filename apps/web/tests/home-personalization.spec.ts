import { test, expect } from '@playwright/test';

test.describe('home personalization', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows hero content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Trending collections/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Craft shopping journeys/i })).toBeVisible();
  });
});
