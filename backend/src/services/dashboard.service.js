'use strict';

const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const aiService = require('./aiService');

/**
 * Hitung financial health score.
 * Dipanggil setelah transaksi baru atau secara terjadwal.
 * Fallback: return null jika AI service gagal.
 */
async function getSummary(userId, monthYear) {
  const startDate = new Date(`${monthYear}-01`);
  const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

  const [transactions, budget, latestScore, prediction] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: startDate, lt: endDate } },
      include: { category: true },
    }),
    prisma.userBudgetSetting.findUnique({
      where: { userId_monthYear: { userId, monthYear } },
    }),
    prisma.financialHealthScore.findUnique({
      where: { userId_monthYear: { userId, monthYear } },
    }),
    prisma.spendingPrediction.findUnique({
      where: {
        userId_targetMonth_categorySlug: {
          userId,
          targetMonth: getNextMonthYear(monthYear),
          categorySlug: '__total',
        },
      },
    }),
  ]);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  // Spending by category
  const spendingByCategory = {};
  for (const tx of transactions.filter((t) => t.type === 'expense')) {
    const slug = tx.category?.slug || 'lainnya';
    if (!spendingByCategory[slug]) {
      spendingByCategory[slug] = { slug, name: tx.category?.name || 'Lainnya', amount: 0, icon: tx.category?.icon };
    }
    spendingByCategory[slug].amount += parseFloat(tx.amount);
  }

  return {
    monthYear,
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
    transactionCount: transactions.length,
    budget: budget ? {
      total: parseFloat(budget.totalBudget),
      utilization: parseFloat(budget.totalBudget) > 0
        ? (totalExpense / parseFloat(budget.totalBudget)) * 100
        : 0,
    } : null,
    healthScore: latestScore ? parseFloat(latestScore.score) : null,
    prediction: prediction ? {
      targetMonth: prediction.targetMonth,
      predictedAmount: parseFloat(prediction.predictedAmount),
      confidence: prediction.confidence ? parseFloat(prediction.confidence) : null,
    } : null,
    spendingByCategory: Object.values(spendingByCategory).sort((a, b) => b.amount - a.amount),
  };
}

async function getHealthScore(userId, monthYear) {
  const score = await prisma.financialHealthScore.findUnique({
    where: { userId_monthYear: { userId, monthYear } },
  });
  if (!score) return null;

  // Extract risk_band and other fields from details JSON
  const details = score.details || {};
  return {
    score: parseFloat(score.score),
    risk_band: details.risk_band || 'medium_risk',
    confidence: details.confidence || 'basic',
    user_segment: details.user_segment || 'unknown',
    monthYear: score.monthYear,
  };
}

async function getSpendingTrend(userId) {
  // 6 bulan terakhir
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const trends = await Promise.all(
    months.map(async (monthYear) => {
      const startDate = new Date(`${monthYear}-01`);
      const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

      const transactions = await prisma.transaction.findMany({
        where: { userId, date: { gte: startDate, lt: endDate } },
      });

      const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
      const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);

      return { monthYear, income, expense, savings: income - expense };
    }),
  );

  return trends;
}

/**
 * Gather health score features from user's transaction data.
 * Shared by both AI-based and local calculation.
 */
