'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const transactionController = require('../controllers/transaction.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Semua routes butuh autentikasi
router.use(authenticate);

// GET /api/v1/transactions
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['income', 'expense']),
    query('category').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('search').optional().isString().trim().isLength({ max: 255 }),
  ],
  validate,
  transactionController.getAll,
);

// POST /api/v1/transactions
router.post(
  '/',
  [
    body('type').isIn(['income', 'expense']).withMessage('Tipe harus income atau expense'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Jumlah harus lebih dari 0'),
    body('description').trim().notEmpty().withMessage('Deskripsi wajib diisi').isLength({ max: 255 }),
    body('date').isISO8601().withMessage('Format tanggal tidak valid'),
    body('categoryId').optional().isString(),
    body('categorySlug').optional().isString(),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  transactionController.create,
);

// GET /api/v1/transactions/:id
router.get('/:id', transactionController.getOne);

// PUT /api/v1/transactions/:id
router.put(
  '/:id',
  [
    body('type').optional().isIn(['income', 'expense']),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('description').optional().trim().notEmpty().isLength({ max: 255 }),
    body('date').optional().isISO8601(),
    body('categoryId').optional().isString(),
    body('categorySlug').optional().isString(),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  transactionController.update,
);

// DELETE /api/v1/transactions/:id
router.delete('/:id', transactionController.remove);

module.exports = router;
