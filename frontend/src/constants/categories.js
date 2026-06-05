export const EXPENSE_CATEGORIES = [
  { slug: 'makanan', label: 'Makanan', color: '#F59E0B', badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200', barClass: 'bg-orange-500' },
  { slug: 'transportasi', label: 'Transportasi', color: '#3B82F6', badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200', barClass: 'bg-blue-500' },
  { slug: 'belanja', label: 'Belanja', color: '#EC4899', badgeClass: 'bg-pink-100 text-pink-700 border border-pink-200', barClass: 'bg-pink-500' },
  { slug: 'tagihan', label: 'Tagihan', color: '#EF4444', badgeClass: 'bg-red-100 text-red-700 border border-red-200', barClass: 'bg-red-500' },
  { slug: 'hiburan', label: 'Hiburan', color: '#8B5CF6', badgeClass: 'bg-purple-100 text-purple-700 border border-purple-200', barClass: 'bg-purple-500' },
  { slug: 'kesehatan', label: 'Kesehatan', color: '#10B981', badgeClass: 'bg-teal-100 text-teal-700 border border-teal-200', barClass: 'bg-emerald-500' },
  { slug: 'pendidikan', label: 'Pendidikan', color: '#06B6D4', badgeClass: 'bg-cyan-100 text-cyan-700 border border-cyan-200', barClass: 'bg-cyan-500' },
  { slug: 'kos_sewa', label: 'Kos/Sewa', color: '#F97316', badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200', barClass: 'bg-orange-600' },
  { slug: 'lainnya', label: 'Lainnya', color: '#6B7280', badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200', barClass: 'bg-gray-500' },
];

export const INCOME_CATEGORIES = [
  { slug: 'gaji', label: 'Gaji', color: '#22C55E', badgeClass: 'bg-green-100 text-green-700 border border-green-200', barClass: 'bg-green-500' },
  { slug: 'freelance_bonus', label: 'Freelance/Bonus', color: '#14B8A6', badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200', barClass: 'bg-teal-500' },
  { slug: 'pemasukan_lain', label: 'Pemasukan Lain', color: '#84CC16', badgeClass: 'bg-lime-100 text-lime-700 border border-lime-200', barClass: 'bg-lime-500' },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const CATEGORY_LABELS = ALL_CATEGORIES.reduce((labels, category) => {
  labels[category.slug] = category.label;
  return labels;
}, {});

export const CATEGORY_BADGE_CLASSES = ALL_CATEGORIES.reduce((classes, category) => {
  classes[category.slug] = category.badgeClass;
  return classes;
}, {});

export const CATEGORY_BAR_CLASSES = ALL_CATEGORIES.reduce((classes, category) => {
  classes[category.slug] = category.barClass;
  return classes;
}, {});

export const CATEGORY_COLORS = ALL_CATEGORIES.reduce((colors, category) => {
  colors[category.slug] = category.color;
  return colors;
}, {});