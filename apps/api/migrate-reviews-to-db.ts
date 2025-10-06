#!/usr/bin/env tsx

import { prisma } from './src/db';
import fs from 'fs';
import path from 'path';

async function migrateReviewsToDb() {
  console.log('Starting review migration from JSON file to database...');

  try {
    // Read the current reviews from the JSON file
    const reviewsDir = path.join(process.cwd(), 'apps/api/data');
    const reviewsPath = path.join(reviewsDir, 'reviews.json');

    if (!fs.existsSync(reviewsPath)) {
      console.log('No reviews.json file found. Nothing to migrate.');
      return;
    }

    const reviewsData = JSON.parse(fs.readFileSync(reviewsPath, 'utf-8'));
    const reviews = reviewsData.reviews || [];

    if (reviews.length === 0) {
      console.log('No reviews to migrate.');
      return;
    }

    console.log(`Found ${reviews.length} reviews in JSON file. Migrating to database...`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const review of reviews) {
      try {
        // Check if review already exists in database
        const existingReview = await prisma.review.findUnique({
          where: { id: review.id }
        });

        if (existingReview) {
          console.log(`Review ${review.id} already exists in database, skipping...`);
          skippedCount++;
          continue;
        }

        // Look up user by email if we have user email
        let userId = null;
        if (review.user?.email) {
          const user = await prisma.user.findUnique({
            where: { email: review.user.email }
          });
          userId = user?.id || null;
        }

        // Create the review in database
        await prisma.review.create({
          data: {
            id: review.id,
            productId: review.productId,
            userId: userId,
            orderId: review.orderId || null,
            rating: review.rating,
            title: review.title || null,
            body: review.body || null,
            verified: review.verified || false,
            status: review.status || 'published',
            authorName: review.authorName === 'Anonymous' ? null : review.authorName,
            authorEmail: review.authorEmail || null,
            helpfulCount: review.helpfulCount || 0,
            createdAt: new Date(review.createdAt),
            updatedAt: new Date(review.updatedAt),
            reviewedAt: review.reviewedAt ? new Date(review.reviewedAt) : null,
          }
        });

        console.log(`Migrated review ${review.id}`);
        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate review ${review.id}:`, error);
      }
    }

    console.log(`Migration complete:`);
    console.log(`- ${migratedCount} reviews migrated`);
    console.log(`- ${skippedCount} reviews skipped (already exist)`);

    // Once migration is complete, we can delete the JSON file
    if (migratedCount > 0) {
      console.log('Migration successful! The JSON review file can now be removed.');
      // Optional: Delete the JSON file
      // fs.unlinkSync(reviewsPath);
      // console.log('JSON review file deleted.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateReviewsToDb().then(() => {
  console.log('Migration script completed.');
  process.exit(0);
});
