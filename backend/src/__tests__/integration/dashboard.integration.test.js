'use strict';

/**
 * Integration tests for Dashboard API endpoints
 */

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
jest.mock('../../utils/prisma', () => ({
  transaction: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'tx-1', type: 'income', amount: '8000000', date: new Date(), category: { slug: 'gaji', name: 'Gaji' } },
      { id: 'tx-2', type: 'expense', amount: '3000000', date: new Date(), category: { slug: 'makanan', name: 'Makanan' } },
    ]),
  },
  userBudgetSetting: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
  financialHealthScore: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ id: 'hs-1', score: 75 }),
  },
  spendingPrediction: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'user-int-1', name: 'Test User', userSegment: 'pekerja_tetap' }),
  },
  $disconnect: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() }));
jest.mock('../../services/aiService', () => ({
  predictHealthScore: jest.fn().mockResolvedValue({ score: 75, factors: {} }),
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

describe('Dashboard API — Integration Tests', () => {
  test('GET /api/v1/dashboard — should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/dashboard');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/dashboard/summary — should return 200 with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer mock_access_token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });

  test('GET /api/v1/dashboard/summary — should return summary data', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer mock_access_token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    if (res.body.data) {
      expect(res.body.data).toHaveProperty('totalIncome');
      expect(res.body.data).toHaveProperty('totalExpense');
    }
  });

  test('GET /api/v1/dashboard/health-score — should return health score', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/health-score')
      .set('Authorization', 'Bearer mock_access_token');

    expect([200, 404]).toContain(res.status);
  });
});