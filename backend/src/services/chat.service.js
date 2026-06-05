'use strict';

const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const aiService = require('./aiService');

/**
 * Ambil riwayat chat user (n pesan terakhir)
 */
async function getHistory(userId, limit = 50) {
  const messages = await prisma.chatHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return messages;
}

/**
 * Kirim pesan ke AI assistant (Groq via AI-service) dan simpan ke DB
 */
async function sendMessage(userId, message) {
  // Simpan pesan user ke DB
  await prisma.chatHistory.create({
    data: { userId, role: 'user', content: message },
  });

  // Ambil konteks keuangan user (Memory Snapshot)
  const contextResult = await buildFinancialContext(userId);
  const financialSnapshot = contextResult.snapshot || '';

  // Ambil 10 pesan terakhir untuk konteks percakapan
  const recentHistory = await prisma.chatHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const historyForAI = recentHistory.reverse().map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Panggil AI service via centralized aiService
  let assistantReply = 'Maaf, asisten AI sedang tidak tersedia. Silakan coba lagi nanti.';
  const reply = await aiService.sendChatMessage(message, historyForAI, financialSnapshot);
  if (reply) {
    assistantReply = reply;
  } else {
    logger.warn('AI chat returned null, using fallback reply');
  }

  // Simpan reply AI ke DB
  const saved = await prisma.chatHistory.create({
    data: { userId, role: 'assistant', content: assistantReply },
  });

  return {
    userMessage: message,
    assistantReply,
    timestamp: saved.createdAt,
  };
}

/**
 * Hapus riwayat chat user
 */
async function clearHistory(userId) {
  await prisma.chatHistory.deleteMany({ where: { userId } });
}

/**
 * Build financial context snapshot untuk AI (Memory Snapshot)
 * Max 2000 chars untuk context window efficiency
 * 
 * Data yang disertakan:
 * 1. User profile (nama, segment, income, savings/debt status)
 * 2. 3 bulan spending aggregate per kategori
 * 3. Health score trend (last 3 months)
 * 4. Budget utilization bulan ini
 * 5. Anomali aktif (max 5)
 * 6. 5 saran assistant terakhir
 */
