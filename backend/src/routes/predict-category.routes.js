'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const predictCategoryController = require('../controllers/predict-category.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// POST /api/v1/predict-category
router.post(
  '/',
  [
    body('description').trim().notEmpty().withMessage('Deskripsi wajib diisi'),
    body('amount').optional().isFloat({ min: 0 }),
    body('transactionType').optional().isIn(['income', 'expense', 'pemasukan', 'pengeluaran']),
  ],
  validate,
  predictCategoryController.predictCategory,
);

module.exports = router;