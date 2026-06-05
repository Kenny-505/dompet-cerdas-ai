'use strict';

const predictionService = require('../services/prediction.service');

function getCurrentMonthYear() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /api/v1/predictions
 */
const get = async (req, res, next) => {
  try {
    const targetMonth = req.query.targetMonth || getCurrentMonthYear();
    const data = await predictionService.get(req.user.id, targetMonth);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/predictions/generate
 */
const generate = async (req, res, next) => {
  try {
    const data = await predictionService.generate(req.user.id);
    return res.json({
      success: true,
      message: data ? 'Prediksi berhasil dibuat' : 'Data belum cukup untuk prediksi',
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { get, generate };
