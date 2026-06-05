'use strict';

const express = require('express');
const { query, body } = require('express-validator');
const router = express.Router();

const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// GET /api/v1/dashboard/summary?monthYear=2024-01
router.get(
  '/summary',
  [query('monthYear').optional().matches(/^\d{4}-\d{2}$/).withMessage('Format bulan: YYYY-MM')],
  validate,
  dashboardController.summary,
);

// GET /api/v1/dashboard/health-score?monthYear=2024-01
router.get(
  '/health-score',
  [query('monthYear').optional().matches(/^\d{4}-\d{2}$/)],
  validate,
  dashboardController.healthScore,
);

// POST /api/v1/dashboard/health-score/calculate
// Trigger health score calculation via AI service (Dense NN model)
router.post(
  '/health-score/calculate',
  [body('monthYear').optional().matches(/^\d{4}-\d{2}$/)],
  validate,
  dashboardController.calculateHealthScore,
);

// GET /api/v1/dashboard/spending-trend
router.get('/spending-trend', dashboardController.spendingTrend);

module.exports = router;
