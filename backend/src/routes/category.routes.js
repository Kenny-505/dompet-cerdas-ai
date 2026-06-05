'use strict';

const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/category.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/v1/categories
router.get('/', categoryController.getAll);

module.exports = router;
