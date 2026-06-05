'use strict';

const prisma = require('../utils/prisma');

/**
 * Calculate data readiness status for each AI feature
 * @param {string} userId 
 * @returns {Object} readiness status per feature
 */
async function calculateReadiness(userId) {
  // Get all user transactions
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      date: true,
      amount: true,
    },
    orderBy: { date: 'asc' },
  });

  // Count total transactions
  const totalTransactions = transactions.length;

  // Calculate unique months with data (all transactions)
  const monthSet = new Set();
  for (const tx of transactions) {
    const monthYear = tx.date.toISOString().slice(0, 7); // YYYY-MM
    monthSet.add(monthYear);
  }
  const monthsWithData = monthSet.size;

  // Count expense transactions
  const expenseTransactions = transactions.filter(tx => tx.type === 'expense').length;

  // Calculate unique months with EXPENSE data (for prediction readiness)
  // Prediction model needs months with expense data, not just any data
  const expenseMonthSet = new Set();
  for (const tx of transactions) {
    if (tx.type === 'expense') {
      const monthYear = tx.date.toISOString().slice(0, 7); // YYYY-MM
      expenseMonthSet.add(monthYear);
    }
  }
  const monthsWithExpenseData = expenseMonthSet.size;

  // Readiness thresholds
  // prediction (LSTM): needs >= 3 months of EXPENSE data
  // healthScore: needs transactions for meaningful calculation
  // anomaly: needs historical patterns (>= 3 months)
  // assistant: needs some context (any data)

  const prediction = getReadinessStatus(monthsWithExpenseData, 3);
  const healthScore = getReadinessStatus(totalTransactions, 1); // needs at least 1 transaction for baseline
  const anomaly = getReadinessStatus(monthsWithData, 3);
  const assistant = getReadinessStatus(totalTransactions > 0 ? 3 : 0, 1); // needs any data

  return {
    totalTransactions,
    monthsWithData,
    expenseTransactions,
    prediction: {
      status: prediction,
      monthsData: monthsWithExpenseData,
      required: 3,
      message: getReadinessMessage('prediction', prediction),
    },
    healthScore: {
      status: healthScore,
      transactions: totalTransactions,
      message: getReadinessMessage('healthScore', healthScore),
    },
    anomaly: {
      status: anomaly,
      monthsData: monthsWithData,
      required: 3,
      message: getReadinessMessage('anomaly', anomaly),
    },
    assistant: {
      status: assistant,
      transactions: totalTransactions,
      message: getReadinessMessage('assistant', assistant),
    },
  };
}

/**
 * Get readiness status based on available vs required
 * @param {number} available 
 * @param {number} required 
 * @returns {string} 'no_data' | 'limited_data' | 'enough_data'
 */
function getReadinessStatus(available, required) {
  if (available === 0) return 'no_data';
  if (available < required) return 'limited_data';
  return 'enough_data';
}

/**
 * Get human-readable message for readiness status
 * @param {string} feature 
 * @param {string} status 
 * @returns {string}
 */
function getReadinessMessage(feature, status) {
  const messages = {
    prediction: {
      no_data: 'Belum ada data pengeluaran. Prediksi akan tersedia setelah Anda mencatat pengeluaran.',
      limited_data: 'Data pengeluaran masih terbatas. Estimasi sederhana tersedia setelah integrasi model.',
      enough_data: 'Data siap untuk prediksi pengeluaran bulanan.',
    },
    healthScore: {
      no_data: 'Belum ada transaksi. Health Score membutuhkan riwayat transaksi.',
      limited_data: 'Data transaksi masih terbatas. Health Score akan lebih akurat dengan lebih banyak data.',
      enough_data: 'Data siap untuk kalkulasi Health Score.',
    },
    anomaly: {
      no_data: 'Belum ada data untuk mendeteksi pola anomali.',
      limited_data: 'Data masih terbatas. Deteksi anomali akan lebih akurat dengan histori 3+ bulan.',
      enough_data: 'Data siap untuk deteksi anomali berbasis histori.',
    },
    assistant: {
      no_data: 'Belum ada data. Assistant akan lebih membantu dengan riwayat transaksi.',
      limited_data: 'Assistant memiliki konteks terbatas dari transaksi Anda.',
      enough_data: 'Assistant memiliki cukup konteks untuk memberikan insight personal.',
    },
  };
  return messages[feature]?.[status] || '';
}

module.exports = { calculateReadiness };
