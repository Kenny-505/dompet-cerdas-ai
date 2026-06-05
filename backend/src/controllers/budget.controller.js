'use strict';

const budgetService = require('../services/budget.service');

/**
 * GET /api/v1/budgets
 */
const get = async (req, res, next) => {
  try {
    const monthYear = req.query.monthYear || getCurrentMonthYear();
    const data = await budgetService.get(req.user.id, monthYear);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/budgets
 * Body: { monthYear, totalBudget, needsPercent?, wantsPercent?, savingsPercent?, allocations?: [{ categoryId?, categorySlug?, budgetAmount }] }
 */
const upsert = async (req, res, next) => {
  try {
    const data = await budgetService.upsert(req.user.id, req.body);
    return res.json({
      success: true,
      message: 'Budget berhasil disimpan',
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/budgets/summary
 * Returns total budget, spent, remaining, utilization, status, and per-category allocations with status
 */
const summary = async (req, res, next) => {
  try {
    const monthYear = req.query.monthYear || getCurrentMonthYear();
    const data = await budgetService.summary(req.user.id, monthYear);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

function getCurrentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

module.exports = { get, upsert, summary };
