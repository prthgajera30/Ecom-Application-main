import { test, expect } from '@playwright/test';

test.describe('product variants', () => {
  test('selecting a variant adds it to the cart', async ({ page }) => {
    await page.goto('/product/aurora-running-sneaker');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Aurora Running Sneaker/i })).toBeVisible();

    const optionGroups = page.locator('div.space-y-4').locator('div.space-y-2');
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

    // Debug: log selected options and button state
    console.log('Selected color:', selectedColor);
    console.log('Selected size:', selectedSize);
    const addToCartBtn = page.getByRole('button', { name: /Add to cart/i });
    const isEnabled = await addToCartBtn.isEnabled();
    console.log('Add to cart button enabled:', isEnabled);

    // Log all network requests after clicking Add to cart
    const requests: string[] = [];
    page.on('request', (request) => {
      requests.push(`${request.method()} ${request.url()}`);
    });
    await addToCartBtn.click();
    await page.waitForTimeout(3000);
    console.log('Network requests after Add to cart:', requests);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /Your Cart/i })).toBeVisible();
    await expect(page.getByText('Aurora Running Sneaker')).toBeVisible();
    await expect(page.getByText(variantLabel)).toBeVisible();
  });
});
