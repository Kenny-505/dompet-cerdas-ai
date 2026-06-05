'use strict';

const bcrypt = require('bcryptjs');

/**
 * Seed data untuk 9 test users:
 *   3 segmen × 3 readiness level
 *
 * Segmen MVP (sesuai DompetCerdas_AI_Context_Discussion.md §19):
 *   1. pekerja_tetap       — income tetap, pola stabil
 *   2. freelancer          — income fluktuatif, spending bervariasi
 *   3. pelajar_mahasiswa   — uang saku, pengeluaran kecil
 *
 * Readiness (sesuai §13 & §14):
 *   - no_data       : 0 transaksi
 *   - limited_data  : 1-2 bulan transaksi
 *   - enough_data   : ≥3 bulan transaksi (untuk LSTM)
 */

const PASSWORD_PLAIN = 'Test1234!';

// ─── User definitions ──────────────────────────────────────────────────────────

const TEST_USERS = [
  // ── Pekerja Tetap ─────────────────────────────────────────────────────────
  {
    key: 'pekerja_nodata',
    email: 'demo.pekerja.nodata@dompetcerdas.test',
    name: 'Andi Pekerja (No Data)',
    userSegment: 'pekerja_tetap',
    monthlyIncome: 8000000,
    hasSavings: true,
    hasDebt: false,
    readiness: 'no_data',
  },
  {
    key: 'pekerja_limited',
    email: 'demo.pekerja.limited@dompetcerdas.test',
    name: 'Budi Pekerja (Limited)',
    userSegment: 'pekerja_tetap',
    monthlyIncome: 8000000,
    hasSavings: true,
    hasDebt: false,
    readiness: 'limited_data',
  },
  {
    key: 'pekerja_ready',
    email: 'demo.pekerja.ready@dompetcerdas.test',
    name: 'Citra Pekerja (Ready)',
    userSegment: 'pekerja_tetap',
    monthlyIncome: 8500000,
    hasSavings: true,
    hasDebt: false,
    readiness: 'enough_data',
  },

  // ── Freelancer ────────────────────────────────────────────────────────────
  {
    key: 'freelancer_nodata',
    email: 'demo.freelancer.nodata@dompetcerdas.test',
    name: 'Dian Freelancer (No Data)',
    userSegment: 'freelancer',
    monthlyIncome: 5000000,
    hasSavings: false,
    hasDebt: true,
    readiness: 'no_data',
  },
  {
    key: 'freelancer_limited',
    email: 'demo.freelancer.limited@dompetcerdas.test',
    name: 'Eka Freelancer (Limited)',
    userSegment: 'freelancer',
    monthlyIncome: 5000000,
    hasSavings: false,
    hasDebt: true,
    readiness: 'limited_data',
  },
  {
    key: 'freelancer_ready',
    email: 'demo.freelancer.ready@dompetcerdas.test',
    name: 'Fajar Freelancer (Ready)',
    userSegment: 'freelancer',
    monthlyIncome: 4500000,
    hasSavings: false,
    hasDebt: true,
    readiness: 'enough_data',
  },

  // ── Pelajar/Mahasiswa ─────────────────────────────────────────────────────
  {
    key: 'pelajar_nodata',
    email: 'demo.pelajar.nodata@dompetcerdas.test',
    name: 'Gita Pelajar (No Data)',
    userSegment: 'pelajar_mahasiswa',
    monthlyIncome: 2500000,
    hasSavings: false,
    hasDebt: false,
    readiness: 'no_data',
  },
  {
    key: 'pelajar_limited',
    email: 'demo.pelajar.limited@dompetcerdas.test',
    name: 'Hana Pelajar (Limited)',
    userSegment: 'pelajar_mahasiswa',
    monthlyIncome: 2500000,
    hasSavings: false,
    hasDebt: false,
    readiness: 'limited_data',
  },
  {
    key: 'pelajar_ready',
    email: 'demo.pelajar.ready@dompetcerdas.test',
    name: 'Irfan Pelajar (Ready)',
    userSegment: 'pelajar_mahasiswa',
    monthlyIncome: 2500000,
    hasSavings: false,
    hasDebt: false,
    readiness: 'enough_data',
  },
];

// ─── Budget template per segmen (monthly) ───────────────────────────────────────

