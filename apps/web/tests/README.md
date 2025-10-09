# Ecommerce Application E2E Tests

This directory contains comprehensive End-to-End (E2E) tests for the ecommerce application using Playwright.

## Test Structure Overview

### Current Coverage (30 tests across 5 modules)

#### Phase 1: Core User Journeys ✅ (Completed)
- **Authentication**: Guest and registered user flows, profile management
- **Cart Management**: Add/remove items, quantity updates, persistence
- **Checkout**: Complete order flows for both guest and registered users

#### Phase 2: Enhanced Features (Planned)
- Product catalog browsing, search, and filtering
- Order management and history
- Wishlist functionality
- Review system
- Admin panel operations

#### Phase 3: Edge Cases & Reliability (Planned)
- Mobile responsiveness
- Error handling
- Performance benchmarks
- Accessibility testing

## Test Files Created

### **Phase 1: Core User Journeys** ✅
#### Authentication Tests
- **`auth-guest-flow.spec.ts`** (4 tests): Guest user registration, cart preservation, feature access control
- **`auth-registered-flow.spec.ts`** (6 tests): Login/logout, session management, cart merging, validation
- **`auth-profile.spec.ts`** (8 tests): Profile updates, password changes, address management

#### Commerce Core Tests
- **`cart-management.spec.ts`** (9 tests): Add/remove items, quantity updates, totals calculation, persistence
- **`checkout-guest.spec.ts`** (8 tests): Guest checkout flow, validation, accessibility
- **`checkout-registered.spec.ts`** (7 tests): Registered user checkout, saved payment/address, validation

### **Phase 2: Enhanced Features** ✅
#### Product Discovery Tests
- **`catalog-browse.spec.ts`** (9 tests): Homepage display, pagination, sorting, responsive design, lazy loading

#### Social Commerce Tests
- **`orders-history.spec.ts`** (10 tests): Order display, details expansion, search/filtering, status tracking, reordering, tracking info
- **`wishlist-management.spec.ts`** (8 tests): Wishlist add/remove, sharing, cart integration, persistence, bulk operations
- **`reviews-system.spec.ts`** (10 tests): Review display, submission, moderation, voting, filtering

### **Test Infrastructure**
- **`utils/test-helpers.ts`**: Comprehensive utility library with helpers for all modules

### Existing Tests (Baseline)
- `smoke.spec.ts`: Basic home page load
- `home-personalization.spec.ts`: Homepage recommendations
- `price-filter.spec.ts`: Price filtering
- `product-variants.spec.ts`: Variant selection
- `mobile-navigation.spec.ts`: Mobile navigation
- `auth-mobile.spec.ts`: Mobile auth forms

## Running Tests

### Prerequisites
Ensure all services are running:
```bash
# Start all services
pnpm run dev

# Or individually:
pnpm run dev:api    # Port 4000
pnpm run dev:web    # Port 3000
pnpm run dev:recs   # Port 5000
```

### Run Specific Test Modules
```bash
# Run all authentication tests
npx playwright test tests/auth-*.spec.ts

# Run core user journey tests (recommended for CI)
npx playwright test tests/auth-guest-flow.spec.ts tests/auth-registered-flow.spec.ts tests/cart-management.spec.ts tests/checkout-*.spec.ts

# Run specific test file
npx playwright test tests/checkout-guest.spec.ts

# Run specific test
npx playwright test tests/auth-guest-flow.spec.ts --grep "complete guest checkout"
```

### Test Execution Options
```bash
# Generate report
npx playwright test --reporter=html

# Run in headed mode (see browser)
npx playwright test --headed

# Run tests in parallel
npx playwright test --workers=4

# Run with tracing
npx playwright test --trace=on
```

### Mobile Testing
```bash
# Run tests with mobile viewport
npx playwright test --config=playwright.mobile.config.ts
```

## Test Data & Environment

### Test Users
- **Email**: `user@example.com`
- **Password**: `user123`
- **Guest Email**: `guest@example.com`

### Seeded Data Requirements
Tests assume the application has:
- Sample products in catalog
- Working user authentication
- Functional cart and checkout flows
- Order processing capability

### Environment Variables
Ensure `.env.local` contains required API keys, database URLs, and service endpoints.

## Continuous Integration

### GitHub Actions Workflow (Recommended)
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Setup test environment
        run: |
          docker-compose up -d
          pnpm run db:migrate
          pnpm run db:seed

      - name: Run E2E tests (Phase 1)
        run: |
          cd apps/web
          npx playwright test tests/auth-guest-flow.spec.ts tests/auth-registered-flow.spec.ts tests/cart-management.spec.ts tests/checkout-*.spec.ts

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: apps/web/test-results/
```

### Local Docker Testing
```bash
# Run tests against Docker services
docker-compose up -d
pnpx playwright test
```

## Writing New Tests

### Test Structure Guidelines
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup code (login, navigate, etc.)
  });

  test('should perform specific action', async ({ page }) => {
    // Arrange: Set up test data/scenario
    await page.goto('/some-page');

    // Act: Perform the action
    await page.click('button');

    // Assert: Verify expected outcome
    await expect(page.locator('result')).toBeVisible();
  });
});
```

### Best Practices
1. **Use semantic locators**: Prefer text/role-based selectors over fragile CSS selectors
2. **Handle async operations**: Use `waitForLoadState()` and `waitForTimeout()` appropriately
3. **Test realistic scenarios**: Focus on user journeys rather than isolated component testing
4. **Include cleanup**: Ensure tests don't leave residues that affect other tests
5. **Use data-testid attributes**: Add these to components for stable test selectors

### Common Patterns
```typescript
// Login helper
async function loginUser(page: Page, email: string = 'user@example.com') {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', 'user123');
  await page.click('button:has-text("Sign In")');
  await page.waitForLoadState('networkidle');
}

// Add to cart helper
async function addToCart(page: Page, productIndex: number = 0) {
  await page.goto('/products');
  await page.locator('[data-testid="product-card"]').nth(productIndex)
    .locator('button:has-text("Add to Cart")').click();
  await page.waitForTimeout(500);
}
```

## Debugging Tests

### Common Issues
1. **Timing issues**: Add `page.waitForTimeout(500)` for cart updates
2. **Locator errors**: Use Playwright's locator debugging features
3. **State conflicts**: Ensure proper test isolation

### Debug Commands
```bash
# Run tests with debugging
npx playwright test --debug

# Codegen to generate test locators
npx playwright codegen http://localhost:3000

# Show traces on failure
npx playwright show-trace test-results/trace.zip
```

## Test Coverage Goals

- **Phase 1** (Current): 100% core user journeys
- **Phase 2**: +50 additional tests for enhanced features
- **Phase 3**: +30 tests for edge cases and reliability
- **Total Target**: 110+ comprehensive E2E tests

## Contributing

When adding new tests:
1. Follow the directory structure and naming conventions
2. Add appropriate test descriptions
3. Include both positive and negative test cases
4. Update this README with new test files
5. Ensure tests run in CI before merging
