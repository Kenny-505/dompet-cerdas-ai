'use strict';

const transactionService = require('../services/transaction.service');

/**
 * GET /api/v1/transactions
 */
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, category, startDate, endDate, search } = req.query;
    const result = await transactionService.getAll(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      category,
      startDate,
      endDate,
      search,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/transactions
 */
const create = async (req, res, next) => {
  try {
    const { type, amount, description, date, categoryId, categorySlug, note } = req.body;
    const transaction = await transactionService.create(req.user.id, {
      type,
      amount: parseFloat(amount),
      description,
      date: new Date(date),
      categoryId,
      categorySlug,
      note,
    });
    return res.status(201).json({
      success: true,
      message: 'Transaksi berhasil ditambahkan',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/transactions/:id
 */
const getOne = async (req, res, next) => {
  try {
    const transaction = await transactionService.getOne(req.user.id, req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }
    return res.json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/transactions/:id
 */
const update = async (req, res, next) => {
  try {
    const updated = await transactionService.update(req.user.id, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }
    return res.json({
      success: true,
      message: 'Transaksi berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/transactions/:id
 */
const remove = async (req, res, next) => {
  try {
    const deleted = await transactionService.remove(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }
    return res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, create, getOne, update, remove };
