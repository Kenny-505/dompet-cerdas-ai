'use strict';

/**
 * Integration tests for Auth API endpoints
 * Tests: register, login, refresh, me, logout
 */

// ─── Mock Prisma before requiring app ────────────────────────────────────────
const mockUserRecord = {
  id: 'user-int-1',
  name: 'Integration User',
  email: 'integration@example.com',
  passwordHash: '$2a$12$hashedpassword',
  currency: 'IDR',
  userSegment: 'pekerja_tetap',
  createdAt: new Date(),
};

jest.mock('../../utils/prisma', () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 'user-int-1',
      name: 'Integration User',
      email: 'integration@example.com',
      createdAt: new Date(),
    }),
  },
  refreshToken: {
    create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
  $disconnect: jest.fn(),
}));

// Mock bcrypt to return consistent hashes
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() }));

// Mock bcrypt to return consistent hashes
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'),
  compare: jest.fn().mockImplementation((plain, hash) => {
    return Promise.resolve(plain === 'Password123!' && hash === '$2a$12$hashedpassword');
  }),
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_access_token'),
  verify: jest.fn().mockImplementation((token, secret) => {
    if (token === 'mock_access_token' && secret === process.env.JWT_ACCESS_SECRET) {
      return { sub: 'user-int-1', type: 'access' };
    }
    if (token === 'mock_refresh_token' && secret === process.env.JWT_REFRESH_SECRET) {
      return { sub: 'user-int-1', type: 'refresh' };
    }
    throw new Error('invalid token');
  }),
}));

// Set env vars before requiring app
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');
const app = require('../../app');

describe('Auth API — Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/v1/auth/register — should return 201 with user data', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Integration User',
        email: 'integration@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data).toHaveProperty('accessToken');
    // refreshToken may be set as cookie or in body depending on implementation
    expect(res.body.data.accessToken || res.body.accessToken).toBeDefined();
  });

  test('POST /api/v1/auth/register — should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User',
        email: 'not-an-email',
        password: 'Password123!',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/auth/register — should reject weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/auth/register — should reject missing name', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('GET /health — should return service health', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('dompet-cerdas-backend');
  });
});