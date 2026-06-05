'use strict';

const { PrismaClient } = require('@prisma/client');
const { seedTestUsers } = require('./seeds/test-users');

async function main() {
  const prisma = new PrismaClient();

  const testEmails = [
    'demo.pekerja.nodata@dompetcerdas.test',
    'demo.pekerja.limited@dompetcerdas.test',
    'demo.pekerja.ready@dompetcerdas.test',
    'demo.freelancer.nodata@dompetcerdas.test',
    'demo.freelancer.limited@dompetcerdas.test',
    'demo.freelancer.ready@dompetcerdas.test',
    'demo.pelajar.nodata@dompetcerdas.test',
    'demo.pelajar.limited@dompetcerdas.test',
    'demo.pelajar.ready@dompetcerdas.test',
  ];

  // 1. Find test users
  const users = await prisma.user.findMany({
    where: { email: { in: testEmails } },
    select: { id: true, email: true },
  });
  const userIds = users.map(u => u.id);
  console.log(`Found ${users.length} test users.`);

  // 2. Delete existing transactions and budgets
  if (userIds.length > 0) {
    const txResult = await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
    console.log(`Deleted ${txResult.count} transactions.`);

    const budgetResult = await prisma.budgetCategoryAllocation.deleteMany({ where: { userId: { in: userIds } } });
    console.log(`Deleted ${budgetResult.count} budget category allocations.`);

    const budgetSettingResult = await prisma.userBudgetSetting.deleteMany({ where: { userId: { in: userIds } } });
    console.log(`Deleted ${budgetSettingResult.count} budget settings.`);
  }

  // 3. Seed categories
  const categories = [
    { name: 'Makanan', slug: 'makanan', type: 'expense', icon: 'utensils', color: '#F59E0B' },
    { name: 'Transportasi', slug: 'transportasi', type: 'expense', icon: 'car', color: '#3B82F6' },
    { name: 'Belanja', slug: 'belanja', type: 'expense', icon: 'shopping-bag', color: '#EC4899' },
    { name: 'Tagihan', slug: 'tagihan', type: 'expense', icon: 'receipt', color: '#EF4444' },
    { name: 'Hiburan', slug: 'hiburan', type: 'expense', icon: 'film', color: '#8B5CF6' },
    { name: 'Kesehatan', slug: 'kesehatan', type: 'expense', icon: 'heart-pulse', color: '#10B981' },
    { name: 'Pendidikan', slug: 'pendidikan', type: 'expense', icon: 'book-open', color: '#06B6D4' },
    { name: 'Kos/Sewa', slug: 'kos_sewa', type: 'expense', icon: 'home', color: '#F97316' },
    { name: 'Lainnya', slug: 'lainnya', type: 'expense', icon: 'archive', color: '#6B7280' },
    { name: 'Gaji', slug: 'gaji', type: 'income', icon: 'briefcase', color: '#22C55E' },
    { name: 'Freelance/Bonus', slug: 'freelance_bonus', type: 'income', icon: 'badge-dollar-sign', color: '#14B8A6' },
    { name: 'Pemasukan Lain', slug: 'pemasukan_lain', type: 'income', icon: 'wallet', color: '#84CC16' },
  ];

  const categoryMap = {};
  for (const cat of categories) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, color: cat.color },
      create: { name: cat.name, slug: cat.slug, type: cat.type, icon: cat.icon, color: cat.color },
    });
    categoryMap[record.slug] = { id: record.id };
  }
  console.log(`✓ ${categories.length} categories ready.`);

  // 4. Re-seed test users
  await seedTestUsers(prisma, categoryMap);

  console.log('\n✅ Re-seed completed!');
  await prisma.$disconnect();
}

main().catch(e => { console.error('❌ Failed:', e); process.exit(1); });