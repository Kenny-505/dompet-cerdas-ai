'use strict';

const EXPENSE_CATEGORY_SLUGS = [
  'makanan',
  'transportasi',
  'belanja',
  'tagihan',
  'hiburan',
  'kesehatan',
  'pendidikan',
  'kos_sewa',
  'lainnya',
];

const INCOME_CATEGORY_SLUGS = [
  'gaji',
  'freelance_bonus',
  'pemasukan_lain',
];

const FIXED_CATEGORIES = [
  { slug: 'makanan', name: 'Makanan', icon: 'utensils', color: '#F59E0B', type: 'expense' },
  { slug: 'transportasi', name: 'Transportasi', icon: 'car', color: '#3B82F6', type: 'expense' },
  { slug: 'belanja', name: 'Belanja', icon: 'shopping-bag', color: '#EC4899', type: 'expense' },
  { slug: 'tagihan', name: 'Tagihan', icon: 'receipt', color: '#EF4444', type: 'expense' },
  { slug: 'hiburan', name: 'Hiburan', icon: 'film', color: '#8B5CF6', type: 'expense' },
  { slug: 'kesehatan', name: 'Kesehatan', icon: 'heart-pulse', color: '#10B981', type: 'expense' },
  { slug: 'pendidikan', name: 'Pendidikan', icon: 'book-open', color: '#06B6D4', type: 'expense' },
  { slug: 'kos_sewa', name: 'Kos/Sewa', icon: 'home', color: '#F97316', type: 'expense' },
  { slug: 'lainnya', name: 'Lainnya', icon: 'archive', color: '#6B7280', type: 'expense' },
  { slug: 'gaji', name: 'Gaji', icon: 'briefcase', color: '#22C55E', type: 'income' },
  { slug: 'freelance_bonus', name: 'Freelance/Bonus', icon: 'badge-dollar-sign', color: '#14B8A6', type: 'income' },
  { slug: 'pemasukan_lain', name: 'Pemasukan Lain', icon: 'wallet', color: '#84CC16', type: 'income' },
];

const ALL_CATEGORY_SLUGS = FIXED_CATEGORIES.map((category) => category.slug);
const LEGACY_CATEGORY_SLUGS = ['investasi', 'sosial', 'perawatan_diri', 'perjalanan'];

module.exports = {
  FIXED_CATEGORIES,
  ALL_CATEGORY_SLUGS,
  EXPENSE_CATEGORY_SLUGS,
  INCOME_CATEGORY_SLUGS,
  LEGACY_CATEGORY_SLUGS,
};
