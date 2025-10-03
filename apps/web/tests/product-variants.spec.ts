import { test, expect } from '@playwright/test';

test.describe('product variants', () => {
  test('selecting a variant adds it to the cart', async ({ page }) => {
    await page.goto('/product/product-1');
    await expect(page.getByRole('heading', { name: /Product 1/i })).toBeVisible();

    const optionGroups = page.locator('div.space-y-5').locator('div.space-y-2');
    const groupCount = await optionGroups.count();
    expect(groupCount).toBeGreaterThan(0);

    async function pickOption(groupIndex: number) {
      const buttons = optionGroups.nth(groupIndex).locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
      const targetIndex = count > 1 ? 1 : 0;
      const button = buttons.nth(targetIndex);
      await expect(button).toBeVisible({ timeout: 15000 });
      const label = (await button.innerText()).split('\n')[0].trim();
      await button.click();
      return label;
    }

    const selectedColor = await pickOption(0);
    const selectedSize = groupCount > 1 ? await pickOption(1) : '';
    const variantLabel = selectedSize ? `${selectedColor} / ${selectedSize}` : selectedColor;

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/cart/add') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Add to cart/i }).click();
    await responsePromise;

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /Your Cart/i })).toBeVisible();
    await expect(page.getByText('Product 1')).toBeVisible();
    await expect(page.getByText(variantLabel)).toBeVisible();
  });
});
