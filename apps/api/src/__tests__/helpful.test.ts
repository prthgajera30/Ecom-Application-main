import request from 'supertest';
import { app } from '../index';
import { prisma, connectMongo, Product } from '../db';
import { signToken } from '../middleware/auth';

describe('Helpful endpoint', () => {
  let userId: string;
  let token: string;
  let productId: string;
  let reviewId: string;

  beforeAll(async () => {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/shop-test';
    await connectMongo(mongoUrl);

    const prod = await Product.create({ title: 'Helpful Test Product', slug: `helpful-prod-${Date.now()}`, price: 1, images: [] });
    productId = String(prod._id);

    const user = await prisma.user.create({ data: { email: `helpful+${Date.now()}@example.com`, passwordHash: 'hashed', name: 'helpful' } });
    userId = user.id;
    token = signToken({ userId: user.id, role: 'customer' });

    const review = await prisma.review.create({ data: { id: `rev-helpful-${Date.now()}`, productId, rating: 5, helpfulCount: 0, verified: false, status: 'published', authorName: 'tester' } });
    reviewId = review.id;
  });

  afterAll(async () => {
    await prisma.reviewHelpful.deleteMany({ where: { userId } });
    await prisma.review.deleteMany({ where: { productId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await Product.deleteMany({ _id: productId });
    try { await prisma.$disconnect(); } catch (err) {}
    try { await (Product.db as any).close(); } catch (err) {}
  });

  it('returns 200 on first mark and 409 on duplicate mark', async () => {
    const first = await request(app).post(`/api/reviews/${reviewId}/helpful`).set('Authorization', `Bearer ${token}`).send();
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/reviews/${reviewId}/helpful`).set('Authorization', `Bearer ${token}`).send();
    expect(second.status).toBe(409);
    expect(second.body).toHaveProperty('error', 'ALREADY_MARKED');
  });
});
