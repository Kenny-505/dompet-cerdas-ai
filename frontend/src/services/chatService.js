import api from './api';

/**
 * Chat service for AI Assistant
 */
export const chatService = {
  /**
   * Get chat history for current user
   * @param {number} limit - Max number of messages to retrieve
   * @returns {Promise<Array>} Array of chat messages
   */
  async getHistory(limit = 50) {
    const response = await api.get(`/chat/history`, {
      params: { limit },
    });
    return response.data?.data || [];
  },

  /**
   * Send a message to AI Assistant
   * @param {string} message - User message
   * @returns {Promise<Object>} Response with userMessage, assistantReply, timestamp
   */
  async sendMessage(message) {
    const response = await api.post(`/chat/message`, {
      message,
    });
    return response.data?.data || response.data;
  },

  /**
   * Clear chat history for current user
   * @returns {Promise<void>}
   */
  async clearHistory() {
    await api.delete(`/chat/history`);
  },
};

export default chatService;