async function _gatherHealthFeatures(userId, monthYear) {
  const startDate = new Date(`${monthYear}-01`);
  const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));

  const [user, transactions, budget] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyIncome: true, userSegment: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startDate, lt: endDate } },
      include: { category: true },
    }),
    prisma.userBudgetSetting.findUnique({
      where: { userId_monthYear: { userId, monthYear } },
    }),
  ]);

  const monthlyIncome = user?.monthlyIncome ? parseFloat(user.monthlyIncome) : 0;
  const segment = user?.userSegment || 'pekerja_tetap';

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  // Derived features
  const spendingRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;
  const savingsRatio = 1 - spendingRatio;
  const totalBudget = budget ? parseFloat(budget.totalBudget) : totalIncome;
  const budgetUtilization = totalBudget > 0 ? totalExpense / totalBudget : 0;

  const hasSavings = totalIncome > totalExpense;

  const debtCategories = ['tagihan', 'kos_sewa'];
  const debtExpense = transactions
    .filter((t) => t.type === 'expense' && debtCategories.includes(t.category?.slug))
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const hasDebt = debtExpense > 0;
  const debtRatio = totalIncome > 0 ? debtExpense / totalIncome : 0;

  const dailyExpenses = {};
  for (const tx of transactions.filter((t) => t.type === 'expense')) {
    const day = new Date(tx.date).toISOString().slice(0, 10);
    dailyExpenses[day] = (dailyExpenses[day] || 0) + parseFloat(tx.amount);
  }
  const dailyValues = Object.values(dailyExpenses);
  const avgDaily = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
  // Coefficient of variation (std/mean) - normalized 0-1, matches training data
  const expenseVolatility = (dailyValues.length > 1 && avgDaily > 0)
    ? Math.sqrt(dailyValues.reduce((sum, v) => sum + (v - avgDaily) ** 2, 0) / (dailyValues.length - 1)) / avgDaily
    : 0;

  const categoryTotals = {};
  for (const tx of transactions.filter((t) => t.type === 'expense')) {
    const slug = tx.category?.slug || 'lainnya';
    categoryTotals[slug] = (categoryTotals[slug] || 0) + parseFloat(tx.amount);
  }
  const topCategoryAmount = Math.max(0, ...Object.values(categoryTotals));
  const topCategoryRatio = totalExpense > 0 ? topCategoryAmount / totalExpense : 0;

  return {
    transactions,
    features: {
      user_segment: segment,
      monthly_income: monthlyIncome,
      spending_ratio: spendingRatio,
      savings_ratio: savingsRatio,
      budget_utilization: budgetUtilization,
      has_savings: hasSavings,
      has_debt: hasDebt,
      debt_ratio: debtRatio,
      expense_volatility: expenseVolatility,
      n_transactions: transactions.length,
      top_category_ratio: topCategoryRatio,
    },
  };
}

/**
 * Local fallback health score calculation (rule-based).
 * Used when AI service is unavailable.
 * Score 0-100 based on: savings, spending, budget adherence, debt, consistency.
 */
