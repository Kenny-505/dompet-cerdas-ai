'use strict';

const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const { ALL_CATEGORY_SLUGS } = require('../utils/categories');
const budgetService = require('./budget.service');
const aiService = require('./aiService');
const anomalyService = require('./anomaly.service');

/**
 * Panggil AI service untuk auto-kategorisasi via centralized aiService.
 * Fallback: return 'lainnya' jika model tidak tersedia atau gagal.
 */
async function autoCategorizeTx(description, amount) {
  const result = await aiService.predictCategory(description, amount);
  if (!result) {
    logger.warn(`Auto-kategorisasi gagal, default: lainnya`);
    return 'lainnya';
  }
  return result.predicted_category || 'lainnya';
}

/**
 * Dapatkan categoryId dari slug
 */
async function getCategoryIdBySlug(slug) {
  if (!slug || !ALL_CATEGORY_SLUGS.includes(slug)) return null;
  try {
    const cat = await prisma.category.findUnique({ where: { slug } });
    return cat?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get all transactions dengan filter, search, dan pagination
 */
async function getAll(userId, { page, limit, type, category, startDate, endDate, search }) {
  const skip = (page - 1) * limit;

  const where = { userId };
  if (type) where.type = type;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (category) {
    const cat = await prisma.category.findUnique({ where: { slug: category } });
    if (cat) where.categoryId = cat.id;
  }
  // Search: case-insensitive partial match on description
  if (search && search.trim()) {
    where.description = {
      contains: search.trim(),
      mode: 'insensitive',
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Create transaksi baru dengan auto-kategorisasi AI
 */
async function create(userId, data) {
  let { categoryId } = data;

  if (!categoryId && data.categorySlug) {
    categoryId = await getCategoryIdBySlug(data.categorySlug);
  }

  // Auto-kategorisasi jika expense dan user belum memilih kategori manual
  if (data.type === 'expense' && !categoryId && !data.categorySlug) {
    const slug = await autoCategorizeTx(data.description, data.amount);
    categoryId = await getCategoryIdBySlug(slug);
  }

  // Run anomaly detection via AI service (autoencoder) with rule-based fallback
  let isAnomaly = false;
  let anomalyScore = 0;
  let anomalyReason = '';
  if (data.type === 'expense') {
    const anomalyResult = await anomalyService.detectForTransaction(
      { ...data, categoryId, date: data.date || new Date() },
      userId,
    );
    isAnomaly = anomalyResult.isAnomaly;
    anomalyScore = anomalyResult.score;
    anomalyReason = anomalyResult.reason;
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      note: data.note,
      date: data.date,
      categoryId,
      isAnomaly,
    },
    include: { category: true },
  });

  // Post-create hooks
  try {
    if (transaction.type === 'expense') {
      const monthYear = new Date(transaction.date).toISOString().slice(0, 7); // e.g. 2024-05
      
      // 1. Cek Anomali Notifikasi (via AI or rule-based fallback)
      if (isAnomaly) {
        await prisma.anomalyAlert.create({
          data: {
            userId,
            transactionId: transaction.id,
            anomalyScore,
            reason: anomalyReason || 'Transaksi terdeteksi anomali oleh model.',
          },
        });

        await prisma.notification.create({
          data: {
            userId,
            type: 'anomaly_detected',
            title: 'Transaksi Anomali Terdeteksi',
            message: anomalyReason || `Pengeluaran sebesar Rp ${parseFloat(transaction.amount).toLocaleString('id-ID')} dicurigai sebagai anomali.`,
          },
        });
      }

      // 2. Cek Budget Warning
      const summary = await budgetService.summary(userId, monthYear);
      if (summary.utilization >= 80) {
        // Cek apakah bulan ini sudah dinotifikasi untuk total budget
        const exist = await prisma.notification.findFirst({
          where: { userId, type: 'budget_warning', createdAt: { gte: new Date(`${monthYear}-01`) } }
        });

        if (!exist) {
          await prisma.notification.create({
            data: {
              userId,
              type: 'budget_warning',
              title: 'Peringatan Budget (Bulan Ini)',
              message: `Total pengeluaran Anda bulan ini telah mencapai ${summary.utilization}% dari budget.`,
            }
          });
        }
      }
    }
  } catch (err) {
    logger.error('Error post-transaction processing: ' + err.message);
  }

  return transaction;
}

/**
 * Get single transaction (ownership check)
 */
async function getOne(userId, id) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: { category: true },
  });
}

/**
 * Update transaksi
 */
async function update(userId, id, data) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const updateData = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = parseFloat(data.amount);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (data.note !== undefined) updateData.note = data.note;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.categorySlug !== undefined) {
    updateData.categoryId = await getCategoryIdBySlug(data.categorySlug);
  }

  return prisma.transaction.update({
    where: { id },
    data: updateData,
    include: { category: true },
  });
}

/**
 * Hapus transaksi
 */
async function remove(userId, id) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return null;

  await prisma.transaction.delete({ where: { id } });
  return true;
}

module.exports = { getAll, create, getOne, update, remove };
