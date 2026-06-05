'use strict';

/**
 * Unit tests for budget service logic
 * Tests calculateStatus, summary calculations, and allocation logic
 */

// ─── Import pure functions directly from budget service ──────────────────────
const { calculateStatus } = require('../services/budget.service');

// ─── calculateStatus tests ────────────────────────────────────────────────────
describe('budget.service — calculateStatus()', () => {
  test('returns not_set when utilization is 0', () => {
    expect(calculateStatus(0)).toBe('not_set');
  });

  test('returns on_track when utilization < 80', () => {
    expect(calculateStatus(50)).toBe('on_track');
    expect(calculateStatus(79.9)).toBe('on_track');
  });

  test('returns warning when utilization is 80–100', () => {
    expect(calculateStatus(80)).toBe('warning');
    expect(calculateStatus(100)).toBe('warning');
  });

  test('returns exceeded when utilization > 100', () => {
    expect(calculateStatus(101)).toBe('exceeded');
    expect(calculateStatus(150)).toBe('exceeded');
  });
});

// ─── Budget allocation logic ──────────────────────────────────────────────────
describe('budget.service — 50/30/20 allocation logic', () => {
  function split503020(totalBudget) {
    return {
      needs: totalBudget * 0.5,
      wants: totalBudget * 0.3,
      savings: totalBudget * 0.2,
    };
  }

  test('should split 5,000,000 correctly', () => {
    const { needs, wants, savings } = split503020(5000000);
    expect(needs).toBe(2500000);
    expect(wants).toBe(1500000);
    expect(savings).toBe(1000000);
  });

  test('should sum to totalBudget', () => {
    const total = 7500000;
    const { needs, wants, savings } = split503020(total);
    expect(needs + wants + savings).toBe(total);
  });

  test('should handle 0 budget', () => {
    const { needs, wants, savings } = split503020(0);
    expect(needs).toBe(0);
    expect(wants).toBe(0);
    expect(savings).toBe(0);
  });
});

// ─── Budget summary calculation logic ─────────────────────────────────────────
describe('budget.service — summary calculation', () => {
  function calculateBudgetSummary(totalBudget, totalSpent) {
    const utilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      utilization: Math.round(utilization * 100) / 100,
      status: calculateStatus(utilization),
    };
  }

  test('should compute remaining correctly', () => {
    const summary = calculateBudgetSummary(5000000, 2000000);
    expect(summary.remaining).toBe(3000000);
  });

  test('should compute utilization as percentage', () => {
    const summary = calculateBudgetSummary(5000000, 2500000);
    expect(summary.utilization).toBe(50);
    expect(summary.status).toBe('on_track');
  });

  test('should flag exceeded when spent > budget', () => {
    const summary = calculateBudgetSummary(5000000, 6000000);
    expect(summary.utilization).toBe(120);
    expect(summary.status).toBe('exceeded');
  });

  test('should return 0 utilization when no budget set', () => {
    const summary = calculateBudgetSummary(0, 0);
    expect(summary.utilization).toBe(0);
    expect(summary.status).toBe('not_set');
  });
});

// ─── Category allocation per-category status ─────────────────────────────────
describe('budget.service — per-category status', () => {
  function categoryStatus(budgetAmount, spent) {
    const utilization = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
    return calculateStatus(utilization);
  }

  test('on_track when spent is 60% of category budget', () => {
    expect(categoryStatus(1000000, 600000)).toBe('on_track');
  });

  test('warning when spent is exactly 100%', () => {
    expect(categoryStatus(1000000, 1000000)).toBe('warning');
  });

  test('exceeded when spent is 110%', () => {
    expect(categoryStatus(1000000, 1100000)).toBe('exceeded');
  });

  test('not_set when budgetAmount is 0', () => {
    expect(categoryStatus(0, 0)).toBe('not_set');
  });
});