async function buildFinancialContext(userId) {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthYear = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // Helper untuk mendapatkan 3 bulan terakhir
    const getMonthRange = (monthsAgo) => {
      const d = new Date(currentYear, currentMonth - monthsAgo, 1);
      return {
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
        label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      };
    };

    const last3Months = [getMonthRange(0), getMonthRange(1), getMonthRange(2)];

    // Query semua data secara parallel
    const [user, budget, healthScores, anomalyAlerts, recentAssistantMessages] = await Promise.all([
      // 1. User profile
      prisma.user.findUnique({
        where: { id: userId },
        select: { 
          name: true, 
          monthlyIncome: true, 
          currency: true,
          userSegment: true,
          hasSavings: true,
          hasDebt: true,
        },
      }),
      // 2. Budget setting bulan ini
      prisma.userBudgetSetting.findUnique({
        where: { userId_monthYear: { userId, monthYear } },
      }),
      // 3. Health score trend (last 3 months)
      prisma.financialHealthScore.findMany({
        where: { userId },
        orderBy: { monthYear: 'desc' },
        take: 3,
      }),
      // 4. Anomali aktif (max 5 unresolved)
      prisma.anomalyAlert.findMany({
        where: { userId, isResolved: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { transaction: { include: { category: true } } },
      }),
      // 5. Recent assistant suggestions (max 5)
      prisma.chatHistory.findMany({
        where: { userId, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { content: true, createdAt: true },
      }),
    ]);

    // 6. Query 3 bulan spending aggregate per kategori
    const spendingByMonth = [];
    const CATEGORIES = ['makanan', 'transportasi', 'belanja', 'tagihan', 'hiburan', 'kesehatan', 'pendidikan', 'kos_sewa', 'lainnya'];
    
    for (const month of last3Months) {
      const transactions = await prisma.transaction.findMany({
        where: { 
          userId, 
          type: 'expense',
          date: { gte: month.start, lt: month.end } 
        },
        include: { category: true },
      });

      const categoryTotals = {};
      let total = 0;
      
      for (const cat of CATEGORIES) {
        const catTotal = transactions
          .filter(t => t.category?.slug === cat)
          .reduce((s, t) => s + parseFloat(t.amount), 0);
        categoryTotals[cat] = catTotal;
        total += catTotal;
      }

      spendingByMonth.push({
        month: month.label,
        total,
        categories: categoryTotals,
      });
    }

    // Hitung budget utilization
    const currentMonthTx = await prisma.transaction.aggregate({
      where: { 
        userId, 
        type: 'expense',
        date: { gte: last3Months[0].start, lt: last3Months[0].end } 
      },
      _sum: { amount: true },
    });
    const currentSpending = parseFloat(currentMonthTx._sum.amount || 0);
    const budgetLimit = budget ? parseFloat(budget.totalBudget) : 0;
    const budgetUtilization = budgetLimit > 0 ? Math.round((currentSpending / budgetLimit) * 100) : 0;

    // Format snapshot string (max ~2000 chars)
    const snapshot = formatSnapshot({
      user,
      spendingByMonth,
      healthScores,
      budget: { limit: budgetLimit, spent: currentSpending, utilization: budgetUtilization },
      anomalyAlerts,
      recentSuggestions: recentAssistantMessages,
      monthYear,
    });

    // Log panjang snapshot untuk debugging
    logger.info(`Memory snapshot built for user ${userId}, length: ${snapshot.length} chars`);

    return { 
      snapshot,
      snapshotLength: snapshot.length,
    };
  } catch (err) {
    logger.warn(`Build financial context gagal: ${err.message}`);
    return { snapshot: '' };
  }
}

/**
 * Format snapshot string dengan batasan 2000 chars
 */
function formatSnapshot({ user, spendingByMonth, healthScores, budget, anomalyAlerts, recentSuggestions, monthYear }) {
  const lines = [];

  // Section 1: User Profile (max ~150 chars)
  const segmentMap = {
    'pelajar_mahasiswa': 'Pelajar/Mahasiswa',
    'pekerja_tetap': 'Pekerja Tetap',
    'freelancer': 'Freelancer',
  };
  lines.push(`[PROFIL]`);
  lines.push(`Nama: ${user?.name || 'User'}`);
  lines.push(`Segment: ${segmentMap[user?.userSegment] || user?.userSegment || 'N/A'}`);
  lines.push(`Income: Rp ${user?.monthlyIncome ? parseFloat(user.monthlyIncome).toLocaleString('id-ID') : 'N/A'}`);
  lines.push(`Tabungan: ${user?.hasSavings ? 'Ya' : 'Tidak'} | Hutang: ${user?.hasDebt ? 'Ya' : 'Tidak'}`);

  // Section 2: 3 Bulan Spending (max ~400 chars)
  lines.push(`\n[PENGELUARAN 3 BULAN]`);
  for (const month of spendingByMonth.reverse()) { // Urutkan dari terlama ke terbaru
    const topCats = Object.entries(month.categories)
      .filter(([_, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${Math.round(v/1000)}k`)
      .join(', ');
    lines.push(`${month.month}: ${Math.round(month.total/1000)}k (${topCats || 'no expense'})`);
  }

  // Section 3: Health Score (max ~150 chars)
  lines.push(`\n[HEALTH SCORE]`);
  if (healthScores.length > 0) {
    const latest = healthScores[0];
    lines.push(`Current: ${Math.round(parseFloat(latest.score))}/100`);
    if (healthScores.length > 1) {
      const prev = parseFloat(healthScores[1].score);
      const curr = parseFloat(latest.score);
      const trend = curr > prev ? '↑' : (curr < prev ? '↓' : '→');
      lines.push(`Trend: ${trend} (prev: ${Math.round(prev)})`);
    }
  } else {
    lines.push(`Belum ada data`);
  }

  // Section 4: Budget Utilization (max ~100 chars)
  lines.push(`\n[BUDGET ${monthYear}]`);
  lines.push(`Utilization: ${budget.utilization}%`);
  lines.push(`Spent: ${Math.round(budget.spent/1000000)}jt / ${Math.round(budget.limit/1000000)}jt`);

  // Section 5: Anomali Aktif (max ~400 chars)
  lines.push(`\n[ANOMALI AKTIF]`);
  if (anomalyAlerts.length > 0) {
    for (const alert of anomalyAlerts.slice(0, 5)) {
      const tx = alert.transaction;
      const amount = parseFloat(tx?.amount || 0);
      const cat = tx?.category?.slug || 'unknown';
      lines.push(`- ${tx?.description?.substring(0, 20) || 'Tx'}: ${Math.round(amount/1000)}k (${cat}) - ${alert.reason?.substring(0, 30) || 'Tidak biasa'}`);
    }
  } else {
    lines.push(`Tidak ada anomali aktif`);
  }

  // Section 6: Saran Terakhir (max ~500 chars)
  lines.push(`\n[SARAN SEBELUMNYA]`);
  if (recentSuggestions.length > 0) {
    for (const msg of recentSuggestions.slice(0, 3)) {
      lines.push(`- ${msg.content.substring(0, 80)}...`);
    }
  } else {
    lines.push(`Belum ada saran`);
  }

  let result = lines.join('\n');
  
  // Truncate jika > 2000 chars
  if (result.length > 2000) {
    result = result.substring(0, 1997) + '...';
  }

  return result;
}

module.exports = { getHistory, sendMessage, clearHistory };
