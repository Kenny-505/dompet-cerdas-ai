import api from './api';

export const readinessService = {
  /** GET /readiness */
  get: async () => {
    const res = await api.get('/readiness');
    return res.data.data;
  },
};
