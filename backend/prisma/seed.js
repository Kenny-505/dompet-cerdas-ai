'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { seedTestUsers } = require('./seeds/test-users');

async function seedCategories() {
  console.log('── Seeding fixed categories ──');
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
  console.log(`  ✓ ${categories.length} categories seeded.`);
  return categoryMap;
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // 1. Seed categories
  const categoryMap = await seedCategories();

  // 2. Seed 9 test users (3 segments × 3 readiness)
  await seedTestUsers(prisma, categoryMap);

  console.log('\n✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });