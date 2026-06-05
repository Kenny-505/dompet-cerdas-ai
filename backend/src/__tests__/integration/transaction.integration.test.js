'use strict';

/**
 * Integration tests for Transaction API endpoints
 */

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
jest.mock('../../utils/prisma', () => ({
  transaction: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'tx-1', userId: 'user-int-1', type: 'expense', amount: '50000', description: 'Makan siang', date: new Date(), categoryId: 'cat-1', isAnomaly: false, category: { slug: 'makanan', name: 'Makanan' } },
      { id: 'tx-2', userId: 'user-int-1', type: 'income', amount: '5000000', description: 'Gaji', date: new Date(), categoryId: 'cat-2', isAnomaly: false, category: { slug: 'gaji', name: 'Gaji' } },
    ]),
    create: jest.fn().mockResolvedValue({
      id: 'tx-new', userId: 'user-int-1', type: 'expense', amount: '75000', description: 'Transportasi', date: new Date(), categoryId: 'cat-3', isAnomaly: false,
    }),
    count: jest.fn().mockResolvedValue(2),
  },
  category: {
    findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', slug: 'makanan', name: 'Makanan' }),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'user-int-1', name: 'Test User' }),
  },
  refreshToken: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  $disconnect: jest.fn(),
}));

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('h'), compare: jest.fn().mockResolvedValue(true) }));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_access_token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-int-1', type: 'access' }),
}));

process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');
const app = require('../../app');

describe('Transaction API — Integration Tests', () => {
  test('GET /api/v1/transactions — should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/transactions — should return 200 with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', 'Bearer mock_access_token');

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('success');
  });

  test('POST /api/v1/transactions — should create transaction with valid data', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', 'Bearer mock_access_token')
      .send({
        type: 'expense',
        amount: 75000,
        description: 'Transportasi',
        categoryId: 'cat-3',
        date: '2026-06-01',
      });

    expect([200, 201]).toContain(res.status);
  });

  test('POST /api/v1/transactions — should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', 'Bearer mock_access_token')
      .send({ description: 'No amount' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});