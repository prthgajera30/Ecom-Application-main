// Ecommerce Application Test Utilities
// ===================================
//
// This file provides reusable helper functions for E2E tests
// to promote consistency, reduce duplication, and ensure maintainability.

import { Page, Locator, expect } from '@playwright/test';

/**
 * User credentials for testing
 */
export const TEST_USERS = {
  default: {
    email: 'user@example.com',
    password: 'password123',
  },
  admin: {
    email: 'admin@example.com',
    password: 'adminpass123',
  },
  guest: {
    email: 'guest@test.com',
  }
};

/**
 * Common selectors and locators used across tests
 */
export const SELECTORS = {
  // Navigation
  navCart: '[data-testid="cart-count"]',
  navSignIn: 'nav a:has-text("Sign In")',
  navUserMenu: '[data-testid="user-menu"]',

  // Products
  productCard: '[data-testid="product-card"]',
  productGrid: '[data-testid="product-grid"]',
  productImage: '[data-testid="product-image"]',
  productName: '[data-testid="product-name"]',
  productPrice: '[data-testid="product-price"]',

  // Cart
  cartItem: '[data-testid="cart-item"]',
  cartCount: '[data-testid="cart-count"]',
  cartTotal: '[data-testid="cart-total"]',
  cartSubtotal: '[data-testid="cart-subtotal"]',

  // Checkout
  checkoutBtn: 'button:has-text("Checkout")',
  completeOrderBtn: 'button:has-text("Complete Order")',

  // Reviews
  reviewCard: '[data-testid="review-card"]',
  reviewForm: '[data-testid="review-form"]',

  // Buttons (common patterns)
  addToCartBtn: 'button:has-text("Add to Cart")',
  removeBtn: 'button:has-text("Remove")',
  submitBtn: 'button[type="submit"]',
  closeBtn: 'button[aria-label*="close" i]',

  // Forms
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  searchInput: 'input[placeholder*="search" i]',

  // Loaders & States
  loadingSpinner: '[data-testid="loading"]',
  emptyState: 'text=/no \\w+|empty/i',
  errorMessage: '[data-testid="error-message"]',

  // Modals & Overlays
  modal: '[role="dialog"]',
  overlay: '[data-testid="overlay"]',
} as const;

/**
 * Test data generation utilities
 */
export class TestDataGenerator {
  static randomEmail(domain = 'test.com') {
    return `test-${Date.now()}@${domain}`;
  }

  static randomString(length = 8) {
    return Math.random().toString(36).substring(2, length + 2);
  }

  static randomProductReview() {
    const reviews = [
      'Great product, highly recommended!',
      'Excellent quality and fast delivery.',
      'Good value for money, will buy again.',
      'Product works as expected, satisfied customer.',
      'Better than expected, thanks for the great service!'
    ];
    return reviews[Math.floor(Math.random() * reviews.length)];
  }
}

/**
 * Authentication helpers
 */
export class AuthHelpers {
  static async loginAsDefaultUser(page: Page) {
    await AuthHelpers.login(page, TEST_USERS.default.email, TEST_USERS.default.password);
  }

  static async login(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.fill(SELECTORS.emailInput, email);
    await page.fill(SELECTORS.passwordInput, password);
    await page.click(SELECTORS.submitBtn);
    await page.waitForLoadState('networkidle');
  }

  static async logout(page: Page) {
    const logoutBtn = page.locator('button:has-text("Sign Out")').or(
      page.locator('button:has-text("Logout")')
    );

    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForLoadState('networkidle');
    }
  }

  static async ensureLoggedIn(page: Page) {
    // Check if already logged in
    const userMenu = page.locator(SELECTORS.navUserMenu);
    if (!(await userMenu.isVisible())) {
      await AuthHelpers.loginAsDefaultUser(page);
    }
  }

  static async ensureLoggedOut(page: Page) {
    // Check if logged in and logout if needed
    const userMenu = page.locator(SELECTORS.navUserMenu);
    if (await userMenu.isVisible()) {
      await AuthHelpers.logout(page);
    }
  }
}

/**
 * Cart management helpers
 */
export class CartHelpers {
  static async getCartCount(page: Page): Promise<number> {
    const cartCountElement = page.locator(SELECTORS.cartCount);
    if (await cartCountElement.isVisible()) {
      const countText = await cartCountElement.textContent();
      return parseInt(countText || '0', 10);
    }
    return 0;
  }

  static async waitForCartUpdate(page: Page, expectedCount: number, timeout = 3000) {
    await page.waitForFunction(
      (expected) => {
        const cartCount = document.querySelector('[data-testid="cart-count"]');
        if (!cartCount) return false;
        const count = parseInt(cartCount.textContent || '0', 10);
        return count === expected;
      },
      expectedCount,
      { timeout }
    );
  }

  static async addFirstProductToCart(page: Page) {
    const firstProduct = page.locator(SELECTORS.productCard).first();
    const addToCartBtn = firstProduct.locator(SELECTORS.addToCartBtn);

    if (await addToCartBtn.isVisible()) {
      await addToCartBtn.click();
      await page.waitForTimeout(500); // Allow for cart state update
      return true;
    }
    return false;
  }

