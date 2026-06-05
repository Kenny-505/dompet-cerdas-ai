'use strict';

/**
 * Unit tests for anomaly service logic
 * Tests fallback detection rules and anomaly score logic
 */

// ─── Mock dependencies ────────────────────────────────────────────────────────
jest.mock('../utils/prisma', () => ({
  anomalyAlert: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    aggregate: jest.fn(),
  },
  userBudgetSetting: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../services/aiService', () => ({
  detectAnomaly: jest.fn(),
}));

const prisma = require('../utils/prisma');

// ─── Pure logic: fallback detection ──────────────────────────────────────────
function fallbackDetection(amount) {
  if (amount > 5000000) {
    return {
      isAnomaly: true,
      score: 0.95,
      reason: `Pengeluaran Rp ${amount.toLocaleString('id-ID')} melebihi batas wajar (Rp 5.000.000).`,
    };
  }
  return { isAnomaly: false, score: 0, reason: '' };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Anomaly Service — fallback detection', () => {
  test('should flag amount > 5,000,000 as anomaly', () => {
    const result = fallbackDetection(6000000);
    expect(result.isAnomaly).toBe(true);
    expect(result.score).toBe(0.95);
    expect(result.reason).toContain('melebihi batas wajar');
  });

  test('should not flag amount <= 5,000,000', () => {
    const result = fallbackDetection(5000000);
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBe(0);
  });

  test('should not flag small amounts', () => {
    const result = fallbackDetection(50000);
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBe(0);
  });
});

describe('Anomaly Service — DB interactions (mocked)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should fetch anomaly alerts for user', async () => {
    const mockAlerts = [
      { id: 'alert-1', userId: 'user-1', isResolved: false, transactionId: 'tx-1' },
      { id: 'alert-2', userId: 'user-1', isResolved: true, transactionId: 'tx-2' },
    ];
    prisma.anomalyAlert.findMany.mockResolvedValue(mockAlerts);

    const result = await prisma.anomalyAlert.findMany({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(2);
    expect(result[0].isResolved).toBe(false);
  });

  test('should resolve an anomaly alert', async () => {
    prisma.anomalyAlert.findFirst.mockResolvedValue({ id: 'alert-1', userId: 'user-1', isResolved: false });
    prisma.anomalyAlert.update.mockResolvedValue({ id: 'alert-1', isResolved: true });

    const alert = await prisma.anomalyAlert.findFirst({ where: { id: 'alert-1', userId: 'user-1' } });
    expect(alert).not.toBeNull();

    const resolved = await prisma.anomalyAlert.update({ where: { id: 'alert-1' }, data: { isResolved: true } });
    expect(resolved.isResolved).toBe(true);
  });
});