const BUDGET_TEMPLATES = {
  pekerja_tetap: {
    totalBudget: 8000000,
    needsPercent: 50,
    wantsPercent: 30,
    savingsPercent: 20,
    allocations: {
      makanan: 1500000,
      transportasi: 600000,
      tagihan: 1200000,
      kos_sewa: 0,
      belanja: 800000,
      hiburan: 500000,
      kesehatan: 300000,
      pendidikan: 0,
      lainnya: 200000,
    },
  },
  freelancer: {
    totalBudget: 5000000,
    needsPercent: 55,
    wantsPercent: 25,
    savingsPercent: 20,
    allocations: {
      makanan: 1200000,
      transportasi: 400000,
      tagihan: 800000,
      kos_sewa: 1000000,
      belanja: 400000,
      hiburan: 300000,
      kesehatan: 150000,
      pendidikan: 0,
      lainnya: 150000,
    },
  },
  pelajar_mahasiswa: {
    totalBudget: 2500000,
    needsPercent: 55,
    wantsPercent: 25,
    savingsPercent: 20,
    allocations: {
      makanan: 800000,
      transportasi: 250000,
      tagihan: 100000,
      kos_sewa: 600000,
      belanja: 200000,
      hiburan: 200000,
      kesehatan: 50000,
      pendidikan: 200000,
      lainnya: 50000,
    },
  },
};

// ─── Transaction generators per segmen ─────────────────────────────────────────

/**
 * Helper: random int between min and max (inclusive)
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Helper: pick random element from array
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate realistic transactions for a given month and segment.
 * Returns { expenses: [...], incomes: [...] }
 */
function generateMonthTransactions(userSegment, monthDate, variation = 0.15) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const expenses = [];
  const incomes = [];

  // ── Expense patterns per segmen ──────────────────────────────────────────
  const expensePatterns = {
    pekerja_tetap: [
      // Frequent small expenses
      { slug: 'makanan', countRange: [15, 25], amountRange: [20000, 65000], desc: ['Makan siang kantor', 'Sarapan', 'Makan malam', 'Kopi', 'Snack'] },
      // Medium regular
      { slug: 'transportasi', countRange: [8, 15], amountRange: [15000, 50000], desc: ['Ojol ke kantor', 'Grab', 'Bensin', 'Parkir', 'Tol'] },
      { slug: 'tagihan', countRange: [3, 5], amountRange: [100000, 500000], desc: ['Listrik', 'Internet', 'Air', 'Pulsa', 'BPJS'] },
      // Occasional
      { slug: 'belanja', countRange: [2, 4], amountRange: [100000, 400000], desc: ['Belanja bulanan', 'Baju baru', 'Elektronik', 'Peralatan rumah'] },
      { slug: 'hiburan', countRange: [2, 4], amountRange: [50000, 200000], desc: ['Nonton bioskop', 'Streaming', 'Jalan-jalan', 'Karaoke'] },
      { slug: 'kesehatan', countRange: [0, 2], amountRange: [50000, 200000], desc: ['Obat', 'Vitamin', 'Gym'] },
    ],
    freelancer: [
      { slug: 'makanan', countRange: [12, 20], amountRange: [15000, 50000], desc: ['Makan warteg', 'GoFood', 'Makan malam', 'Kopi', 'Roti'] },
      { slug: 'transportasi', countRange: [5, 10], amountRange: [10000, 40000], desc: ['Ojol', 'TransJakarta', 'Grab', 'bensin motor'] },
      { slug: 'kos_sewa', countRange: [1, 1], amountRange: [900000, 1200000], desc: ['Bayar kos bulanan'] },
      { slug: 'tagihan', countRange: [2, 4], amountRange: [50000, 300000], desc: ['Listrik kos', 'Internet', 'Pulsa'] },
      { slug: 'belanja', countRange: [1, 3], amountRange: [50000, 250000], desc: ['Belanja kebutuhan', 'Shopee', 'Tokopedia'] },
      { slug: 'hiburan', countRange: [1, 3], amountRange: [30000, 150000], desc: ['Netflix', 'Nonton', 'Gaming', 'Jalan-jalan'] },
    ],
    pelajar_mahasiswa: [
      { slug: 'makanan', countRange: [18, 28], amountRange: [10000, 35000], desc: ['Makan kantin', 'Nasi goreng', 'Indomie', 'Kopi kantin', 'Snack'] },
      { slug: 'transportasi', countRange: [8, 12], amountRange: [5000, 20000], desc: ['Angkot', 'Ojol kampus', 'Bensin motor', 'Parkir kampus'] },
      { slug: 'pendidikan', countRange: [1, 3], amountRange: [50000, 150000], desc: ['Fotokopi', 'Buku', 'Alat tulis', 'Praktikum'] },
      { slug: 'kos_sewa', countRange: [1, 1], amountRange: [500000, 700000], desc: ['Bayar kos bulanan'] },
      { slug: 'tagihan', countRange: [1, 2], amountRange: [30000, 100000], desc: ['Pulsa', 'Internet kos'] },
      { slug: 'hiburan', countRange: [1, 3], amountRange: [15000, 60000], desc: ['Nonton', 'Jajan', 'Game warnet'] },
    ],
  };

  // ── Income patterns per segmen ───────────────────────────────────────────
  const incomePatterns = {
    pekerja_tetap: [
      { slug: 'gaji', countRange: [1, 1], amountRange: [7500000, 9000000], desc: ['Gaji bulanan'] },
    ],
    freelancer: [
      { slug: 'freelance_bonus', countRange: [1, 4], amountRange: [500000, 3000000], desc: ['Project UI/UX', 'Freelance web', 'Commission', 'Side job', 'Bonus client'] },
    ],
    pelajar_mahasiswa: [
      { slug: 'pemasukan_lain', countRange: [1, 2], amountRange: [1000000, 1500000], desc: ['Uang saku bulanan', 'Kiriman orang tua'] },
    ],
  };

  // Generate expenses
  const patterns = expensePatterns[userSegment] || expensePatterns.pekerja_tetap;
  for (const pattern of patterns) {
    const count = randInt(pattern.countRange[0], pattern.countRange[1]);
    for (let i = 0; i < count; i++) {
      const baseAmount = randInt(pattern.amountRange[0], pattern.amountRange[1]);
      // Apply variation
      const variance = Math.floor(baseAmount * variation * (Math.random() * 2 - 1));
      const amount = Math.max(1000, baseAmount + variance);
      const day = randInt(1, daysInMonth);
      const date = new Date(year, month, day, randInt(6, 22), randInt(0, 59));

      expenses.push({
        type: 'expense',
        categorySlug: pattern.slug,
        amount,
        description: pick(pattern.desc),
        date,
      });
    }
  }

  // Generate incomes
  const incPatterns = incomePatterns[userSegment] || incomePatterns.pekerja_tetap;
  for (const pattern of incPatterns) {
    const count = randInt(pattern.countRange[0], pattern.countRange[1]);
    for (let i = 0; i < count; i++) {
      const baseAmount = randInt(pattern.amountRange[0], pattern.amountRange[1]);
      const variance = Math.floor(baseAmount * variation * (Math.random() * 2 - 1));
      const amount = Math.max(10000, baseAmount + variance);
      // Income usually comes early-mid month
      const day = randInt(1, Math.min(15, daysInMonth));
      const date = new Date(year, month, day, randInt(8, 17), randInt(0, 59));

      incomes.push({
        type: 'income',
        categorySlug: pattern.slug,
        amount,
        description: pick(pattern.desc),
        date,
      });
    }
  }

  return { expenses, incomes };
}

