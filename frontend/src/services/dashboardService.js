import api from './api';

export const dashboardService = {
  /**
   * Generate/calculate health score untuk bulan tertentu
   * POST /dashboard/health-score/calculate
   */
  async calculateHealthScore(monthYear) {
    const response = await api.post('/dashboard/health-score/calculate', { monthYear });
    return response.data;
  },
};
