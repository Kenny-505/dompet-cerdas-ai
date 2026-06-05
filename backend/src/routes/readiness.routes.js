'use strict';

const express = require('express');
const router = express.Router();

const readinessController = require('../controllers/readiness.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/v1/readiness
router.get('/', readinessController.getReadiness);

module.exports = router;
