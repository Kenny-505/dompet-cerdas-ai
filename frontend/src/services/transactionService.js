import api from './api';

export const transactionService = {
  /** GET /transactions — with filters & pagination */
  getAll: async (params = {}) => {
    const res = await api.get('/transactions', { params });
    return res.data.data; // { transactions, pagination }
  },

  /** GET /transactions/:id */
  getById: async (id) => {
    const res = await api.get(`/transactions/${id}`);
    return res.data.data;
  },

  /** POST /transactions */
  create: async (payload) => {
    const res = await api.post('/transactions', payload);
    return res.data.data;
  },

  /** PUT /transactions/:id */
  update: async (id, payload) => {
    const res = await api.put(`/transactions/${id}`, payload);
    return res.data.data;
  },

  /** DELETE /transactions/:id */
  remove: async (id) => {
    const res = await api.delete(`/transactions/${id}`);
    return res.data;
  },
};
