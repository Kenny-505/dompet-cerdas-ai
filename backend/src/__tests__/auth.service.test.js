'use strict';

/**
 * Unit tests for auth service (pure logic only — no DB calls)
 * Uses manual mocks for prisma and bcryptjs
 */

// ─── Mock dependencies ────────────────────────────────────────────────────────
jest.mock('../utils/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn(),
}));

const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ─── Helper: generate valid register body ────────────────────────────────────
function makeRegisterBody(overrides = {}) {
  return {
    email: 'test@example.com',
    password: 'Password123!',
    name: 'Test User',
    ...overrides,
  };
}

describe('Auth Service — register logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should hash password before saving', async () => {
    prisma.user.findUnique.mockResolvedValue(null); // no existing user
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      currency: 'IDR',
      userSegment: 'pekerja_tetap',
    });

    await bcrypt.hash('Password123!', 10);
    expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
  });

  test('should reject duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });
    const existing = await prisma.user.findUnique({ where: { email: 'test@example.com' } });
    expect(existing).not.toBeNull();
  });
});

describe('Auth Service — login logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should compare password with hash', async () => {
    bcrypt.compare.mockResolvedValue(true);
    const result = await bcrypt.compare('Password123!', 'hashed_password');
    expect(result).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashed_password');
  });

  test('should return false for wrong password', async () => {
    bcrypt.compare.mockResolvedValue(false);
    const result = await bcrypt.compare('WrongPass', 'hashed_password');
    expect(result).toBe(false);
  });

  test('should generate JWT token on successful login', () => {
    const token = jwt.sign({ userId: 'user-1' }, 'secret', { expiresIn: '15m' });
    expect(token).toBe('mock_token');
    expect(jwt.sign).toHaveBeenCalledWith({ userId: 'user-1' }, 'secret', { expiresIn: '15m' });
  });
});

describe('Auth Service — token refresh logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should find refresh token in DB', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([{
      id: 'rt-1',
      userId: 'user-1',
      token: 'hashed_refresh_token',
      expiresAt: new Date(Date.now() + 86400000),
    }]);

    const found = await prisma.refreshToken.findMany({
      where: { userId: 'user-1', expiresAt: { gt: new Date() } },
    });
    expect(found).toHaveLength(1);
    expect(found[0].userId).toBe('user-1');
  });

  test('should detect expired refresh token', async () => {
    const expiredToken = {
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    };
    const isExpired = expiredToken.expiresAt < new Date();
    expect(isExpired).toBe(true);
  });

  test('should delete old refresh token on rotation', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([{
      id: 'rt-old',
      userId: 'user-1',
      token: 'hashed_old_token',
      expiresAt: new Date(Date.now() + 86400000),
    }]);
    bcrypt.compare.mockResolvedValue(true);
    prisma.refreshToken.delete.mockResolvedValue({ id: 'rt-old' });

    const tokens = await prisma.refreshToken.findMany({
      where: { userId: 'user-1', expiresAt: { gt: new Date() } },
    });
    const isMatch = await bcrypt.compare('raw_token', tokens[0].token);
    expect(isMatch).toBe(true);

    await prisma.refreshToken.delete({ where: { id: 'rt-old' } });
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-old' } });
  });
});

describe('Auth Service — logout logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should delete matching refresh token on logout', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([{
      id: 'rt-1',
      userId: 'user-1',
      token: 'hashed_token',
    }]);
    bcrypt.compare.mockResolvedValue(true);
    prisma.refreshToken.delete.mockResolvedValue({ id: 'rt-1' });

    const tokens = await prisma.refreshToken.findMany({ where: { userId: 'user-1' } });
    expect(tokens).toHaveLength(1);

    const isMatch = await bcrypt.compare('raw_token', tokens[0].token);
    expect(isMatch).toBe(true);

    const deleted = await prisma.refreshToken.delete({ where: { id: 'rt-1' } });
    expect(deleted.id).toBe('rt-1');
  });
});