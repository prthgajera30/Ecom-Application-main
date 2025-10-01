import request from 'supertest';
import { app } from '../index';

describe('API basic', () => {
  it('health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
