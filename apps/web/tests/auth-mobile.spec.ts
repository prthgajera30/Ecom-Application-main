import { test, expect } from '@playwright/test';

test.describe('auth mobile screens', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('login and register forms are responsive', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to continue/i })).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toHaveValue('user@example.com');
    await expect(page.getByPlaceholder('Password')).toHaveAttribute('type', 'password');

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toHaveValue('newuser@example.com');
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });
});
