'use strict';

const aiService = require('../services/aiService');

/**
 * Predict category for a transaction description
 * POST /api/v1/predict-category
 */
async function predictCategory(req, res) {
  const { description, amount, transactionType = 'pengeluaran' } = req.body;

  // Normalize transactionType: accept both English and Indonesian values
  const normalizedType =
    transactionType === 'expense' ? 'pengeluaran' :
    transactionType === 'income' ? 'pemasukan' :
    transactionType || 'pengeluaran';

  if (!description || typeof description !== 'string') {
    return res.status(400).json({
      error: 'Description is required',
    });
  }

  try {
    const result = await aiService.predictCategory(description, amount || 0, normalizedType);

    if (!result) {
      return res.json({
        predicted_category: 'lainnya',
        confidence: 0,
        all_probabilities: {},
        fallback: true,
      });
    }

    return res.json({
      predicted_category: result.predicted_category || 'lainnya',
      confidence: result.confidence || 0,
      all_probabilities: result.all_probabilities || {},
      fallback: false,
    });
  } catch (err) {
    console.error('Predict category error:', err.message);
    return res.json({
      predicted_category: 'lainnya',
      confidence: 0,
      all_probabilities: {},
      fallback: true,
    });
  }
}

module.exports = { predictCategory };