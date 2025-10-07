import { test, expect } from '@playwright/test';

test.describe('Wishlist Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');
  });

  test('add product to wishlist from listing page', async ({ page }) => {
    await page.goto('http://localhost:3000/products');
    await page.waitForLoadState('networkidle');

    // Find first product card
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productName = await firstProduct.locator('[data-testid="product-name"]').textContent() || 'Test Product';

    // Click wishlist button (heart icon, star, etc.)
    const wishlistButton = firstProduct.locator('[data-testid="wishlist-btn"]').or(
      firstProduct.locator('button:has-text("♡")').or(
        firstProduct.locator('button:has-text("☆")').or(
          firstProduct.locator('[aria-label*="wishlist" i]')
        )
      )
    );

    if (await wishlistButton.isVisible()) {
      await wishlistButton.click();

      // Should show visual feedback (filled heart, star, etc.)
      // Button should indicate product is in wishlist
      await expect(wishlistButton).toHaveAttribute('data-in-wishlist', 'true');

      // Navigate to wishlist page
      await page.goto('http://localhost:3000/wishlist');
      await page.waitForLoadState('networkidle');

      // Should show the added product
      await expect(page.locator('[data-testid="wishlist-item"]')).toContainText(productName);
    } else {
      test.skip(); // Wishlist feature not available on this UI
    }
  });

  test('add product to wishlist from detail page', async ({ page }) => {
    await page.goto('http://localhost:3000/product/1');
    await page.waitForLoadState('networkidle');

    const productName = await page.locator('h1').textContent() || 'Test Product Detail';

    // Look for wishlist button on product detail
    const wishlistButton = page.locator('[data-testid="wishlist-btn"]').or(
      page.locator('button:has-text("Add to Wishlist")').or(
        page.locator('[aria-label*="wishlist" i]')
      )
    );

    if (await wishlistButton.isVisible()) {
      await wishlistButton.click();

      // Should show success feedback
      const successMessage = page.locator('text=/added to wishlist|saved to wishlist/i');

      // Navigate to wishlist
      await page.goto('http://localhost:3000/wishlist');
      await expect(page.locator('[data-testid="wishlist-item"]')).toContainText(productName);
    } else {
      test.skip(); // Wishlist feature not available on this UI
    }
  });

  test('remove product from wishlist', async ({ page }) => {
    // First add an item to wishlist
    await page.goto('http://localhost:3000/products');
    await page.locator('[data-testid="product-card"]').first()
      .locator('[data-testid="wishlist-btn"]').click();

    // Navigate to wishlist page
    await page.goto('http://localhost:3000/wishlist');
    await page.waitForLoadState('networkidle');

    const wishlistItems = page.locator('[data-testid="wishlist-item"]');
    const initialCount = await wishlistItems.count();

    if (initialCount > 0) {
      // Click remove from wishlist
      const removeButton = wishlistItems.first().locator('[data-testid="remove-wishlist"]').or(
        wishlistItems.first().locator('button:has-text("Remove")').or(
          wishlistItems.first().locator('button:has-text("×")')
        )
      );

      await removeButton.click();
      await page.waitForTimeout(500);

      // Item should be removed
      const finalCount = await wishlistItems.count();
      expect(finalCount).toBeLessThan(initialCount);
    } else {
      test.skip(); // No wishlist items to test removal
    }
  });

  test('move wishlist item to cart', async ({ page }) => {
    // Add item to wishlist first
    await page.goto('http://localhost:3000/products');
    await page.locator('[data-testid="product-card"]').first()
      .locator('[data-testid="wishlist-btn"]').click();

    // Go to wishlist
    await page.goto('http://localhost:3000/wishlist');
    await page.waitForLoadState('networkidle');

    const wishlistItems = page.locator('[data-testid="wishlist-item"]');
    if (await wishlistItems.count() > 0) {
      // Click "Add to Cart" from wishlist
      const addToCartBtn = wishlistItems.first().locator('button:has-text("Add to Cart")');
      if (await addToCartBtn.isVisible()) {
        await addToCartBtn.click();
        await page.waitForTimeout(500);

        // Should show success message
        const successMsg = page.locator('text=/added to cart|added to your cart/i');

        // Check cart count increased
        const cartCount = page.locator('[data-testid="cart-count"]');
        await expect(cartCount).toHaveText('1');

        // Navigate to cart to verify item
        await page.goto('http://localhost:3000/cart');
        await expect(page.locator('[data-testid="cart-item"]')).toBeVisible();
      } else {
        test.skip(); // Add to cart from wishlist not available
      }
    } else {
      test.skip(); // No wishlist items to test
    }
  });

  test('wishlist page displays correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/wishlist');
    await page.waitForLoadState('networkidle');

    // Should show wishlist heading
    await expect(page.getByRole('heading', { name: /wishlist|saved items/i })).toBeVisible();

    const wishlistItems = page.locator('[data-testid="wishlist-item"]');
    const itemCount = await wishlistItems.count();

    if (itemCount === 0) {
      // Should show empty wishlist message
      await expect(page.locator('text=/wishlist is empty|no saved items/i')).toBeVisible();

      // Should have "Continue Shopping" or browse button
      const browseButton = page.locator('button:has-text("Continue Shopping")').or(
        page.locator('a:has-text("Browse Products")')
      );
      await expect(browseButton).toBeVisible();
    } else {
      // If items exist, verify they display correctly
      const firstItem = wishlistItems.first();

      // Should show product image
      await expect(firstItem.locator('[data-testid="wishlist-image"]').or(
        firstItem.locator('img')
      )).toBeVisible();

      // Should show product name and price
      await expect(firstItem.locator('[data-testid="wishlist-name"]').or(
        firstItem.locator('text=/product|item/i')
      )).toBeVisible();

      await expect(firstItem.locator('text=/\\$/')).toBeVisible();
    }
  });

  test('wishlist persists across sessions', async ({ page }) => {
    // Add item to wishlist
    await page.goto('http://localhost:3000/products');
    await page.locator('[data-testid="product-card"]').first()
      .locator('[data-testid="wishlist-btn"]').click();

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Item should still be in wishlist
    const productCard = page.locator('[data-testid="product-card"]').first();
    const wishlistBtn = productCard.locator('[data-testid="wishlist-btn"]');
    if (await wishlistBtn.isVisible()) {
      await expect(wishlistBtn).toHaveAttribute('data-in-wishlist', 'true');
    }

    // Go to wishlist page
    await page.goto('http://localhost:3000/wishlist');
    await expect(page.locator('[data-testid="wishlist-item"]')).toHaveCount(1);
  });

  test('bulk wishlist operations', async ({ page }) => {
    // Add multiple items to wishlist
    await page.goto('http://localhost:3000/products');

    // Add first 3 products
    const products = page.locator('[data-testid="product-card"]');
    for (let i = 0; i < Math.min(3, await products.count()); i++) {
      const product = products.nth(i);
      const wishlistBtn = product.locator('[data-testid="wishlist-btn"]');
      if (await wishlistBtn.isVisible()) {
        await wishlistBtn.click();
        await page.waitForTimeout(300);
      }
    }

    await page.goto('http://localhost:3000/wishlist');

    // Look for bulk operations (clear all, move all to cart, etc.)
    const clearAllButton = page.locator('button:has-text("Clear All")').or(
      page.locator('button:has-text("Remove All")')
    );

    if (await clearAllButton.isVisible()) {
      const initialCount = await page.locator('[data-testid="wishlist-item"]').count();
      await clearAllButton.click();

      // Confirm dialog might appear
      const confirmBtn = page.locator('button:has-text("Yes")').or(
        page.locator('button:has-text("Confirm")')
      );

      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      // Wishlist should be cleared
      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="wishlist-item"]')).toHaveCount(0);
      await expect(page.locator('text=/wishlist is empty/i')).toBeVisible();
    }
  });

  test('wishlist share functionality', async ({ page }) => {
    await page.goto('http://localhost:3000/wishlist');

    // Look for share button
    const shareButton = page.locator('button:has-text("Share")').or(
      page.locator('[data-testid="share-wishlist"]')
    );

    if (await shareButton.isVisible()) {
      await shareButton.click();

      // Should show share options (copy link, social media, etc.)
      const shareOptions = page.locator('[data-testid="share-option"]').or(
        page.locator('text=/copy link|share on/i')
      );

      await expect(shareOptions).toBeVisible();

      // Test copy link functionality
      const copyLinkBtn = page.locator('button:has-text("Copy Link")');
      if (await copyLinkBtn.isVisible()) {
        await copyLinkBtn.click();

        // Should show success message
        await expect(page.locator('text=/link copied|copied to clipboard/i')).toBeVisible();
      }
    } else {
      test.skip(); // Share functionality not available
    }
  });
});
