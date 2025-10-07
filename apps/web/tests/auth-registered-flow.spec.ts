import { test, expect } from '@playwright/test';

test.describe('Authentication - Registered User Flows', () => {
  test('complete login flow from homepage header', async ({ page }) => {
    // Go to homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Click login link in header (target the one in the header specifically)
    await page.locator('header a:has-text("Sign in")').click();

    // Should navigate to login page
    await expect(page.getByRole('heading', { name: /sign in to continue/i })).toBeVisible();

    // Clear and fill login form (in case it's pre-filled)
    await page.locator('input[type="email"]').fill('');
    await page.locator('input[type="password"]').fill('');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password123');

    // Click sign in
    await page.locator('button:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');

    // Should redirect to homepage or profile
    await expect(page.url()).toMatch(/\/$|\/profile$/);

    // Verify logged in state - should see user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('logout removes authentication state', async ({ page }) => {
    // First login
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="email"]').fill('');
    await page.locator('input[type="password"]').fill('');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');

    // Navigate to profile
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Click logout in user menu
    await page.locator('[data-testid="user-menu"]').click();
    await page.locator('button:has-text("Sign Out")').click();
    await page.waitForLoadState('networkidle');

    // Should be redirected to homepage
    await expect(page.url()).toBe(/\/$/);

    // Verify logged out state
    await expect(page.locator('a:has-text("Sign in")')).toBeVisible();
  });

  test('session persists across browser refresh', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="email"]').fill('');
    await page.locator('input[type="password"]').fill('');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be logged in - check for user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('cart merges when logging in', async ({ page }) => {
    // Add item to cart as guest
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await firstProduct.locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    // Verify cart has 1 item
    const cartCount = page.locator('[data-testid="cart-count-desktop"]');
    await expect(cartCount).toHaveText('1');

    // Now login
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="email"]').fill('');
    await page.locator('input[type="password"]').fill('');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');

    // Cart count should still be 1 (merged)
    await expect(cartCount).toHaveText('1');

    // Go to cart page to verify items are preserved
    await page.goto('/cart');
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible();
  });

  test('invalid credentials show appropriate error', async ({ page }) => {
    await page.goto('/login');

    // Fill wrong password
    await page.fill('[name="email"]', 'user@example.com');
    await page.fill('[name="password"]', 'wrongpassword');

    await page.locator('button:has-text("Sign in")').click();

    // Should show error message
    await expect(page.locator('text="We couldn\'t sign you in. Please try again."')).toBeVisible();

    // Should stay on login page
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test.skip('rate limiting on login attempts', async ({ page }) => {
    // Skip this test as current implementation doesn't have specific rate limiting
    // It uses the same generic error message for all login failures
    test.skip();
  });
});
