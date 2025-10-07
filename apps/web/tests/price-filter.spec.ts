import { test, expect } from '@playwright/test';

test.describe('price filter', () => {
  test('price inputs accept typing', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Wait for products to load
    await expect(page.getByText(/Explore the catalog/i)).toBeVisible();

    // Open mobile filters on small screens or ensure desktop filters are visible
    const isMobile = await page.locator('.lg\\:hidden').isVisible();
    if (isMobile) {
      const filtersButton = page.getByRole('button', { name: /Filters/i });
      await expect(filtersButton).toBeVisible();
      await filtersButton.click();
      await expect(page.getByRole('heading', { name: /Price/i })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: /Price/i })).toBeVisible();
    }

    const minInput = page.getByPlaceholder('$0.00');
    const maxInput = page.getByPlaceholder('$500.00');

    await expect(minInput).toBeVisible();
    await expect(maxInput).toBeVisible();

    // Test that we can enter values in min price input
    await minInput.fill('150');
    let currentValue = await minInput.inputValue();
    expect(currentValue).toBe('150');

    // Test that we can enter values in max price input
    await maxInput.fill('200');
    currentValue = await maxInput.inputValue();
    expect(currentValue).toBe('200');

    // Test that we can update values
    await minInput.fill('75');
    currentValue = await minInput.inputValue();
    expect(currentValue).toBe('75');

    // Close mobile filters if necessary
    if (isMobile) {
      const doneButton = page.getByRole('button', { name: /Done/i });
      await expect(doneButton).toBeVisible();
      await doneButton.click();
    }
  });

  test('apply price filter button works', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Explore the catalog/i)).toBeVisible();

    // Open mobile filters if on small screen
    const isMobile = await page.locator('.lg\\:hidden').isVisible();
    if (isMobile) {
      await page.getByRole('button', { name: /Filters/i }).click();
      await expect(page.getByRole('heading', { name: /Price/i })).toBeVisible();
    }

    const minInput = page.getByPlaceholder('$0.00');
    const maxInput = page.getByPlaceholder('$500.00');
    const applyButton = page.getByRole('button', { name: /Apply price range/i });

    // Clear and enter price values
    await minInput.fill('');
    await maxInput.fill('');
    await minInput.fill('1');
    await maxInput.fill('10');

    // Check that Apply button is clickable
    await expect(applyButton).toBeEnabled();
    await expect(applyButton).toBeVisible();

    // Click apply button
    await applyButton.click();

    // Should not throw any errors and page should still function
    await expect(page.getByText(/Explore the catalog/i)).toBeVisible();
  });

  test('price filter badges appear and can be removed', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Apply a price filter
    const isMobile = await page.locator('.lg\\:hidden').isVisible();
    if (isMobile) {
      await page.getByRole('button', { name: /Filters/i }).click();
      await expect(page.getByRole('heading', { name: /Price/i })).toBeVisible();
    }

    const minInput = page.getByPlaceholder('$0.00');
    const maxInput = page.getByPlaceholder('$500.00');

    await minInput.fill('50');
    await maxInput.fill('200');
    await page.getByRole('button', { name: /Apply price range/i }).click();

    await page.waitForLoadState('networkidle');

    // Should see price filter badge - look for active filter badges in the main page area
    const activeFilterArea = page.locator('.overflow-x-auto.pb-1').first();
    const priceBadge = activeFilterArea.locator('button').filter({ hasText: /Price/ });
    await expect(priceBadge).toBeVisible();

    // Click the badge to remove filter
    await priceBadge.click();

    await page.waitForLoadState('networkidle');

    // Badge should be gone - there should be no price badges left
    const remainingPriceBadges = activeFilterArea.locator('button').filter({ hasText: /Price/ });
    await expect(remainingPriceBadges).toHaveCount(0);
  });
});
