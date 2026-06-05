'use strict';

const dashboardService = require('../services/dashboard.service');

function getCurrentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /api/v1/dashboard/summary
 */
const summary = async (req, res, next) => {
  try {
    const monthYear = req.query.monthYear || getCurrentMonthYear();
    const data = await dashboardService.getSummary(req.user.id, monthYear);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/dashboard/health-score
 */
const healthScore = async (req, res, next) => {
  try {
    const monthYear = req.query.monthYear || getCurrentMonthYear();

    // Try reading cached score from DB first
    let data = await dashboardService.getHealthScore(req.user.id, monthYear);

    // Auto-calculate if not in DB yet and user has transactions
    if (!data) {
      data = await dashboardService.calculateHealthScore(req.user.id, monthYear);
    }

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/dashboard/spending-trend
 */
const spendingTrend = async (req, res, next) => {
  try {
    const data = await dashboardService.getSpendingTrend(req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/dashboard/health-score/calculate
 * Trigger health score calculation via AI service (Dense NN model)
 */
const calculateHealthScore = async (req, res, next) => {
  try {
    const monthYear = req.body.monthYear || getCurrentMonthYear();
    const data = await dashboardService.calculateHealthScore(req.user.id, monthYear);
    if (!data) {
      return res.status(503).json({
        success: false,
        message: 'Health score AI service tidak tersedia atau data belum cukup',
      });
    }
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { summary, healthScore, spendingTrend, calculateHealthScore };
