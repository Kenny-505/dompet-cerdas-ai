'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// POST /api/v1/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Nama wajib diisi').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail().withMessage('Format email tidak valid'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password minimal 8 karakter')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password harus mengandung huruf besar, kecil, dan angka'),
  ],
  validate,
  authController.register,
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Format email tidak valid'),
    body('password').notEmpty().withMessage('Password wajib diisi'),
  ],
  validate,
  authController.login,
);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refresh);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, authController.logout);

// GET /api/v1/auth/me
router.get('/me', authenticate, authController.me);

module.exports = router;
