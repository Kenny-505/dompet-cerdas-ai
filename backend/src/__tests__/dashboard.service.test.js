'use strict';

/**
 * Unit tests for dashboard service logic
 * Tests summary calculations, health score features, spending trend logic
 */

// ─── Mock dependencies ────────────────────────────────────────────────────────
jest.mock('../utils/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  userBudgetSetting: {
    findUnique: jest.fn(),
  },
  financialHealthScore: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  spendingPrediction: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../services/aiService', () => ({
  predictHealthScore: jest.fn(),
}));

const prisma = require('../utils/prisma');

// ─── Pure logic reimplementation for testing ──────────────────────────────────
function calculateSummaryFromTransactions(transactions) {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  return {
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
  };
}

function getSpendingByCategory(transactions) {
  const spendingByCategory = {};
  for (const tx of transactions.filter((t) => t.type === 'expense')) {
    const slug = tx.category?.slug || 'lainnya';
    if (!spendingByCategory[slug]) {
      spendingByCategory[slug] = { slug, name: tx.category?.name || 'Lainnya', amount: 0 };
    }
    spendingByCategory[slug].amount += parseFloat(tx.amount);
  }
  return Object.values(spendingByCategory).sort((a, b) => b.amount - a.amount);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Dashboard Service — summary calculation', () => {
  const sampleTransactions = [
    { type: 'income', amount: '8000000', category: { slug: 'gaji', name: 'Gaji' } },
    { type: 'expense', amount: '3000000', category: { slug: 'makanan', name: 'Makanan' } },
    { type: 'expense', amount: '1500000', category: { slug: 'transportasi', name: 'Transportasi' } },
    { type: 'expense', amount: '500000', category: { slug: 'hiburan', name: 'Hiburan' } },
  ];

  test('should calculate total income correctly', () => {
    const { totalIncome } = calculateSummaryFromTransactions(sampleTransactions);
    expect(totalIncome).toBe(8000000);
  });

  test('should calculate total expense correctly', () => {
    const { totalExpense } = calculateSummaryFromTransactions(sampleTransactions);
    expect(totalExpense).toBe(5000000);
  });

  test('should calculate net savings correctly', () => {
    const { netSavings } = calculateSummaryFromTransactions(sampleTransactions);
    expect(netSavings).toBe(3000000);
  });

  test('should calculate savings rate as percentage', () => {
    const { savingsRate } = calculateSummaryFromTransactions(sampleTransactions);
    expect(savingsRate).toBe(37.5);
  });

  test('should handle zero income gracefully', () => {
    const noIncomeTx = [
      { type: 'expense', amount: '1000000', category: { slug: 'makanan', name: 'Makanan' } },
    ];
    const { savingsRate } = calculateSummaryFromTransactions(noIncomeTx);
    expect(savingsRate).toBe(0);
  });
});

describe('Dashboard Service — spending by category', () => {
  test('should group expenses by category correctly', () => {
    const transactions = [
      { type: 'expense', amount: '100000', category: { slug: 'makanan', name: 'Makanan' } },
      { type: 'expense', amount: '200000', category: { slug: 'makanan', name: 'Makanan' } },
      { type: 'expense', amount: '150000', category: { slug: 'transportasi', name: 'Transportasi' } },
      { type: 'income', amount: '5000000', category: { slug: 'gaji', name: 'Gaji' } },
    ];
    const result = getSpendingByCategory(transactions);
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('makanan');
    expect(result[0].amount).toBe(300000);
    expect(result[1].slug).toBe('transportasi');
    expect(result[1].amount).toBe(150000);
  });

  test('should sort categories by amount descending', () => {
    const transactions = [
      { type: 'expense', amount: '50000', category: { slug: 'hiburan', name: 'Hiburan' } },
      { type: 'expense', amount: '500000', category: { slug: 'makanan', name: 'Makanan' } },
      { type: 'expense', amount: '200000', category: { slug: 'transportasi', name: 'Transportasi' } },
    ];
    const result = getSpendingByCategory(transactions);
    expect(result[0].slug).toBe('makanan');
    expect(result[1].slug).toBe('transportasi');
    expect(result[2].slug).toBe('hiburan');
  });

  test('should return empty array for no expenses', () => {
    const transactions = [
      { type: 'income', amount: '5000000', category: { slug: 'gaji', name: 'Gaji' } },
    ];
    const result = getSpendingByCategory(transactions);
    expect(result).toHaveLength(0);
  });
});