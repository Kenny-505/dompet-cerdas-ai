'use strict';

const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const aiService = require('./aiService');

async function get(userId, targetMonth) {
  const predictions = await prisma.spendingPrediction.findMany({
    where: { userId, targetMonth },
    orderBy: { categorySlug: 'asc' },
  });
  return predictions;
}

/**
 * Generate spending prediction via AI service (LSTM model).
 * Butuh minimal 3 bulan data historis pengeluaran.
 * Fallback: return null, UI tampilkan "Data belum cukup"
 */
async function generate(userId) {
  try {
    // Kumpulkan 3 bulan data historis untuk LSTM (per kategori)
    const now = new Date();
    const CATEGORIES = [
      'makanan', 'transportasi', 'belanja', 'tagihan', 'hiburan',
      'kesehatan', 'pendidikan', 'kos_sewa', 'lainnya',
    ];

    const monthlyData = [];

    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const startDate = new Date(`${monthYear}-01`);
      const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

      // Total income for ratio calculation
      const incomeAgg = await prisma.transaction.aggregate({
        where: { userId, type: 'income', date: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      });
      const totalIncome = parseFloat(incomeAgg._sum.amount || 0);

      // Per-category expense
      const catData = {};
      for (const cat of CATEGORIES) {
        const catRecord = await prisma.category.findUnique({ where: { slug: cat } });
        const where = { userId, type: 'expense', date: { gte: startDate, lt: endDate } };
        if (catRecord) where.categoryId = catRecord.id;

        const agg = await prisma.transaction.aggregate({ where, _sum: { amount: true } });
        const amount = parseFloat(agg._sum.amount || 0);
        // Clamp to [0,1] — AI Service schema requires income_ratio: ge=0, le=1
        const ratio = totalIncome > 0 ? Math.min(1, amount / totalIncome) : 0;
        catData[cat] = { amount, income_ratio: ratio };
      }

      monthlyData.push({
        month: monthYear,
        income: totalIncome > 0 ? totalIncome : 1, // AI Service requires income > 0
        ...catData,
      });
    }

    // Cek readiness level berdasarkan jumlah bulan data
    const nonEmpty = monthlyData.filter((m) => {
      const total = CATEGORIES.reduce((sum, c) => sum + (m[c]?.amount || 0), 0);
      return total > 0;
    });

    // Readiness rules (per 0.5.6 Model Integration v2):
    // - no_data (0 bulan) -> return null, UI tampilkan empty state
    // - limited_data (1-2 bulan) -> simple average fallback
    // - enough_data (>=3 bulan) -> LSTM
    if (nonEmpty.length === 0) {
      logger.info(`User ${userId}: no expense data for prediction`);
      return null;
    }

    if (nonEmpty.length < 3) {
      // limited_data: use simple average as fallback
      logger.info(`User ${userId}: limited data (${nonEmpty.length} bulan), using simple average fallback`);

      const targetMonth = getNextMonthYear(now);

      // Calculate average per category from available months
      const avgByCategory = {};
      let totalAvg = 0;
      for (const cat of CATEGORIES) {
        const sum = nonEmpty.reduce((s, m) => s + (m[cat]?.amount || 0), 0);
        const avg = sum / nonEmpty.length;
        avgByCategory[cat] = avg;
        totalAvg += avg;
      }

      // Simpan prediksi simple average ke DB
      // confidence = 0.5 untuk simple average (50% akurasi)
      const saved = await prisma.spendingPrediction.upsert({
        where: {
          userId_targetMonth_categorySlug: {
            userId,
            targetMonth,
            categorySlug: '__total',
          },
        },
        update: {
          predictedAmount: totalAvg,
          confidence: 0.5,
          modelVersion: 'avg_v1',
        },
        create: {
          userId,
          targetMonth,
          categorySlug: '__total',
          predictedAmount: totalAvg,
          confidence: 0.5,
          modelVersion: 'avg_v1',
        },
      });

      // Simpan prediksi per kategori
      for (const [catSlug, avgAmount] of Object.entries(avgByCategory)) {
        try {
          await prisma.spendingPrediction.upsert({
            where: {
              userId_targetMonth_categorySlug: {
                userId,
                targetMonth,
                categorySlug: catSlug,
              },
            },
            update: {
              predictedAmount: avgAmount,
              confidence: 0.5,
              modelVersion: 'avg_v1',
            },
            create: {
              userId,
              targetMonth,
              categorySlug: catSlug,
              predictedAmount: avgAmount,
              confidence: 0.5,
              modelVersion: 'avg_v1',
            },
          });
        } catch (catErr) {
          logger.warn(`Gagal simpan simple average kategori ${catSlug}: ${catErr.message}`);
        }
      }

      return saved;
    }

    // enough_data (>=3 bulan): use LSTM with simple average fallback
    const result = await aiService.predictLstmForecast(monthlyData, 1);

    const firstForecast = result?.monthly_forecast?.[0];

    if (!result || !firstForecast) {
      // LSTM gagal — fallback ke simple average dari nonEmpty data
      logger.warn(`LSTM prediksi gagal untuk user ${userId}: AI service returned null/empty — falling back to simple average`);

      const targetMonth = getNextMonthYear(now);
      const avgByCategory = {};
      let totalAvg = 0;
      for (const cat of CATEGORIES) {
        const sum = nonEmpty.reduce((s, m) => s + (m[cat]?.amount || 0), 0);
        const avg = sum / nonEmpty.length;
        avgByCategory[cat] = avg;
        totalAvg += avg;
      }

      const saved = await prisma.spendingPrediction.upsert({
        where: { userId_targetMonth_categorySlug: { userId, targetMonth, categorySlug: '__total' } },
        update: { predictedAmount: totalAvg, confidence: 0.5, modelVersion: 'avg_v1' },
        create: { userId, targetMonth, categorySlug: '__total', predictedAmount: totalAvg, confidence: 0.5, modelVersion: 'avg_v1' },
      });

      for (const [catSlug, avgAmount] of Object.entries(avgByCategory)) {
        try {
          await prisma.spendingPrediction.upsert({
            where: { userId_targetMonth_categorySlug: { userId, targetMonth, categorySlug: catSlug } },
            update: { predictedAmount: avgAmount, confidence: 0.5, modelVersion: 'avg_v1' },
            create: { userId, targetMonth, categorySlug: catSlug, predictedAmount: avgAmount, confidence: 0.5, modelVersion: 'avg_v1' },
          });
        } catch (catErr) {
          logger.warn(`Fallback: gagal simpan kategori ${catSlug}: ${catErr.message}`);
        }
      }

      return saved;
    }

    // Gunakan bulan depan dari sistem, bukan dari AI Service
    // AI Service mungkin mengembalikan bulan dari data historis
    const targetMonth = getNextMonthYear(now);
    const totalPredicted = firstForecast.total_predicted_expense || 0;
    const categoryBreakdown = firstForecast.categories || {};

    // Simpan/update ke DB
    // confidence = 0.85 untuk LSTM (85% akurasi)
    const saved = await prisma.spendingPrediction.upsert({
      where: {
        userId_targetMonth_categorySlug: {
          userId,
          targetMonth,
          categorySlug: '__total',
        },
      },
      update: {
        predictedAmount: totalPredicted,
        confidence: 0.85,
        modelVersion: 'lstm_v1',
      },
      create: {
        userId,
        targetMonth,
        categorySlug: '__total',
        predictedAmount: totalPredicted,
        confidence: 0.85,
        modelVersion: 'lstm_v1',
      },
    });

    // Simpan prediksi per kategori
    for (const [catSlug, forecast] of Object.entries(categoryBreakdown)) {
      try {
        await prisma.spendingPrediction.upsert({
          where: {
            userId_targetMonth_categorySlug: {
              userId,
              targetMonth,
              categorySlug: catSlug,
            },
          },
          update: {
            predictedAmount: forecast.predicted_amount || 0,
            confidence: 0.85,
            modelVersion: 'lstm_v1',
          },
          create: {
            userId,
            targetMonth,
            categorySlug: catSlug,
            predictedAmount: forecast.predicted_amount || 0,
            confidence: 0.85,
            modelVersion: 'lstm_v1',
          },
        });
      } catch (catErr) {
        logger.warn(`Gagal simpan prediksi kategori ${catSlug}: ${catErr.message}`);
      }
    }

    return saved;
  } catch (err) {
    logger.warn(`Prediksi gagal untuk user ${userId}: ${err.message}`);
    return null;
  }
}

function getNextMonthYear(now) {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = { get, generate };