function _calculateLocalHealthScore(features) {
  let score = 50; // baseline
  const breakdown = {};

  // 1. Savings ratio (0-25 pts)
  if (features.savings_ratio > 0.3) {
    breakdown.savings = { pts: 25, label: 'Tabungan sangat baik (>30%)' };
    score += 25;
  } else if (features.savings_ratio > 0.1) {
    breakdown.savings = { pts: 15, label: 'Tabungan cukup (10-30%)' };
    score += 15;
  } else if (features.savings_ratio > 0) {
    breakdown.savings = { pts: 5, label: 'Tabungan tipis (<10%)' };
    score += 5;
  } else {
    breakdown.savings = { pts: -10, label: 'Defisit (pengeluaran ≥ pemasukan)' };
    score -= 10;
  }

  // 2. Budget utilization (0-20 pts)
  if (features.budget_utilization <= 0.8) {
    breakdown.budget = { pts: 20, label: 'Budget terkontrol (≤80%)' };
    score += 20;
  } else if (features.budget_utilization <= 1.0) {
    breakdown.budget = { pts: 10, label: 'Budget mendekati batas (80-100%)' };
    score += 10;
  } else {
    breakdown.budget = { pts: -5, label: 'Over budget' };
    score -= 5;
  }

  // 3. Debt ratio (0-15 pts)
  if (!features.has_debt) {
    breakdown.debt = { pts: 15, label: 'Tidak ada cicilan/tagihan besar' };
    score += 15;
  } else if (features.debt_ratio < 0.3) {
    breakdown.debt = { pts: 5, label: 'Cicilan terkendali (<30% income)' };
    score += 5;
  } else {
    breakdown.debt = { pts: -10, label: 'Cicilan berat (≥30% income)' };
    score -= 10;
  }

  // 4. Expense volatility (0-10 pts)
  if (features.expense_volatility < features.monthly_income * 0.1) {
    breakdown.volatility = { pts: 10, label: 'Pengeluaran stabil' };
    score += 10;
  } else if (features.expense_volatility < features.monthly_income * 0.3) {
    breakdown.volatility = { pts: 5, label: 'Pengeluaran cukup stabil' };
    score += 5;
  } else {
    breakdown.volatility = { pts: 0, label: 'Pengeluaran fluktuatif' };
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  let risk_band;
  if (score >= 80) risk_band = 'low_risk';
  else if (score >= 60) risk_band = 'medium_risk';
  else risk_band = 'high_risk';

  return {
    health_score: score,
    risk_band,
    confidence: 'basic',
    user_segment: features.user_segment,
    breakdown,
    source: 'local_fallback',
  };
}

/**
 * Calculate and persist health score via AI service (Dense NN model).
 * Gathers financial features from user's transaction data, calls FastAPI,
 * and stores the result in FinancialHealthScore table.
 * Falls back to local rule-based calculation if AI service is unavailable.
 *
 * @param {string} userId
 * @param {string} [monthYear] - defaults to current month
 * @returns {Promise<object|null>}
 */
async function calculateHealthScore(userId, monthYear) {
  if (!monthYear) {
    const now = new Date();
    monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  try {
    let { features } = await _gatherHealthFeatures(userId, monthYear);

    // If no transactions for requested month, find latest month with data
    if (features.n_transactions === 0) {
      const latestTx = await prisma.transaction.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (!latestTx) {
        return null; // User has no transactions at all
      }
      const latestMonthYear = `${latestTx.date.getFullYear()}-${String(latestTx.date.getMonth() + 1).padStart(2, '0')}`;
      logger.info(`No transactions for ${monthYear}, falling back to latest month ${latestMonthYear} for user ${userId}`);
      monthYear = latestMonthYear;
      const result = await _gatherHealthFeatures(userId, monthYear);
      features = result.features;
      if (features.n_transactions === 0) {
        return null;
      }
    }

    // Try AI service first
    const logMsg = `[HealthScore] Trying AI service for user ${userId}, segment=${features.user_segment}, transactions=${features.n_transactions}`;
    const featureMsg = `[HealthScore] Features: income=${features.monthly_income}, spending_ratio=${features.spending_ratio.toFixed(2)}, savings_ratio=${features.savings_ratio.toFixed(2)}`;
    logger.info(logMsg);
    logger.info(featureMsg);
    console.log(logMsg);
    console.log(featureMsg);
    
    let result = await aiService.predictHealthScore(features);
    
    if (result) {
      const successMsg = `[HealthScore] AI service SUCCESS for user ${userId}, score=${result.health_score}, confidence=${result.confidence}`;
      logger.info(successMsg);
      console.log(successMsg);
    } else {
      const failMsg = `[HealthScore] AI service FAILED/NULL for user ${userId}, falling back to rule-based`;
      logger.info(failMsg);
      console.log(failMsg);
      result = _calculateLocalHealthScore(features);
    }

    // Store in DB
    await prisma.financialHealthScore.upsert({
      where: { userId_monthYear: { userId, monthYear } },
      update: {
        score: result.health_score,
        details: result,
      },
      create: {
        userId,
        monthYear,
        score: result.health_score,
        details: result,
      },
    });

    return {
      score: result.health_score,
      risk_band: result.risk_band,
      confidence: result.confidence,
      user_segment: result.user_segment,
      monthYear,
    };
  } catch (err) {
    logger.warn(`Calculate health score failed for user ${userId}: ${err.message}`);
    logger.error(`Health score error stack: ${err.stack}`);
    return null;
  }
}

function getNextMonthYear(monthYear) {
  const [year, month] = monthYear.split('-').map(Number);
  const next = new Date(year, month, 1); // month is already 0-indexed after this
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = { getSummary, getHealthScore, getSpendingTrend, calculateHealthScore };
