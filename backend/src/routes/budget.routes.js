'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const budgetController = require('../controllers/budget.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// GET /api/v1/budgets?monthYear=2024-01
router.get(
  '/',
  [query('monthYear').optional().matches(/^\d{4}-\d{2}$/).withMessage('Format bulan: YYYY-MM')],
  validate,
  budgetController.get,
);

// PUT /api/v1/budgets — upsert setting bulan
router.put(
  '/',
  [
    body('monthYear').matches(/^\d{4}-\d{2}$/).withMessage('Format bulan: YYYY-MM'),
    body('totalBudget').isFloat({ min: 0 }).withMessage('Total budget harus >= 0'),
    body('needsPercent').optional().isFloat({ min: 0, max: 100 }),
    body('wantsPercent').optional().isFloat({ min: 0, max: 100 }),
    body('savingsPercent').optional().isFloat({ min: 0, max: 100 }),
    body('allocations').optional().isArray(),
  ],
  validate,
  budgetController.upsert,
);

// GET /api/v1/budgets/summary?monthYear=2024-01
router.get(
  '/summary',
  [query('monthYear').matches(/^\d{4}-\d{2}$/).withMessage('Format bulan: YYYY-MM')],
  validate,
  budgetController.summary,
);

module.exports = router;
