'use strict';

const chatService = require('../services/chat.service');

/**
 * GET /api/v1/chat/history
 */
const getHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await chatService.getHistory(req.user.id, limit);
    return res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/chat/message
 */
const sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const result = await chatService.sendMessage(req.user.id, message);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/chat/history
 */
const clearHistory = async (req, res, next) => {
  try {
    await chatService.clearHistory(req.user.id);
    return res.json({ success: true, message: 'Riwayat chat berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHistory, sendMessage, clearHistory };
