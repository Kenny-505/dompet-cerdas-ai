'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// GET /api/v1/users/profile
router.get('/profile', userController.getProfile);

// PUT /api/v1/users/profile
router.put(
  '/profile',
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('phone').optional().isMobilePhone().withMessage('Nomor telepon tidak valid'),
    body('monthlyIncome').optional().isFloat({ min: 0 }),
    body('currency').optional().isIn(['IDR', 'USD']),
    body('userSegment').optional().isIn(['pelajar_mahasiswa', 'pekerja_tetap', 'freelancer']),
    body('hasSavings').optional().isBoolean(),
    body('hasDebt').optional().isBoolean(),
  ],
  validate,
  userController.updateProfile,
);

// PUT /api/v1/users/change-password
router.put(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Password saat ini wajib diisi'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password baru minimal 8 karakter')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password harus mengandung huruf besar, kecil, dan angka'),
  ],
  validate,
  userController.changePassword,
);

// DELETE /api/v1/users/account
router.delete('/account', userController.deleteAccount);

module.exports = router;