  static async clearCart(page: Page) {
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    const clearCartBtn = page.locator('button:has-text("Clear Cart")');
    if (await clearCartBtn.isVisible()) {
      await clearCartBtn.click();

      // Handle confirmation dialog if present
      const confirmBtn = page.locator('button:has-text("Yes")').or(
        page.locator('button:has-text("Confirm")')
      );
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      await page.waitForTimeout(500);
    }
  }
}

/**
 * Product browsing helpers
 */
export class ProductHelpers {
  static async navigateToProduct(page: Page, productIndex = 0) {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const productLink = page.locator(SELECTORS.productCard).nth(productIndex);
    const productHref = await productLink.getAttribute('href');

    if (productHref) {
      await page.goto(productHref);
      await page.waitForLoadState('networkidle');
      return true;
    }
    return false;
  }

  static async searchForProduct(page: Page, searchTerm: string) {
    const searchInput = page.locator(SELECTORS.searchInput);
    if (await searchInput.isVisible()) {
      await searchInput.fill(searchTerm);
      await searchInput.press('Enter');

      await page.waitForLoadState('networkidle');
      return true;
    }
    return false;
  }

  static async waitForProductsToLoad(page: Page, expectedCount = 1) {
    await page.waitForFunction(
      (expected) => document.querySelectorAll('[data-testid="product-card"]').length >= expected,
      expectedCount,
      { timeout: 10000 }
    );
  }
}

/**
 * Form interaction helpers
 */
export class FormHelpers {
  static async fillCreditCardForm(page: Page, options: {
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
    name?: string;
  } = {}) {
    const defaults = {
      cardNumber: '4111111111111111',
      expiryDate: '12/25',
      cvv: '123',
      name: 'Test User'
    };

    const data = { ...defaults, ...options };

    await page.fill('input[name="cardNumber"]', data.cardNumber);
    await page.fill('input[name="expiryDate"]', data.expiryDate);
    await page.fill('input[name="cvv"]', data.cvv);
    await page.fill('input[name="cardName"]', data.name);
  }

  static async fillShippingForm(page: Page, options: {
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone?: string;
  } = {}) {
    const defaults = {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      phone: '555-0123'
    };

    const data = { ...defaults, ...options };

    await page.fill('input[name="firstName"]', data.firstName);
    await page.fill('input[name="lastName"]', data.lastName);
    await page.fill('input[name="address"]', data.address);
    await page.fill('input[name="city"]', data.city);
    await page.fill('input[name="state"]', data.state);
    await page.fill('input[name="zipCode"]', data.zipCode);
    if (await page.locator('input[name="phone"]').isVisible()) {
      await page.fill('input[name="phone"]', data.phone);
    }
  }
}

/**
 * UI interaction helpers
 */
export class UIHelpers {
  static async waitForLoadingToComplete(page: Page) {
    await page.waitForFunction(() => {
      const loadingElements = document.querySelectorAll('[data-testid="loading"], .loading, .spinner');
      return loadingElements.length === 0;
    }, { timeout: 5000 });
  }

  static async scrollToElement(page: Page, selector: string) {
    const element = page.locator(selector);
    await element.scrollIntoViewIfNeeded();
  }

  static async waitForToast(page: Page, expectedText?: string) {
    const toast = page.locator('[data-testid="toast"]').or(
      page.locator('.toast').or(
        page.locator('text=/success|error|notification/i')
      )
    );

    await expect(toast).toBeVisible();

    if (expectedText) {
      await expect(toast).toContainText(expectedText);
    }

    // Wait for toast to auto-dismiss if it will
    await page.waitForTimeout(1000);
  }

  static async dismissModal(page: Page) {
    const closeBtn = page.locator(SELECTORS.closeBtn);
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Assertion helpers for common patterns
 */
export class AssertionHelpers {
  static async expectErrorMessage(page: Page, expectedText: string) {
    const errorMessage = page.locator(SELECTORS.errorMessage).or(
      page.locator('text=/error|invalid|required/i')
    );
    await expect(errorMessage).toContainText(expectedText);
  }

  static async expectSuccessMessage(page: Page, expectedText = 'success|Success') {
    const successMessage = page.locator('text=/' + expectedText + '/i').or(
      page.locator('[data-testid="success-message"]')
    );
    await expect(successMessage).toBeVisible();
  }

  static async expectPageHeading(page: Page, expectedHeading: string | RegExp) {
    const heading = page.locator('h1').or(page.locator('h2')).first();
    await expect(heading).toContainText(expectedHeading);
  }

  static async expectCartEmpty(page: Page) {
    const emptyCart = page.locator('text="Your cart is empty"').or(
      page.locator('[data-testid="empty-cart"]')
    );
    await expect(emptyCart).toBeVisible();
  }

  static async expectUserLoggedIn(page: Page) {
    const logoutBtn = page.locator('button:has-text("Sign Out")').or(
      page.locator('button:has-text("Logout")')
    );
    await expect(logoutBtn).toBeVisible();
  }

  static async expectUserLoggedOut(page: Page) {
    const signInLink = page.locator(SELECTORS.navSignIn).or(
      page.locator('a:has-text("Sign In")')
    );
    await expect(signInLink).toBeVisible();
  }
}
