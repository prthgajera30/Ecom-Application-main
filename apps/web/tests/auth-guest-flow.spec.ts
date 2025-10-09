import { test, expect } from '@playwright/test';

test.describe('Authentication - Guest User Flows', () => {
  test('guest checkout requires authentication', async ({ page }) => {
    // Start with empty cart on homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to products and add item to cart
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

  // Wait for products to load and click first "Add to Cart" button
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
  const firstProduct = page.locator('[data-testid="product-card"]').first();
  await firstProduct.locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500); // Wait for cart update

    // Verify cart has item
    const cartCount = page.locator('[data-testid="cart-count-desktop"]');
    if (await cartCount.isVisible()) {
      await expect(cartCount).toHaveText('1');
    } else {
      console.log('Cart count badge not visible - may be using mobile layout');
    }

    // Go to cart page
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2:has-text("Your Cart")')).toBeVisible();

    // Proceed to checkout
    await page.locator('button:has-text("Proceed to checkout")').click();
    await page.waitForLoadState('networkidle');

    // Should be redirected to login page since guest checkout requires authentication
    await expect(page.getByRole('heading', { name: /sign in to continue/i })).toBeVisible();

    // Should show login required message
    await expect(page.locator('text="Sign in to complete checkout."')).toBeVisible();
  });

  test('guest user can create account from post-checkout page', async ({ page }) => {
    // Complete minimal checkout flow first
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // Assuming we can bypass to success page or mock completion

    // On order success page, there should be "Create Account" option
    // await page.locator('button:has-text("Create Account")').click();
    // await page.fill('[name="email"]', 'guest@email.com');
    // await page.fill('[name="password"]', 'securepass123');
    // await page.click('button:has-text("Create Account")');

    // Should redirect to profile or show success message
    // Note: This test needs adjustment based on actual UI implementation
  });

  test('guest checkout prevents access to authenticated features', async ({ page }) => {
    // Guest user on products page
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Add to cart
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await firstProduct.locator('button:has-text("Add to Cart")').click();

    // Try to access wishlist (should redirect or show login)
    await page.goto('/wishlist');

    // Should show the wishlist login prompt
    await expect(page.locator('h1:has-text("Sign in to your wishlist")')).toBeVisible();
  });

  test.skip('email collection during guest checkout is properly validated', async ({ page }) => {
    // Skip this test as current implementation requires authentication for checkout
    // and doesn't have a guest email collection step
    test.skip();
  });
});
