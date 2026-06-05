'use strict';

const express = require('express');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticate);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;