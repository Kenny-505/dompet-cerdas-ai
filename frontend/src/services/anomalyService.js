import api from './api';

export const anomalyService = {
  /**
   * Get all anomalies for the current user
   * @param {Object} params - Query parameters
   * @param {boolean} params.unresolvedOnly - Only unresolved anomalies
   * @returns {Promise<Array>}
   */
  async getAll(params = {}) {
    const query = new URLSearchParams();
    if (params.unresolvedOnly) query.append('unresolvedOnly', 'true');
    const response = await api.get(`/anomalies${query.toString() ? `?${query}` : ''}`);
    return response.data.data;
  },

  /**
   * Retroactively scan existing transactions for anomalies
   * @returns {Promise<{scanned: number, detected: number}>}
   */
  async scan() {
    const response = await api.post('/anomalies/scan');
    return response.data.data;
  },

  /**
   * Mark an anomaly as resolved (not an anomaly)
   * @param {string} anomalyId - The anomaly ID
   * @returns {Promise<Object>}
   */
  async resolve(anomalyId) {
    const response = await api.put(`/anomalies/${anomalyId}/resolve`);
    return response.data.data;
  },
};
