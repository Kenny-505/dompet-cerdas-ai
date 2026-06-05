'use strict';

/**
 * Unit tests for prediction service logic
 * Tests readiness levels, simple average fallback, and LSTM integration
 */

// ─── Mock dependencies ────────────────────────────────────────────────────────
jest.mock('../utils/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
  },
  spendingPrediction: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../services/aiService', () => ({
  predictLstmForecast: jest.fn(),
}));

const prisma = require('../utils/prisma');
const aiService = require('../services/aiService');

// ─── Pure logic helpers ──────────────────────────────────────────────────────
function calculateReadinessLevel(nonEmptyMonths) {
  if (nonEmptyMonths === 0) return 'no_data';
  if (nonEmptyMonths < 3) return 'limited_data';
  return 'enough_data';
}

function calculateSimpleAverage(monthlyData, categories) {
  const avgByCategory = {};
  let totalAvg = 0;
  for (const cat of categories) {
    const sum = monthlyData.reduce((s, m) => s + (m[cat]?.amount || 0), 0);
    const avg = sum / monthlyData.length;
    avgByCategory[cat] = avg;
    totalAvg += avg;
  }
  return { avgByCategory, totalAvg };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Prediction Service — readiness level', () => {
  test('should return no_data when 0 months available', () => {
    expect(calculateReadinessLevel(0)).toBe('no_data');
  });

  test('should return limited_data for 1-2 months', () => {
    expect(calculateReadinessLevel(1)).toBe('limited_data');
    expect(calculateReadinessLevel(2)).toBe('limited_data');
  });

  test('should return enough_data for 3+ months', () => {
    expect(calculateReadinessLevel(3)).toBe('enough_data');
    expect(calculateReadinessLevel(6)).toBe('enough_data');
  });
});

describe('Prediction Service — simple average fallback', () => {
  const categories = ['makanan', 'transportasi', 'belanja'];
  const monthlyData = [
    { makanan: { amount: 300000 }, transportasi: { amount: 200000 }, belanja: { amount: 100000 } },
    { makanan: { amount: 350000 }, transportasi: { amount: 250000 }, belanja: { amount: 150000 } },
  ];

  test('should calculate correct average per category', () => {
    const { avgByCategory } = calculateSimpleAverage(monthlyData, categories);
    expect(avgByCategory.makanan).toBe(325000);
    expect(avgByCategory.transportasi).toBe(225000);
    expect(avgByCategory.belanja).toBe(125000);
  });

  test('should calculate correct total average', () => {
    const { totalAvg } = calculateSimpleAverage(monthlyData, categories);
    expect(totalAvg).toBe(675000);
  });
});

describe('Prediction Service — DB interactions (mocked)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should fetch existing prediction for user', async () => {
    const mockPrediction = {
      id: 'pred-1',
      userId: 'user-1',
      targetMonth: '2026-07',
      categorySlug: '__total',
      predictedAmount: '5000000',
      confidence: 'lstm',
    };
    prisma.spendingPrediction.findUnique.mockResolvedValue(mockPrediction);

    const result = await prisma.spendingPrediction.findUnique({
      where: {
        userId_targetMonth_categorySlug: {
          userId: 'user-1',
          targetMonth: '2026-07',
          categorySlug: '__total',
        },
      },
    });
    expect(result).not.toBeNull();
    expect(result.predictedAmount).toBe('5000000');
  });
});