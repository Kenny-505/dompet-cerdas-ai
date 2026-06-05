import api from './api';

export const predictionService = {
  /** 
   * GET /predictions?targetMonth=YYYY-MM
   * Get existing prediction for target month
   */
  get: async (targetMonth) => {
    const params = targetMonth ? { params: { targetMonth } } : {};
    const res = await api.get('/predictions', params);
    return res.data.data;
  },

  /**
   * POST /predictions/generate
   * Generate new prediction via AI service (LSTM or simple average fallback)
   */
  generate: async () => {
    const res = await api.post('/predictions/generate');
    return res.data.data;
  },

  /**
   * POST /predict-category
   * Auto-categorize a transaction description via CNN model.
   * Returns { predicted_category, confidence, all_probabilities, fallback }
   */
  predictCategory: async (description, amount = 0, transactionType = 'expense') => {
    const res = await api.post('/predict-category', {
      description,
      amount,
      transactionType,
    });
    return res.data;
  },
};
