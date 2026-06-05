'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { chatLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);

// GET /api/v1/chat/history
router.get('/history', chatController.getHistory);

// POST /api/v1/chat/message
router.post(
  '/message',
  chatLimiter,
  [
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Pesan tidak boleh kosong')
      .isLength({ max: 2000 })
      .withMessage('Pesan maksimal 2000 karakter'),
  ],
  validate,
  chatController.sendMessage,
);

// DELETE /api/v1/chat/history
router.delete('/history', chatController.clearHistory);

module.exports = router;
