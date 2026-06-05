'use strict';

const anomalyService = require('../services/anomaly.service');

/**
 * GET /api/v1/anomalies
 */
const getAll = async (req, res, next) => {
  try {
    const data = await anomalyService.getAll(req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/anomalies/:id/resolve
 */
const resolve = async (req, res, next) => {
  try {
    const updated = await anomalyService.resolve(req.user.id, req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Anomali tidak ditemukan' });
    }
    return res.json({ success: true, message: 'Anomali ditandai sebagai resolved', data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/anomalies/scan
 * Retroactively scan existing transactions for anomalies
 */
const scan = async (req, res, next) => {
  try {
    const result = await anomalyService.scanAll(req.user.id);
    return res.json({
      success: true,
      message: `Scan selesai: ${result.scanned} transaksi diperiksa, ${result.detected} anomali baru ditemukan.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, resolve, scan };
