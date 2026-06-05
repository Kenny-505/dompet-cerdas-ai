'use strict';

const express = require('express');
const router = express.Router();

const anomalyController = require('../controllers/anomaly.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/v1/anomalies
router.get('/', anomalyController.getAll);

// POST /api/v1/anomalies/scan — retroactive scan of existing transactions
router.post('/scan', anomalyController.scan);

// PUT /api/v1/anomalies/:id/resolve
router.put('/:id/resolve', anomalyController.resolve);

module.exports = router;
