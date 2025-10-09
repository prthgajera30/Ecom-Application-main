import request from 'supertest';
import { app } from '../index';
import { prisma, connectMongo, Product } from '../db';
import { signToken } from '../middleware/auth';

describe('Reviews API', () => {
  let userId: string;
  let token: string;
  let productId: string;
  let reviewId: string;

  beforeAll(async () => {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/shop-test';
    await connectMongo(mongoUrl);

    // Create a product document in Mongo so the productId is a valid ObjectId
    const prod = await Product.create({ title: 'Test Product', slug: `test-prod-${Date.now()}`, price: 100, images: [] });
    productId = String(prod._id);

    // Create a test user
    const user = await prisma.user.create({ data: { email: `test-user+${Date.now()}@example.com`, passwordHash: 'hashed', name: 'testuser' } });
    userId = user.id;
    token = signToken({ userId: user.id, role: 'customer' });

    // Ensure a product document exists in Mongo seed (we'll rely on product id string)
    // Create a review in Postgres for this product
    const review = await prisma.review.create({ data: { id: `rev-${Date.now()}`, productId, rating: 5, helpfulCount: 0, verified: false, status: 'published', authorName: 'tester' } });
    reviewId = review.id;

    // Create a helpful vote for this review from our user
    await prisma.reviewHelpful.create({ data: { reviewId, userId } });
    // Increment helpfulCount for realism
    await prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { increment: 1 } } });
  });

  afterAll(async () => {
    // Clean up
    await prisma.reviewHelpful.deleteMany({ where: { userId } });
    await prisma.review.deleteMany({ where: { productId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    // Remove mongo product
    await Product.deleteMany({ _id: productId });
    // Close DB connections
    try {
      await prisma.$disconnect();
    } catch (err) {}
    try {
      await (Product.db as any).close();
    } catch (err) {}
  });

  it('includes markedByCurrentUser for authenticated user', async () => {
    const res = await request(app).get(`/api/products/${productId}/reviews?limit=10`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    const items = res.body.items as any[];
    const found = items.find(i => i.id === reviewId);
    expect(found).toBeDefined();
    expect(found.markedByCurrentUser).toBe(true);
  });

  it('does not include markedByCurrentUser for anonymous users (or false)', async () => {
    const res = await request(app).get(`/api/products/${productId}/reviews?limit=10`);
    expect(res.status).toBe(200);
    const items = res.body.items as any[];
    const found = items.find(i => i.id === reviewId);
    expect(found).toBeDefined();
    // For anonymous, markedByCurrentUser should be false or undefined
    expect(found.markedByCurrentUser === true).toBe(false);
  });
});
