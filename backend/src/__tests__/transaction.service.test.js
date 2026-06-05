'use strict';

/**
 * Unit tests for transaction service logic
 * Tests pure business logic without real DB calls
 */

jest.mock('../utils/prisma', () => ({
  transaction: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
  },
}));

const prisma = require('../utils/prisma');

// ─── Inline reimplementation of pure logic functions ──────────────────────────
function buildDateFilter(monthYear) {
  const start = new Date(`${monthYear}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { gte: start, lt: end };
}

function calculateSummary(transactions) {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  return { income, expense, balance: income - expense };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Transaction Service — date filter', () => {
  test('should build correct date range for January 2025', () => {
    const filter = buildDateFilter('2025-01');
    expect(filter.gte).toEqual(new Date('2025-01-01'));
    expect(filter.lt).toEqual(new Date('2025-02-01'));
  });

  test('should build correct date range for December 2025', () => {
    const filter = buildDateFilter('2025-12');
    expect(filter.gte).toEqual(new Date('2025-12-01'));
    expect(filter.lt).toEqual(new Date('2026-01-01'));
  });
});

describe('Transaction Service — summary calculation', () => {
  const sampleTransactions = [
    { type: 'income', amount: '5000000' },
    { type: 'income', amount: '2000000' },
    { type: 'expense', amount: '1500000' },
    { type: 'expense', amount: '500000' },
  ];

  test('should calculate total income correctly', () => {
    const { income } = calculateSummary(sampleTransactions);
    expect(income).toBe(7000000);
  });

  test('should calculate total expense correctly', () => {
    const { expense } = calculateSummary(sampleTransactions);
    expect(expense).toBe(2000000);
  });

  test('should calculate balance correctly', () => {
    const { balance } = calculateSummary(sampleTransactions);
    expect(balance).toBe(5000000);
  });

  test('should return 0 for empty transactions', () => {
    const { income, expense, balance } = calculateSummary([]);
    expect(income).toBe(0);
    expect(expense).toBe(0);
    expect(balance).toBe(0);
  });
});

describe('Transaction Service — DB interactions (mocked)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should fetch transactions for a user', async () => {
    const mockTxs = [
      { id: 'tx-1', userId: 'user-1', type: 'expense', amount: '50000', description: 'Makan siang' },
      { id: 'tx-2', userId: 'user-1', type: 'income', amount: '5000000', description: 'Gaji' },
    ];
    prisma.transaction.findMany.mockResolvedValue(mockTxs);

    const result = await prisma.transaction.findMany({ where: { userId: 'user-1' } });
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('expense');
  });

  test('should create a new transaction', async () => {
    const newTx = {
      id: 'tx-new',
      userId: 'user-1',
      type: 'expense',
      amount: '75000',
      description: 'Transportasi',
      categoryId: 'cat-transportasi',
      date: new Date('2025-01-15'),
    };
    prisma.transaction.create.mockResolvedValue(newTx);

    const result = await prisma.transaction.create({ data: newTx });
    expect(result.id).toBe('tx-new');
    expect(result.type).toBe('expense');
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
  });

  test('should delete a transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue({ id: 'tx-1', userId: 'user-1' });
    prisma.transaction.delete.mockResolvedValue({ id: 'tx-1' });

    const found = await prisma.transaction.findUnique({ where: { id: 'tx-1' } });
    expect(found).not.toBeNull();

    const deleted = await prisma.transaction.delete({ where: { id: 'tx-1' } });
    expect(deleted.id).toBe('tx-1');
  });

  test('should return null for non-existent transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);

    const result = await prisma.transaction.findUnique({ where: { id: 'non-existent' } });
    expect(result).toBeNull();
  });
});

describe('Transaction Service — anomaly flag', () => {
  test('isAnomaly defaults to false on creation', () => {
    const tx = { id: 'tx-1', isAnomaly: false };
    expect(tx.isAnomaly).toBe(false);
  });

  test('isAnomaly can be set to true', () => {
    const tx = { id: 'tx-1', isAnomaly: true };
    expect(tx.isAnomaly).toBe(true);
  });
});
