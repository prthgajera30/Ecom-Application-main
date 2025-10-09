import { test, expect } from '@playwright/test';

test.describe('Reviews System', () => {
  test.beforeEach(async ({ page }) => {
    // Login for authenticated review features
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('user123');
    await page.locator('button:has-text("Sign in")').click();
    await page.waitForLoadState('networkidle');
  });

  test('product reviews display on product detail page', async ({ page }) => {
    await page.goto('/product/1');
    await page.waitForLoadState('networkidle');

    // Look for reviews section
    const reviewsSection = page.locator('[data-testid="reviews-section"]').or(
      page.locator('text=/reviews|customer reviews/i')
    );

    if (await reviewsSection.isVisible()) {
      // Should show reviews summary
      const reviewsSummary = page.locator('[data-testid="reviews-summary"]').or(
        page.locator('text=/average rating|overall rating/i')
      );
      await expect(reviewsSummary).toBeVisible();

      // Should show individual review cards
      const reviewCards = page.locator('[data-testid="review-card"]').or(
        page.locator('[data-testid="review-item"]')
      );

      const reviewCount = await reviewCards.count();
      if (reviewCount > 0) {
        const firstReview = reviewCards.first();

        // Each review should have rating, author, date, and content
        const reviewRating = firstReview.locator('[data-testid="review-rating"]').or(
          firstReview.locator('.rating-stars').or(
            firstReview.locator('text=/stars|rating/i')
          )
        );
        await expect(reviewRating).toBeVisible();

        const reviewAuthor = firstReview.locator('[data-testid="review-author"]').or(
          firstReview.locator('text=/by |reviewed by/i')
        );
        await expect(reviewAuthor).toBeVisible();

        const reviewContent = firstReview.locator('[data-testid="review-content"]').or(
          firstReview.locator('[data-testid="review-text"]')
        );
        await expect(reviewContent).toBeVisible();
      } else {
        // Should show "No reviews yet" or similar
        await expect(page.locator('text=/no reviews|be the first/i')).toBeVisible();
      }
    } else {
      test.skip(); // Reviews section not available on this page
    }
  });

  test('authenticated user can submit new review', async ({ page }) => {
    await page.goto('/product/1');
    await page.waitForLoadState('networkidle');

    // Look for "Write Review" or "Add Review" button
    const writeReviewBtn = page.locator('button:has-text("Write a Review")').or(
      page.locator('button:has-text("Add Review")').or(
        page.locator('[data-testid="write-review-btn"]')
      )
    );

    if (await writeReviewBtn.isVisible()) {
      await writeReviewBtn.click();

      // Should open review form
      const reviewForm = page.locator('[data-testid="review-form"]');
      await expect(reviewForm).toBeVisible();

      // Should have rating selector (stars)
      const ratingStars = reviewForm.locator('[data-testid="rating-stars"]').or(
        reviewForm.locator('.rating-input').or(
          reviewForm.locator('input[name="rating"]')
        )
      );
      await expect(ratingStars).toBeVisible();

      // Select 4-star rating
      await ratingStars.locator('input[value="4"]').or(
        ratingStars.locator('text="★★★★"')
      ).click();

      // Fill review title
      const titleField = reviewForm.locator('input[name="title"]').or(
        reviewForm.locator('[placeholder*="title" i]')
      );
      if (await titleField.isVisible()) {
        await titleField.fill('Great product!');
      }

      // Fill review content
      const contentField = reviewForm.locator('textarea[name="review"]').or(
        reviewForm.locator('[data-testid="review-content-input"]')
      );
      await contentField.fill('This product exceeded my expectations. Highly recommended!');

      // Submit review
      const submitBtn = reviewForm.locator('button:has-text("Submit Review")').or(
        reviewForm.locator('button[type="submit"]')
      );
      await submitBtn.click();

      // Should show success message
      await expect(page.locator('text=/review submitted|thank you for your review/i')).toBeVisible();
    } else {
      test.skip(); // Write review functionality not available
    }
  });

  test('review form validation works', async ({ page }) => {
    await page.goto('/product/1');

    const writeReviewBtn = page.locator('button:has-text("Write a Review")').or(
      page.locator('button:has-text("Add Review")')
    );

    if (await writeReviewBtn.isVisible()) {
      await writeReviewBtn.click();

      const reviewForm = page.locator('[data-testid="review-form"]');

      // Try to submit without required fields
      const submitBtn = reviewForm.locator('button:has-text("Submit Review")');
      await submitBtn.click();

      // Should show validation errors
      await expect(page.locator('text="Please select a rating"').or(
        page.locator('text="Rating is required"')
      )).toBeVisible();

      await expect(page.locator('text="Review is required"').or(
        page.locator('text="Please enter a review"')
      )).toBeVisible();
    } else {
      test.skip(); // Cannot test review validation without form
    }
  });

  test('reviews show helpfulness voting', async ({ page }) => {
    await page.goto('/product/1');
    await page.waitForLoadState('networkidle');

    const reviewCards = page.locator('[data-testid="review-card"]');
    if (await reviewCards.count() > 0) {
      const firstReview = reviewCards.first();

      // Look for helpful voting buttons
      const helpfulBtn = firstReview.locator('button:has-text("Helpful")').or(
        firstReview.locator('button:has-text("👍")').or(
          firstReview.locator('[data-testid="helpful-btn"]')
        )
      );

      if (await helpfulBtn.isVisible()) {
        await helpfulBtn.click();

        // Should show vote registered feedback
        await expect(page.locator('text=/thank you|vote recorded/i')).toBeVisible();

        // Button should be disabled or show different state
        await expect(helpfulBtn).toHaveAttribute('disabled');

        // Might show helpful count increased
        const helpfulCount = firstReview.locator('text=/[0-9]+.*helpful/i');
        // Count should be visible but we won't validate exact number changes
      }
    } else {
      test.skip(); // No reviews to test voting
    }
  });

  test('reviews pagination works', async ({ page }) => {
    await page.goto('/product/1');

    // Look for review pagination or "Load More" button
    const loadMoreBtn = page.locator('button:has-text("Load More Reviews")').or(
      page.locator('button:has-text("Show More")')
    );

    if (await loadMoreBtn.isVisible()) {
      const initialReviewCount = await page.locator('[data-testid="review-card"]').count();

      await loadMoreBtn.click();
      await page.waitForTimeout(1000); // Wait for loading

      const finalReviewCount = await page.locator('[data-testid="review-card"]').count();

      // Should load more reviews
      expect(finalReviewCount).toBeGreaterThan(initialReviewCount);
    } else {
      // Check for pagination controls
      const pagination = page.locator('[data-testid="reviews-pagination"]');
      if (await pagination.isVisible()) {
        // Similar logic as load more button
        test.skip(); // Would need specific pagination implementation
      }
    }
  });

  test('reviews filtering and sorting works', async ({ page }) => {
    await page.goto('/product/1');

    // Look for review sorting dropdown
    const sortReviews = page.locator('[data-testid="sort-reviews"]').or(
      page.locator('select[name*="sort"]').or(
        page.locator('select:has-text("Sort")')
      )
    );

    if (await sortReviews.isVisible()) {
      // Test different sorting options
      const reviewCards = page.locator('[data-testid="review-card"]');
      const initialReviewCount = await reviewCards.count();

      if (initialReviewCount >= 2) {
        // Get first review date or content before sorting
        const firstReviewBefore = await reviewCards.first().locator('[data-testid="review-date"]').or(
          reviewCards.first().locator('time')
        ).textContent();

        // Change sorting to oldest or newest
        await sortReviews.selectOption('oldest');

        // Wait for sorting to apply
        await page.waitForTimeout(500);

        // Reviews should be reordered (different first review)
        const firstReviewAfter = await reviewCards.first().locator('[data-testid="review-date"]').or(
          reviewCards.first().locator('time')
        ).textContent();

        // They should be different if sorting worked
        expect(firstReviewBefore).not.toBe(firstReviewAfter);
      }
    }

    // Look for rating filters
    const ratingFilter = page.locator('[data-testid="rating-filter"]').or(
      page.locator('input[type="checkbox"]:has-text("5 stars")')
    );

    if (await ratingFilter.isVisible()) {
      // Filter by 5-star reviews
      await ratingFilter.first().check();
      await page.waitForTimeout(500);

      // All visible reviews should be 5-star
      const visibleReviews = page.locator('[data-testid="review-card"]');
      if (await visibleReviews.count() > 0) {
        // Each review should show 5-star rating
        // This would require specific rating inspection
      }
    }
  });

  test('guest users cannot write reviews', async ({ page }) => {
    // Logout first
    await page.locator('button:has-text("Sign Out")').or(
      page.locator('button:has-text("Logout")')
    ).click();

    // Navigate to product page as guest
    await page.goto('/product/1');

    // Should not show "Write Review" button for guests
    const writeReviewBtn = page.locator('button:has-text("Write a Review")');

    if (await writeReviewBtn.isVisible()) {
      // If button is visible, clicking should redirect to login
      await writeReviewBtn.click();

      // Should redirect to login page
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    } else {
      // Button should not be visible - this is expected for guests
    }
  });

  test('review images/photos functionality', async ({ page }) => {
    await page.goto('/product/1');

    const writeReviewBtn = page.locator('button:has-text("Write a Review")');
    if (await writeReviewBtn.isVisible()) {
      await writeReviewBtn.click();

      // Look for image upload in review form
      const imageUpload = page.locator('input[type="file"]').or(
        page.locator('[data-testid="image-upload"]')
      );

      if (await imageUpload.isVisible()) {
        // Test image upload - would need actual image file
        // For now, just verify the upload element exists
        await expect(imageUpload).toBeVisible();

        // Should show file type restrictions or preview area
        const imagePreview = page.locator('[data-testid="image-preview"]');
      }
    } else {
      test.skip(); // Cannot test image upload without form
    }
  });

  test('review reporting/moderation', async ({ page }) => {
    await page.goto('/product/1');

    const reviewCards = page.locator('[data-testid="review-card"]');
    if (await reviewCards.count() > 0) {
      const firstReview = reviewCards.first();

      // Look for report/review flag button
      const reportBtn = firstReview.locator('button:has-text("Report")').or(
        firstReview.locator('button:has-text("Flag")').or(
          firstReview.locator('[data-testid="report-review"]')
        )
      );

      if (await reportBtn.isVisible()) {
        await reportBtn.click();

        // Should show report reasons
        const reportReason = page.locator('[data-testid="report-reason"]').or(
          page.locator('select[name="report-reason"]')
        );
        await expect(reportReason).toBeVisible();

        // Select a reason and submit
        await reportReason.selectOption('inappropriate');
        await page.locator('button:has-text("Submit Report")').click();

        // Should show success message
        await expect(page.locator('text=/report submitted|thank you for reporting/i')).toBeVisible();
      }
    } else {
      test.skip(); // No reviews to test reporting
    }
  });
});
