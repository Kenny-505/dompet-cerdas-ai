import { useCallback, useEffect, useState } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AlertCircle, AlertTriangle, Check, Pencil, PiggyBank, X } from 'lucide-react';
import { budgetService } from '../services/budgetService';
import { CATEGORY_BAR_CLASSES, CATEGORY_LABELS, EXPENSE_CATEGORIES } from '../constants/categories';

function currentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatRp(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function toNumber(value) {
  return Number(value ?? 0);
}

/**
 * Format number to Indonesian thousands (e.g. 2500000 → "2.500.000")
 * Returns empty string for 0/falsy so placeholder shows
 */
function formatThousands(value) {
  const num = Number(String(value).replace(/\./g, ''));
  if (!num) return '';
  return num.toLocaleString('id-ID');
}

/**
 * Input Rupiah — displays formatted thousands, stores raw number
 */
/**
 * Hitung step berdasarkan nilai saat ini.
 * Aturan: step = 10^(jumlah digit - 1)
 * mis. 1000 (4 digit) → step 1000, 10000 → 10000, 100000 → 100000, dll.
 * Minimum step = 1000.
 */
function getStep(num) {
  if (!num || num <= 0) return 1000;
  const digits = Math.floor(Math.log10(num)) + 1; // jumlah digit
  const step = Math.pow(10, digits - 1);
  return Math.max(step, 1000);
}

function RupiahInput({ value, onChange, placeholder = '0', id, className = '' }) {
  const [display, setDisplay] = useState(() => formatThousands(value));

  // Sync external value changes (e.g. on modal open)
  useEffect(() => {
    setDisplay(formatThousands(value));
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    const num = Number(raw) || 0;
    setDisplay(num ? num.toLocaleString('id-ID') : '');
    onChange(num || '');
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = Number(String(value).replace(/\./g, '')) || 0;
    const step = getStep(current);
    const next = e.key === 'ArrowUp'
      ? current + step
      : Math.max(0, current - step);
    setDisplay(next ? next.toLocaleString('id-ID') : '');
    onChange(next || '');
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
}

function BudgetSettingModal({ open, onClose, summary, onSaved }) {
  const [totalBudget, setTotalBudget] = useState('');
  const [needs, setNeeds] = useState(50);
  const [wants, setWants] = useState(30);
  const [savings, setSavings] = useState(20);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const setting = summary?.setting;
    setTotalBudget(setting?.totalBudget ?? summary?.totalBudget ?? '');
    setNeeds(toNumber(setting?.needsPercent || 50));
    setWants(toNumber(setting?.wantsPercent || 30));
    setSavings(toNumber(setting?.savingsPercent || 20));
    setError('');
    
    // Initialize allocations from existing summary
    const existingAllocations = summary?.allocations || [];
    const allocationMap = {};
    existingAllocations.forEach(a => {
      allocationMap[a.categorySlug] = a.budgetAmount;
    });
    
    const defaultAllocations = EXPENSE_CATEGORIES.map(cat => ({
      categorySlug: cat.slug,
      categoryLabel: cat.label,
      budgetAmount: allocationMap[cat.slug] || ''
    }));
    setAllocations(defaultAllocations);
  }, [open, summary]);

  if (!open) return null;

  const total = Number(needs) + Number(wants) + Number(savings);

  const handleAllocationChange = (index, value) => {
    setAllocations(prev => prev.map((a, i) => 
      i === index ? { ...a, budgetAmount: value } : a
    ));
  };

  // Real-time total allocated (for hint display)
  const totalAllocatedLive = allocations
    .filter(a => a.budgetAmount && Number(a.budgetAmount) > 0)
    .reduce((sum, a) => sum + Number(a.budgetAmount), 0);
  const remainingToAllocate = Number(totalBudget) - totalAllocatedLive;
  const allocationOverLimit = Number(totalBudget) > 0 && totalAllocatedLive > Number(totalBudget);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (total !== 100) return setError('Total persentase harus 100%.');
    if (!totalBudget || Number(totalBudget) <= 0) return setError('Masukkan total budget yang valid.');

    // Validate: sum of category allocations must not exceed totalBudget
    const validAllocations = allocations
      .filter(a => a.budgetAmount && Number(a.budgetAmount) > 0)
      .map(a => ({
        categorySlug: a.categorySlug,
        budgetAmount: Number(a.budgetAmount)
      }));

    const totalAllocated = validAllocations.reduce((sum, a) => sum + a.budgetAmount, 0);
    if (totalAllocated > Number(totalBudget)) {
      return setError(
        `Total alokasi per kategori (${formatRp(totalAllocated)}) melebihi total budget (${formatRp(Number(totalBudget))}). Kurangi alokasi kategori.`
      );
    }

    setLoading(true);
    setError('');
    try {
      
      await budgetService.update({
        monthYear: summary?.monthYear || currentMonthYear(),
        totalBudget: Number(totalBudget),
        needsPercent: Number(needs),
        wantsPercent: Number(wants),
        savingsPercent: Number(savings),
        allocations: validAllocations,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-[#E8D5C4] rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8D5C4]">
          <h2 className="text-base font-semibold text-gray-900">Pengaturan Budget</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Total Budget Bulanan (Rp)</label>
            <RupiahInput
              id="budget-total"
              value={totalBudget}
              onChange={setTotalBudget}
              placeholder="5.000.000"
              className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
            />
          </div>

          <div className="bg-[#FFF5E6] border border-[#E8D5C4] rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Alokasi 50/30/20 (%)</p>
            {[
              { id: 'needs', label: 'Kebutuhan', value: needs, setter: setNeeds, color: 'text-[#2C5282]' },
              { id: 'wants', label: 'Keinginan', value: wants, setter: setWants, color: 'text-purple-600' },
              { id: 'savings', label: 'Tabungan', value: savings, setter: setSavings, color: 'text-green-600' },
            ].map(({ id, label, value, setter, color }) => (
              <div key={id} className="flex items-center gap-3">
                <span className={`text-sm font-medium w-32 ${color}`}>{label}</span>
                <input
                  id={`budget-${id}`}
                  type="number"
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  min="0"
                  max="100"
                  className="w-20 bg-white border border-[#E8D5C4] rounded-lg px-3 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
                />
                <span className="text-gray-500 text-sm">%</span>
              </div>
            ))}
            <div className={`text-xs font-medium pt-1 ${total === 100 ? 'text-green-600' : 'text-red-600'}`}>
              Total: {total}%
          </div>

            </div>

          {/* Category Allocations Section */}
          <div className="bg-[#FFF5E6] border border-[#E8D5C4] rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Alokasi per Kategori (Opsional)</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allocations.map((allocation, index) => (
                <div key={allocation.categorySlug} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-32 truncate">{allocation.categoryLabel}</span>
                  <RupiahInput
                    value={allocation.budgetAmount}
                    onChange={(val) => handleAllocationChange(index, val)}
                    placeholder="0"
                    className="flex-1 bg-white border border-[#E8D5C4] rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] transition-colors"
                  />
                  <span className="text-gray-500 text-xs">Rp</span>
                </div>
              ))}
            </div>
            <div className={`flex items-center justify-between text-xs pt-2 border-t border-[#E8D5C4] mt-1`}>
              <span className="text-gray-500">Total dialokasikan:</span>
              <span className={`font-medium ${allocationOverLimit ? 'text-red-600' : 'text-gray-700'}`}>
                {formatRp(totalAllocatedLive)}
                {Number(totalBudget) > 0 && (
                  <span className={`ml-1 ${allocationOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                    ({allocationOverLimit ? `melebihi ${formatRp(-remainingToAllocate)}` : `sisa ${formatRp(remainingToAllocate)}`})
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-gray-500">Isi untuk mengatur budget per kategori pengeluaran</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} />{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E8D5C4] text-sm text-gray-500 hover:bg-[#FFF5E6] hover:text-gray-700 transition-colors">
              Batal
            </button>
            <button type="submit" id="budget-save" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#FAD4C0] hover:bg-[#F5C0A8] disabled:opacity-60 text-sm font-medium text-[#7C4A2D] transition-colors flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-[#7C4A2D]/30 border-t-[#7C4A2D] rounded-full animate-spin" /> : <Check size={15} />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BudgetPage() {
  useDocumentTitle('Budget');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const monthYear = currentMonthYear();

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await budgetService.summary({ monthYear });
      setSummary(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat data budget.');
    } finally {
      setLoading(false);
    }
  }, [monthYear]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const setting = summary?.setting;
  const totalBudget = toNumber(setting?.totalBudget ?? summary?.totalBudget);
  const needsPercent = toNumber(setting?.needsPercent || 50);
  const wantsPercent = toNumber(setting?.wantsPercent || 30);
  const savingsPercent = toNumber(setting?.savingsPercent || 20);
  const needsBudget = totalBudget * (needsPercent / 100);
  const wantsBudget = totalBudget * (wantsPercent / 100);
  const savingsBudget = totalBudget * (savingsPercent / 100);
  const allocations = summary?.allocations || [];
  
  // Helper to get category display name
  const getCategoryName = (allocation) => {
    const slug = allocation?.category?.slug || allocation?.categorySlug;
    return CATEGORY_LABELS[slug] || allocation?.category?.name || allocation?.categoryLabel || 'Lainnya';
  };
  
  const overBudget = allocations.filter((allocation) => {
    const budgetAmount = toNumber(allocation.budgetAmount);
    return budgetAmount > 0 && (toNumber(allocation.spent) / budgetAmount) * 100 > 80;
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Planner</h1>
          <p className="text-gray-500 text-sm mt-0.5">Atur keuangan dengan aturan 50/30/20</p>
        </div>
        <button id="btn-budget-setting" onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#FAD4C0] hover:bg-[#F5C0A8] text-[#7C4A2D] rounded-xl font-medium text-sm transition-colors shadow-sm">
          <Pencil size={15} /> Atur Budget
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="w-8 h-8 border-2 border-[#FAD4C0]/30 border-t-[#FAD4C0] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-48 gap-2 text-red-600 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      ) : (
        <>
          {overBudget.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-800 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Peringatan Budget</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {overBudget.map((allocation) => CATEGORY_LABELS[allocation.category?.slug] || allocation.category?.name || 'Kategori').join(', ')} sudah melebihi 80% alokasi.
                </p>
              </div>
            </div>
          )}

          {!totalBudget ? (
            <div className="bg-white border border-dashed border-[#E8D5C4] rounded-2xl p-8 text-center">
              <PiggyBank size={32} className="text-[#7C4A2D] mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Belum ada pengaturan budget</p>
              <p className="text-gray-500 text-xs mt-1 mb-4">Klik "Atur Budget" untuk mulai merencanakan keuangan Anda</p>
              <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-[#FAD4C0] hover:bg-[#F5C0A8] text-[#7C4A2D] rounded-xl text-sm font-medium transition-colors">
                Mulai Sekarang
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Kebutuhan', pct: needsPercent, budget: needsBudget, color: 'from-blue-500 to-blue-600', glow: 'shadow-blue-500/20' },
                  { label: 'Keinginan', pct: wantsPercent, budget: wantsBudget, color: 'from-purple-500 to-purple-600', glow: 'shadow-purple-500/20' },
                  { label: 'Tabungan', pct: savingsPercent, budget: savingsBudget, color: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/20' },
                ].map(({ label, pct, budget, color, glow }) => (
                  <div key={label} className="bg-white border border-[#E8D5C4] shadow-sm rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-700 font-medium">{label}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg bg-gradient-to-r ${color} text-white shadow-lg ${glow}`}>{pct}%</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{formatRp(budget)}</p>
                    <p className="text-xs text-gray-500 mt-1">dari {formatRp(totalBudget)}/bln</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#E8D5C4] shadow-sm rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Realisasi per Kategori - Bulan Ini</h2>
                {allocations.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">Belum ada alokasi kategori untuk bulan ini.</p>
                ) : (
                   <div className="space-y-4">
                     {allocations.map((allocation, index) => {
                       const slug = allocation.category?.slug || allocation.categorySlug || 'lainnya';
                       const spent = toNumber(allocation.spent);
                       const budgetAmount = toNumber(allocation.budgetAmount);
                       const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
                       const over = percentage > 80;
                       const color = CATEGORY_BAR_CLASSES[slug] || CATEGORY_BAR_CLASSES.lainnya;

                       const displayName = getCategoryName(allocation);
                       const uniqueKey = allocation.id || `${slug}-${index}`;
                       return (
                         <div key={uniqueKey}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${color}`} />
                              <span className="text-sm text-gray-700">{displayName}</span>
                              {over && <AlertTriangle size={12} className="text-amber-600" />}
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-gray-500">{formatRp(spent)}</span>
                              <span className="text-gray-400">/ {formatRp(budgetAmount)}</span>
                              <span className={`font-semibold ${over ? 'text-amber-600' : 'text-gray-500'}`}>{percentage.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-[#E8D5C4] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-amber-400' : color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <BudgetSettingModal open={showModal} onClose={() => setShowModal(false)} summary={summary} onSaved={fetchSummary} />
    </div>
  );
}