/**
 * Generate anomalous transactions for a user.
 * These are intentional outliers: amounts far above the user's normal spending pattern.
 * Used to ensure AN1 skenario (anomali terdeteksi) works for *_ready users.
 *
 * Strategy: amount_to_user_avg_ratio and amount_to_category_avg_ratio will be very high
 * (5-15x normal), and monthly_income_ratio will approach 1.0 — these features will
 * push reconstruction error well above the autoencoder threshold (0.00525).
 */
function generateAnomalyTransactions(userSegment, baseMonthDate) {
  const year = baseMonthDate.getFullYear();
  const month = baseMonthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Anomaly amounts are 5-15x the typical expense for that segment
  const anomalyTemplates = {
    pekerja_tetap: [
      {
        slug: 'belanja',
        amount: 4500000, // Normal belanja: 100k-400k → ini 10-45x spike
        description: 'Pembelian laptop mendadak',
        dayOffset: 10,
      },
      {
        slug: 'hiburan',
        amount: 3200000, // Normal hiburan: 50k-200k → ini 16-64x spike
        description: 'Konser musik luar kota',
        dayOffset: 20,
      },
    ],
    freelancer: [
      {
        slug: 'belanja',
        amount: 3800000, // Normal belanja: 50k-250k → ini 15-76x spike
        description: 'Beli peralatan kerja dadakan',
        dayOffset: 8,
      },
      {
        slug: 'hiburan',
        amount: 2500000, // Normal hiburan: 30k-150k → ini 17-83x spike
        description: 'Trip akhir pekan spontan',
        dayOffset: 22,
      },
    ],
    pelajar_mahasiswa: [
      {
        slug: 'belanja',
        amount: 2200000, // Normal belanja: tidak ada → anomali besar
        description: 'Beli gadget baru (tidak direncanakan)',
        dayOffset: 12,
      },
      {
        slug: 'hiburan',
        amount: 1500000, // Normal hiburan: 15k-60k → ini 25-100x spike
        description: 'Tiket konser + akomodasi',
        dayOffset: 25,
      },
    ],
  };

  const templates = anomalyTemplates[userSegment] || anomalyTemplates.pekerja_tetap;
  return templates.map((t) => {
    const day = Math.min(t.dayOffset, daysInMonth);
    return {
      type: 'expense',
      categorySlug: t.slug,
      amount: t.amount,
      description: t.description,
      date: new Date(year, month, day, 14, 30),
      isAnomaly: true, // marker for logging
    };
  });
}

