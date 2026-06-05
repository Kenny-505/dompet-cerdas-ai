'use strict';

const prisma = require('../utils/prisma');
const { EXPENSE_CATEGORY_SLUGS } = require('../utils/categories');
const ApiError = require('../utils/apiError');

/**
 * Get budget setting and allocations for a month
 */
async function get(userId, monthYear) {
  const [setting, allocations] = await Promise.all([
    prisma.userBudgetSetting.findUnique({ where: { userId_monthYear: { userId, monthYear } } }),
    prisma.budgetCategoryAllocation.findMany({
      where: { userId, monthYear },
      include: { category: true },
    }),
  ]);

  return { setting, allocations };
}

/**
 * Upsert budget with category allocations
 * Supports both categoryId and categorySlug for allocations
 */
async function upsert(userId, body) {
  const { monthYear, totalBudget, needsPercent = 50, wantsPercent = 30, savingsPercent = 20, allocations = [] } = body;

  // Validate: sum of category allocations must not exceed totalBudget
  const validatedAllocations = allocations.filter(a => a.budgetAmount && Number(a.budgetAmount) > 0);
  const totalAllocated = validatedAllocations.reduce((sum, a) => sum + Number(a.budgetAmount), 0);
  if (totalAllocated > Number(totalBudget)) {
    throw new ApiError(
      400,
      `Total alokasi per kategori (${totalAllocated}) melebihi total budget (${totalBudget}). Kurangi alokasi kategori.`
    );
  }

  const setting = await prisma.userBudgetSetting.upsert({
    where: { userId_monthYear: { userId, monthYear } },
    update: { totalBudget, needsPercent, wantsPercent, savingsPercent },
    create: { userId, monthYear, totalBudget, needsPercent, wantsPercent, savingsPercent },
  });

  // Process allocations - support both categoryId and categorySlug
  for (const alloc of allocations) {
    let categoryId = alloc.categoryId;

    // Resolve categoryId from categorySlug if provided
    if (!categoryId && alloc.categorySlug) {
      // Only allow expense category slugs for budget allocation
      if (!EXPENSE_CATEGORY_SLUGS.includes(alloc.categorySlug)) {
        continue; // Skip income/legacy categories
      }
      const cat = await prisma.category.findUnique({ where: { slug: alloc.categorySlug } });
      if (cat) categoryId = cat.id;
    }

    if (!categoryId) continue;

    await prisma.budgetCategoryAllocation.upsert({
      where: { userId_categoryId_monthYear: { userId, categoryId, monthYear } },
      update: { budgetAmount: alloc.budgetAmount },
      create: { userId, categoryId, monthYear, budgetAmount: alloc.budgetAmount },
    });
  }

  return setting;
}

/**
 * Calculate budget status based on utilization
 * @param {number} utilization - percentage used (0-100+)
 * @returns {string} - 'not_set', 'on_track', 'warning', 'exceeded'
 */
function calculateStatus(utilization) {
  if (utilization === 0) return 'not_set';
  if (utilization < 80) return 'on_track';
  if (utilization <= 100) return 'warning';
  return 'exceeded';
}

/**
 * Get budget summary with spent amount and status per category
 */
async function summary(userId, monthYear) {
  const [setting, allocations, transactions] = await Promise.all([
    prisma.userBudgetSetting.findUnique({ where: { userId_monthYear: { userId, monthYear } } }),
    prisma.budgetCategoryAllocation.findMany({
      where: { userId, monthYear },
      include: { category: true },
    }),
    // Ambil transaksi expense bulan tersebut
    prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: new Date(`${monthYear}-01`),
          lt: new Date(new Date(`${monthYear}-01`).setMonth(new Date(`${monthYear}-01`).getMonth() + 1)),
        },
      },
      include: { category: true },
    }),
  ]);

  // Hitung total pengeluaran per kategori
  const spentByCategory = {};
  for (const tx of transactions) {
    const slug = tx.category?.slug || 'lainnya';
    spentByCategory[slug] = (spentByCategory[slug] || 0) + parseFloat(tx.amount);
  }

  const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalBudget = setting ? parseFloat(setting.totalBudget) : 0;
  const utilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Process allocations with spent and status
  const processedAllocations = allocations.map((a) => {
    const categorySlug = a.category?.slug;
    const spent = spentByCategory[categorySlug] || 0;
    const budgetAmount = parseFloat(a.budgetAmount);
    const percentageUsed = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
    const status = calculateStatus(percentageUsed);

    return {
      categoryId: a.categoryId,
      categorySlug,
      categoryName: a.category?.name,
      budgetAmount,
      spent,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      status,
    };
  });

  return {
    monthYear,
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
    utilization: Math.round(utilization * 100) / 100,
    status: calculateStatus(utilization),
    setting,
    allocations: processedAllocations,
  };
}

module.exports = { get, upsert, summary, calculateStatus };

