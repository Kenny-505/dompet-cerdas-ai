'use strict';

const readinessService = require('../services/readiness.service');

/**
 * GET /api/v1/readiness
 * Returns data readiness status for AI features
 */
const getReadiness = async (req, res, next) => {
  try {
    const data = await readinessService.calculateReadiness(req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReadiness };
