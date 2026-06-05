import api from './api';

export const budgetService = {
  /** GET /budgets */
  get: async (params = {}) => {
    const res = await api.get('/budgets', { params });
    return res.data.data;
  },

  /** PUT /budgets */
  update: async (payload) => {
    const res = await api.put('/budgets', payload);
    return res.data.data;
  },

  /** GET /budgets/summary */
  summary: async (params = {}) => {
    const res = await api.get('/budgets/summary', { params });
    return res.data.data;
  },
};
