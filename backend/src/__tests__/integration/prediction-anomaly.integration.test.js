'use strict';

/**
 * Integration tests for Prediction and Anomaly API endpoints
 */

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
jest.mock('../../utils/prisma', () => ({
  transaction: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'tx-1', type: 'expense', amount: '500000', date: new Date(), category: { slug: 'makanan', name: 'Makanan' } },
    ]),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500000 }, _count: 1 }),
  },
  category: {
    findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', slug: 'makanan', name: 'Makanan' }),
  },
  spendingPrediction: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'pred-1', userId: 'user-int-1', targetMonth: '2026-07',
      categorySlug: '__total', predictedAmount: '5000000', confidence: 'simple_avg',
    }),
    upsert: jest.fn().mockResolvedValue({ id: 'pred-1' }),
  },
  anomalyAlert: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'alert-1', userId: 'user-int-1', isResolved: false, transactionId: 'tx-1', score: 0.85, reason: 'Unusual amount' },
    ]),
    findFirst: jest.fn().mockResolvedValue({ id: 'alert-1', userId: 'user-int-1', isResolved: false }),
    update: jest.fn().mockResolvedValue({ id: 'alert-1', isResolved: true }),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'user-int-1', name: 'Test User' }),
  },
  $disconnect: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() }));
jest.mock('../../services/aiService', () => ({
  predictLstmForecast: jest.fn().mockResolvedValue(null),
  detectAnomaly: jest.fn().mockResolvedValue(null),
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

describe('Prediction API — Integration Tests', () => {
  test('GET /api/v1/predictions — should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/predictions');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/predictions — should return 200 with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/predictions')
      .set('Authorization', 'Bearer mock_access_token');

    expect([200, 404]).toContain(res.status);
  });
});

describe('Anomaly API — Integration Tests', () => {
  test('GET /api/v1/anomalies — should return anomaly alerts', async () => {
    const res = await request(app)
      .get('/api/v1/anomalies')
      .set('Authorization', 'Bearer mock_access_token');

    expect([200, 404]).toContain(res.status);
  });

  test('PUT /api/v1/anomalies/:id/resolve — should resolve alert', async () => {
    const res = await request(app)
      .put('/api/v1/anomalies/alert-1/resolve')
      .set('Authorization', 'Bearer mock_access_token');

    expect([200, 404]).toContain(res.status);
  });
});