'use strict';

const prisma = require('../utils/prisma');
const ApiError = require('../utils/apiError');

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { unreadOnly = 'false', limit = '50', skip = '0' } = req.query;

    const where = { userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: notifications,
      meta: { total },
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new ApiError(404, 'Notifikasi tidak ditemukan');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({
      success: true,
      message: 'Semua notifikasi ditandai sudah dibaca',
    });
  } catch (error) {
    next(error);
  }
};