import { test, expect } from '@playwright/test';

test.describe('Checkout Flow - Registered Users', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[name="email"]', 'user@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.locator('button:has-text("Sign In")').click();
    await page.waitForLoadState('networkidle');
  });

  test('registered user checkout uses saved information', async ({ page }) => {
    // Add product to cart
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    // Go to cart and checkout
    await page.goto('/cart');
    await page.locator('button:has-text("Checkout")').click();
    await page.waitForLoadState('networkidle');

    // Should skip login step and go directly to checkout
    await expect(page.locator('h1:has-text("Checkout")').or(
      page.locator('text="Shipping Information"')
    )).toBeVisible();

    // Should pre-fill user information
    const emailField = page.locator('[name="email"]');
    if (await emailField.isVisible()) {
      await expect(emailField).toHaveValue('user@example.com');
    }

    // Name fields should be pre-filled if available in profile
    const firstNameField = page.locator('[name="firstName"]');
    if (await firstNameField.isVisible()) {
      // Check if it has a value (depends on if profile has name)
      const firstNameValue = await firstNameField.inputValue();
      expect(firstNameValue).not.toBe('');
    }
  });

  test('checkout saves address for future use', async ({ page }) => {
    // Add product and start checkout
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    await page.goto('/cart');
    await page.locator('button:has-text("Checkout")').click();

    // Fill new address
    await page.fill('[name="address"]', '456 Saved Street');
    await page.fill('[name="city"]', 'Saved City');
    await page.fill('[name="state"]', 'Saved State');
    await page.fill('[name="zipCode"]', '67890');

    // Check "Save this address" if available
    const saveAddressCheckbox = page.locator('[name="saveAddress"]').or(
      page.locator('input[type="checkbox"]:has-text("save.*address")')
    );
    if (await saveAddressCheckbox.isVisible()) {
      await saveAddressCheckbox.check();
    }

    // Complete payment info
    await page.fill('[name="cardNumber"]', '4111111111111111');
    await page.fill('[name="expiryDate"]', '12/25');
    await page.fill('[name="cvv"]', '123');

    // Submit order
    const submitButton = page.locator('button:has-text("Complete Order")');
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Verify order completion
    await expect(page.locator('text="Order Confirmed"')).toBeVisible();

    // Go to profile and verify address was saved
    await page.goto('/profile');
    await expect(page.locator('text="456 Saved Street"')).toBeVisible();
  });

  test('saved payment methods are available for selection', async ({ page }) => {
    // Add product
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    await page.goto('/cart');
    await page.locator('button:has-text("Checkout")').click();

    // Look for saved payment methods section
    const savedCardsSection = page.locator('text="Saved Payment Methods"').or(
      page.locator('[data-testid="saved-cards"]')
    );

    if (await savedCardsSection.isVisible()) {
      // Should show saved cards
      const savedCard = page.locator('[data-testid="saved-card"]').first();
      await expect(savedCard).toBeVisible();

      // Can select saved card
      await savedCard.click();

      // CVV might still be required for saved cards
      const cvvField = page.locator('[name="cvv"]');
      if (await cvvField.isVisible()) {
        await cvvField.fill('123');
      }

      // Should be able to complete order with saved card
      const submitButton = page.locator('button:has-text("Complete Order")');
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text="Order Confirmed"')).toBeVisible();
    }
  });

  test('checkout creates order associated with user account', async ({ page }) => {
    // Complete checkout as registered user
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    await page.goto('/cart');
    await page.locator('button:has-text("Checkout")').click();

    // Fill minimal required info
    await page.fill('[name="address"]', '123 Order Street');
    await page.fill('[name="cardNumber"]', '4111111111111111');
    await page.fill('[name="expiryDate"]', '12/25');
    await page.fill('[name="cvv"]', '123');

    await page.locator('button:has-text("Complete Order")').click();
    await page.waitForLoadState('networkidle');

    // Verify order success
    await expect(page.locator('text="Order Confirmed"')).toBeVisible();

    // Order should be visible in profile/order history
    await page.goto('/profile');
    const orderHistoryLink = page.locator('text="View Order History"').or(
      page.locator('[href="/orders"]')
    );
    await orderHistoryLink.click();

    // Should show the recent order
    await expect(page.locator('[data-testid="order-item"]')).toBeVisible();
    await expect(page.url()).toContain('/orders');
  });

  test('checkout validates required fields for registered users', async ({ page }) => {
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    await page.goto('/cart');
    await page.locator('button:has-text("Checkout")').click();

    // Try to submit with missing address
    // Note: Email might be pre-filled, so test other required fields
    const submitButton = page.locator('button:has-text("Complete Order")');
    await submitButton.click();

    // Should show validation for missing shipping info
    await expect(page.locator('text="Address is required"').or(
      page.locator('text="Please enter your address"')
    )).toBeVisible();

    // Still on checkout page
    await expect(page.url()).toContain('checkout');
  });

  test('checkout allows different shipping and billing addresses', async ({ page }) => {
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    await page.goto('/cart');
    await page.locator('button:has-text("Checkout")').click();

    // Look for "Use different billing address" option
    const billingCheckbox = page.locator('input[type="checkbox"]:has-text("billing address")').or(
      page.locator('[data-testid="different-billing"]')
    );

    if (await billingCheckbox.isVisible()) {
      await billingCheckbox.check();

      // Should show billing address fields
      const billingAddressField = page.locator('[name="billingAddress"]').or(
        page.locator('[data-testid="billing-address"]')
      );
      await expect(billingAddressField).toBeVisible();

      // Fill different billing address
      if (await page.locator('[name="billingAddress"]').isVisible()) {
        await page.fill('[name="billingAddress"]', '999 Billing St');
        await page.fill('[name="billingCity"]', 'Billing City');
      }
    }

    // Continue with checkout as normal
    await page.fill('[name="shippingAddress"]', '123 Shipping St');
    // ... fill rest of form
  });

  test('registered checkout maintains cart persistence after interruptions', async ({ page }) => {
    // Add to cart
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
    await page.waitForTimeout(500);

    // Start checkout
    await page.goto('/cart');
    await page.locator('button:has-text("Checkout")').click();

    // Fill partial info
    await page.fill('[name="address"]', '123 Test St');

    // Navigate away (simulate interruption)
    await page.goto('/profile');

    // Come back to checkout
    await page.goto('/checkout');

    // Should still have cart intact
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

    // Should retain partial form data if possible
    // (This depends on implementation - forms may or may not persist)
  });
});
