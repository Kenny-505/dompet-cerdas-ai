'use strict';

const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const aiService = require('./aiService');

/**
 * Get all anomaly alerts for a user
 */
async function getAll(userId) {
  const rows = await prisma.anomalyAlert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { transaction: { include: { category: true } } },
  });
  // Normalize field: anomalyScore → score for frontend compatibility
  return rows.map((r) => ({
    ...r,
    score: r.anomalyScore !== undefined ? parseFloat(r.anomalyScore) : (r.score || 0),
  }));
}

/**
 * Run anomaly detection on all existing expense transactions for a user
 * that do not yet have an AnomalyAlert record.
 * Returns { scanned, detected } count.
 */
async function scanAll(userId) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'expense',
      // Only scan transactions that don't already have an alert
      anomalyAlerts: { none: {} },
    },
    include: { category: true },
    orderBy: { date: 'desc' },
    take: 200, // safety cap
  });

  let detected = 0;
  for (const tx of transactions) {
    try {
      const result = await detectForTransaction(tx, userId);
      if (result.isAnomaly) {
        detected++;
        await prisma.anomalyAlert.create({
          data: {
            userId,
            transactionId: tx.id,
            anomalyScore: result.score,
            reason: result.reason || 'Transaksi terdeteksi anomali.',
          },
        });
      }
    } catch (err) {
      logger.warn(`scanAll: skip tx ${tx.id}: ${err.message}`);
    }
  }
  return { scanned: transactions.length, detected };
}

/**
 * Resolve an anomaly alert
 */
async function resolve(userId, id) {
  const alert = await prisma.anomalyAlert.findFirst({ where: { id, userId } });
  if (!alert) return null;

  return prisma.anomalyAlert.update({
    where: { id },
    data: { isResolved: true },
  });
}

/**
 * Run anomaly detection on a transaction via AI service.
 * Fallback: use simple rule-based detection if AI service unavailable.
 *
 * @param {object} transaction - Transaction record with category info
 * @param {string} userId
 * @returns {Promise<{isAnomaly: boolean, score: number, reason: string}>}
 */
async function detectForTransaction(transaction, userId) {
  // Gather context features needed by the autoencoder
  try {
    const txDateObj = new Date(transaction.date || Date.now());
    const monthYear = `${txDateObj.getFullYear()}-${String(txDateObj.getMonth() + 1).padStart(2, '0')}`;
    const startDate = new Date(`${monthYear}-01`);
    const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

    // User aggregate stats for this month
    const [userAvg, catAvg, budgetSetting, incomeAgg] = await Promise.all([
      // User's average expense amount (last 90 days)
      prisma.transaction.aggregate({
        where: { userId, type: 'expense', date: { gte: new Date(Date.now() - 90 * 86400000) } },
        _avg: { amount: true },
        _count: { id: true },
      }),
      // Category average for this user
      prisma.transaction.aggregate({
        where: { userId, type: 'expense', categoryId: transaction.categoryId },
        _avg: { amount: true },
      }),
      // Budget setting
      prisma.userBudgetSetting.findUnique({
        where: { userId_monthYear: { userId, monthYear } },
      }),
      // Monthly income
      prisma.transaction.aggregate({
        where: { userId, type: 'income', date: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
    ]);

    const txDate = new Date(transaction.date);
    const amount = parseFloat(transaction.amount);
    const userAvgAmount = parseFloat(userAvg._avg.amount || amount);
    const catAvgAmount = parseFloat(catAvg._avg.amount || amount);
    const monthlyIncome = parseFloat(incomeAgg._sum.amount || 0);
    const totalBudget = budgetSetting ? parseFloat(budgetSetting.totalBudget) : monthlyIncome;
    const amountLog = Math.log1p(amount);
    const categoryId = transaction.categoryId || 0;
    const paymentMethodId = 0; // placeholder — no payment_method field yet
    const dayOfWeek = txDate.getDay();
    const dayOfMonth = txDate.getDate();

    // Budget utilization: current month expense / total budget
    const monthExpense = await prisma.transaction.aggregate({
      where: { userId, type: 'expense', date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    });
    const totalExpense = parseFloat(monthExpense._sum.amount || 0);
    const budgetUtilization = totalBudget > 0 ? totalExpense / totalBudget : 0;

    const features = {
      amount_log: amountLog,
      // schema: ge=0, int — ensure integer, default to 0 if null/string
      category_id: Math.max(0, parseInt(categoryId, 10) || 0),
      payment_method_id: paymentMethodId,
      day_of_week: dayOfWeek,
      day_of_month: dayOfMonth,
      user_avg_amount: Math.max(0, userAvgAmount),
      category_avg_amount: Math.max(0, catAvgAmount),
      amount_to_user_avg_ratio: Math.max(0, userAvgAmount > 0 ? amount / userAvgAmount : 1),
      amount_to_category_avg_ratio: Math.max(0, catAvgAmount > 0 ? amount / catAvgAmount : 1),
      budget_utilization: Math.max(0, budgetUtilization),
      // schema: ge=0, le=1 — clamp to [0, 1]
      monthly_income_ratio: monthlyIncome > 0 ? Math.min(1, amount / monthlyIncome) : 0,
    };

    // Call AI service
    const result = await aiService.detectAnomaly(features);

    if (result) {
      return {
        isAnomaly: result.is_anomaly,
        score: result.anomaly_score,
        reason: result.explanation,
      };
    }
  } catch (err) {
    logger.warn(`AI anomaly detection failed: ${err.message}`);
  }

  // Fallback: simple rule-based detection
  return _fallbackDetection(transaction, userId);
}

/**
 * Simple rule-based anomaly detection as fallback
 */
async function _fallbackDetection(transaction, userId) {
  const amount = parseFloat(transaction.amount);

  // Rule 1: expense > 5,000,000 IDR is suspicious
  if (amount > 5000000) {
    return {
      isAnomaly: true,
      score: 0.95,
      reason: `Pengeluaran Rp ${amount.toLocaleString('id-ID')} melebihi batas wajar (Rp 5.000.000).`,
    };
  }

  return { isAnomaly: false, score: 0, reason: '' };
}

module.exports = { getAll, scanAll, resolve, detectForTransaction };
