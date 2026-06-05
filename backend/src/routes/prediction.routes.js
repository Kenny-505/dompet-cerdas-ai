'use strict';

const express = require('express');
const { query } = require('express-validator');
const router = express.Router();

const predictionController = require('../controllers/prediction.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// GET /api/v1/predictions?targetMonth=2024-02
router.get(
  '/',
  [query('targetMonth').optional().matches(/^\d{4}-\d{2}$/).withMessage('Format bulan: YYYY-MM')],
  validate,
  predictionController.get,
);

// POST /api/v1/predictions/generate
router.post('/generate', predictionController.generate);

module.exports = router;
