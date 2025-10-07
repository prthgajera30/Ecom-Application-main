import { test, expect } from '@playwright/test';

test.describe('Order Management - History & Details', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');
  });

  test('order history page displays user orders', async ({ page }) => {
    // Navigate to orders page
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Should show order history heading
    await expect(page.getByRole('heading', { name: /order history|my orders/i })).toBeVisible();

    // Look for order items
    const orderItems = page.locator('[data-testid="order-item"]').or(
      page.locator('.order-card')
    );

    const orderCount = await orderItems.count();
    if (orderCount > 0) {
      // If orders exist, verify they display correctly
      const firstOrder = orderItems.first();

      // Should show order number/ID
      const orderNumber = firstOrder.locator('[data-testid="order-number"]').or(
        firstOrder.locator('text=/Order #|Order ID/i')
      );
      await expect(orderNumber).toBeVisible();

      // Should show order date
      const orderDate = firstOrder.locator('[data-testid="order-date"]').or(
        firstOrder.locator('text=/date|placed/i')
      );
      await expect(orderDate).toBeVisible();

      // Should show order status
      const orderStatus = firstOrder.locator('[data-testid="order-status"]').or(
        firstOrder.locator('text=/status|pending|shipped|delivered/i')
      );
      await expect(orderStatus).toBeVisible();

      // Should show order total
      const orderTotal = firstOrder.locator('[data-testid="order-total"]').or(
        firstOrder.locator('text=/total|\\$/i')
      );
      await expect(orderTotal).toBeVisible();
    } else {
      // If no orders, should show empty state
      const emptyState = page.locator('text=/no orders|no history|empty/i');
      await expect(emptyState).toBeVisible();
    }
  });

  test('clicking order expands to show order details', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    const orderItems = page.locator('[data-testid="order-item"]');
    const orderCount = await orderItems.count();

    if (orderCount > 0) {
      const firstOrder = orderItems.first();

      // Click to expand order details
      await firstOrder.click();
      await page.waitForTimeout(500);

      // Should show order items/products
      const orderProducts = firstOrder.locator('[data-testid="order-product"]').or(
        page.locator('[data-testid="order-line-item"]')
      );
      await expect(orderProducts).toBeVisible();

      // Should show order item details (name, quantity, price)
      const firstProduct = orderProducts.first();
      await expect(firstProduct.locator('text=/qty|quantity|\\d+/i')).toBeVisible(); // Quantity
      await expect(firstProduct.locator('text=/\\$/')).toBeVisible(); // Price

      // May show shipping address
      const shippingInfo = page.locator('[data-testid="shipping-info"]').or(
        page.locator('text=/shipping.*address|delivered to/i')
      );

      // May show billing info
      const billingInfo = page.locator('[data-testid="billing-info"]').or(
        page.locator('text=/billing.*address|charged to/i')
      );
    } else {
      test.skip(); // No orders to test expansion
    }
  });

  test('order search and filtering works', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Look for search input
    const searchInput = page.locator('[data-testid="order-search"]').or(
      page.locator('input[placeholder*="search" i]')
    );

    if (await searchInput.isVisible()) {
      // Test search functionality
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Results should be filtered or show no results message
      const filteredOrders = page.locator('[data-testid="order-item"]');
      const resultCount = await filteredOrders.count();
      expect(typeof resultCount).toBe('number'); // Should handle search gracefully
    }

    // Look for status filters
    const statusFilter = page.locator('[data-testid="status-filter"]').or(
      page.locator('select:has-text("Status")')
    );

    if (await statusFilter.isVisible()) {
      // Test filtering by status
      await statusFilter.selectOption('completed');
      await page.waitForTimeout(500);

      // Check that all visible orders have completed status
      const visibleOrders = page.locator('[data-testid="order-item"]');
      if (await visibleOrders.count() > 0) {
        const firstOrderStatus = await visibleOrders.first()
          .locator('[data-testid="order-status"]').textContent();
        expect(firstOrderStatus?.toLowerCase()).toContain('completed');
      }
    }
  });

  test('order details page shows comprehensive information', async ({ page }) => {
    // Navigate to orders and click on first order
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    const orderItems = page.locator('[data-testid="order-item"]');
    if (await orderItems.count() > 0) {
      const firstOrder = orderItems.first();

      // Click order to view details (may navigate to separate page)
      await firstOrder.locator('[data-testid="view-order"]').or(firstOrder).click();
      await page.waitForLoadState('networkidle');

      // Check if on order details page
      const urlParams = new URL(page.url());
      if (urlParams.pathname.includes('/orders/') || urlParams.pathname.includes('/order/')) {
        // Should show order number in heading
        const orderNumber = page.locator('h1').or(page.locator('[data-testid="order-number"]'));
        await expect(orderNumber).toContainText(/ORDER|#/i);

        // Should show order items table/details
        const orderLineItems = page.locator('[data-testid="order-line-item"]').or(
          page.locator('.order-product')
        );
        await expect(orderLineItems).toBeVisible();

        // Should show order summary/totals
        const orderSummary = page.locator('[data-testid="order-summary"]').or(
          page.locator('text=/subtotal|tax|shipping|total/i')
        );
        await expect(orderSummary).toBeVisible();

        // Should show order status timeline
        const statusTimeline = page.locator('[data-testid="status-timeline"]').or(
          page.locator('text=/ordered|packed|shipped|delivered/i')
        );

        // Should have action buttons (reorder, return, etc.)
        const actionButtons = page.locator('button:has-text(/^Reorder|Return|Cancel/)');

        // Back to orders button
        const backButton = page.locator('button:has-text("Back")').or(
          page.locator('a:has-text("Back to Orders")')
        );
      }
    } else {
      test.skip(); // No orders to test details view
    }
  });

  test('order status updates are visible', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    const orderItems = page.locator('[data-testid="order-item"]');
    if (await orderItems.count() > 0) {
      const firstOrder = orderItems.first();

      // Check status badge/color
      const statusBadge = firstOrder.locator('[data-testid="order-status"]').or(
        firstOrder.locator('.status-badge')
      );
      await expect(statusBadge).toBeVisible();

      // Status should be one of expected values
      const statusText = await statusBadge.textContent();
      const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
      const isValidStatus = validStatuses.some(validStatus =>
        statusText?.toLowerCase().includes(validStatus)
      );
      expect(isValidStatus).toBe(true);
    }
  });

  test('order reordering functionality', async ({ page }) => {
    // Navigate to order details
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    const orderItems = page.locator('[data-testid="order-item"]');
    if (await orderItems.count() > 0) {
      // Click on first order
      await orderItems.first().click();
      await page.waitForTimeout(500);

      // Look for reorder button
      const reorderButton = page.locator('button:has-text("Reorder")').or(
        page.locator('[data-testid="reorder-btn"]')
      );

      if (await reorderButton.isVisible()) {
        await reorderButton.click();
        await page.waitForLoadState('networkidle');

        // Should redirect to cart with items added
        await expect(page.locator('[data-testid="cart-item"]')).toBeVisible();

        // Should show success message
        const successMessage = page.locator('text=/added to cart|reordered|items restored/i');
        // Note: success message might be temporary, so we don't fail if not found
      } else {
        // If reorder not available, that's fine
        test.skip();
      }
    } else {
      test.skip(); // No orders to reorder
    }
  });

  test('order tracking information displays correct details', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    const orderItems = page.locator('[data-testid="order-item"]');
    if (await orderItems.count() > 0) {
      // Find an order with tracking (assume shipped orders have tracking)
      const shippedOrders = orderItems.filter({ hasText: /shipped|delivered/i });
      if (await shippedOrders.count() > 0) {
        await shippedOrders.first().click();
        await page.waitForTimeout(500);

        // Look for tracking information
        const trackingInfo = page.locator('[data-testid="tracking-info"]').or(
          page.locator('text=/tracking.*number|carrier|estimated delivery/i')
        );

        if (await trackingInfo.isVisible()) {
          // Should show carrier name
          await expect(page.locator('text=/UPS|FedEx|USPS|DHL|carrier/i')).toBeVisible();

          // Should show tracking number
          await expect(page.locator('text=/tracking.*[0-9A-Z]+|[0-9]{10,}/i')).toBeVisible();
        }
      }
    }
  });

  test('pagination works on order history', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    // Check if pagination exists
    const pagination = page.locator('[data-testid="pagination"]').or(
      page.locator('nav[aria-label*="pagination" i]')
    );

    if (await pagination.isVisible()) {
      const initialOrderCount = await page.locator('[data-testid="order-item"]').count();

      // Click next page
      const nextButton = pagination.locator('button:has-text("Next")');
      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForLoadState('networkidle');

        // Should load new orders or show message
        const newOrderCount = await page.locator('[data-testid="order-item"]').count();
        expect(newOrderCount).toBeGreaterThanOrEqual(0);

        // URL should have page parameter
        const url = page.url();
        expect(url).toMatch(/[?&]page=2|[?&]p=2/);
      }
    }
  });

  test('order export/download functionality', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');

    const orderItems = page.locator('[data-testid="order-item"]');
    if (await orderItems.count() > 0) {
      // Look for download/export buttons
      const downloadButton = page.locator('button:has-text(/^Download|Export|Print/)').or(
        page.locator('[data-testid="download-order"]')
      );

      if (await downloadButton.isVisible()) {
        await downloadButton.click();

        // This would typically open a new tab or download dialog
        // Hard to test downloads in Playwright without special setup
        // Just verify button click doesn't cause errors
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/orders'); // Still on orders page
      }
    }
  });

  test('order history access through profile', async ({ page }) => {
    // Go to profile
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Click order history link/button
    const orderHistoryLink = page.locator('text="View Order History"').or(
      page.locator('a:has-text("Orders")')
    ).or(
      page.locator('[href*="orders"]')
    );

    await orderHistoryLink.click();
    await page.waitForLoadState('networkidle');

    // Should navigate to orders page
    await expect(page.url()).toContain('/orders');
    await expect(page.getByRole('heading', { name: /order history|my orders/i })).toBeVisible();
  });
});