/**
 * Get months to generate transactions for based on readiness.
 * Returns array of Date objects (first day of each month).
 */
function getMonthsForReadiness(readiness) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  switch (readiness) {
    case 'no_data':
      return [];
    case 'limited_data': {
      // 2 months back + current month (so dashboard cards show data on load)
      const months = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        months.push(d);
      }
      return months;
    }
    case 'enough_data': {
      // 4 months back + current month (≥3 for LSTM + current for dashboard)
      const months = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        months.push(d);
      }
      return months;
    }
    default:
      return [];
  }
}

/**
 * Get month-year string in "YYYY-MM" format for a Date.
 */
function monthYearKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─── Main seed function ────────────────────────────────────────────────────────

/**
 * Seed test users with their transactions and budgets.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {Object} categoryMap - Map of slug -> { id } for categories
 */
async function seedTestUsers(prisma, categoryMap) {
  console.log('\n── Seeding test users (9 users × 3 segmen × 3 readiness) ──');

  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 12);
  const createdUsers = [];

  for (const userData of TEST_USERS) {
    // ── Upsert user ──────────────────────────────────────────────────────
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        passwordHash,
        userSegment: userData.userSegment,
        monthlyIncome: userData.monthlyIncome,
        hasSavings: userData.hasSavings,
        hasDebt: userData.hasDebt,
      },
      create: {
        email: userData.email,
        name: userData.name,
        passwordHash,
        userSegment: userData.userSegment,
        monthlyIncome: userData.monthlyIncome,
        hasSavings: userData.hasSavings,
        hasDebt: userData.hasDebt,
      },
    });

    const txMonths = getMonthsForReadiness(userData.readiness);
    let txCount = 0;

    // ── Generate transactions per month ──────────────────────────────────
    for (const monthDate of txMonths) {
      const { expenses, incomes } = generateMonthTransactions(
        userData.userSegment,
        monthDate,
      );

      // For *_ready users: inject anomaly transactions into the MOST RECENT month
      // so that anomaly scan (POST /anomalies/scan) can detect them immediately
      const isLastMonth =
        userData.readiness === 'enough_data' &&
        monthDate.getFullYear() === txMonths[txMonths.length - 1].getFullYear() &&
        monthDate.getMonth() === txMonths[txMonths.length - 1].getMonth();

      const anomalyTxs = isLastMonth
        ? generateAnomalyTransactions(userData.userSegment, monthDate)
        : [];

      const allTx = [...expenses, ...incomes, ...anomalyTxs];
      for (const tx of allTx) {
        const category = categoryMap[tx.categorySlug];
        if (!category) continue;

        await prisma.transaction.create({
          data: {
            userId: user.id,
            categoryId: category.id,
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            date: tx.date,
          },
        });
        txCount++;
      }

      // ── Seed budget for this month (limited + enough data only) ───────
      const budgetTemplate = BUDGET_TEMPLATES[userData.userSegment];
      if (budgetTemplate) {
        const my = monthYearKey(monthDate);

        await prisma.userBudgetSetting.upsert({
          where: { userId_monthYear: { userId: user.id, monthYear: my } },
          update: {
            totalBudget: budgetTemplate.totalBudget,
            needsPercent: budgetTemplate.needsPercent,
            wantsPercent: budgetTemplate.wantsPercent,
            savingsPercent: budgetTemplate.savingsPercent,
          },
          create: {
            userId: user.id,
            monthYear: my,
            totalBudget: budgetTemplate.totalBudget,
            needsPercent: budgetTemplate.needsPercent,
            wantsPercent: budgetTemplate.wantsPercent,
            savingsPercent: budgetTemplate.savingsPercent,
          },
        });

        // ── Seed category allocations ───────────────────────────────────
        for (const [slug, amount] of Object.entries(budgetTemplate.allocations)) {
          const category = categoryMap[slug];
          if (!category || amount === 0) continue;

          await prisma.budgetCategoryAllocation.upsert({
            where: {
              userId_categoryId_monthYear: {
                userId: user.id,
                categoryId: category.id,
                monthYear: my,
              },
            },
            update: { budgetAmount: amount },
            create: {
              userId: user.id,
              categoryId: category.id,
              monthYear: my,
              budgetAmount: amount,
            },
          });
        }
      }
    }

    const readinessLabel = userData.readiness.padEnd(14);
    const segmentLabel = userData.userSegment.padEnd(20);
    console.log(
      `  ✓ ${userData.email}`,
      `\n    segmen: ${segmentLabel} readiness: ${readinessLabel} transactions: ${txCount}`,
    );
    createdUsers.push({ ...userData, id: user.id });
  }

  console.log(`\n  Total: ${createdUsers.length} test users created.`);
  return createdUsers;
}

module.exports = { TEST_USERS, PASSWORD_PLAIN, seedTestUsers };