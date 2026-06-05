import { useCallback, useEffect, useState, useRef } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { transactionService } from '../services/transactionService';
import { predictionService } from '../services/predictionService';
import {
  ALL_CATEGORIES,
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../constants/categories';

const EMPTY_FORM = {
  description: '',
  amount: '',
  type: 'expense',
  categorySlug: 'lainnya',
  date: new Date().toISOString().slice(0, 10),
  note: '',
};

/**
 * Format number to Indonesian thousands (e.g. 50000 → "50.000")
 * Returns empty string for 0/falsy so placeholder shows
 */
function formatThousands(value) {
  const num = Number(String(value).replace(/\./g, ''));
  if (!num) return '';
  return num.toLocaleString('id-ID');
}

/**
 * Smart step: step = 10^(digits-1), minimum 1000
 */
function getStep(num) {
  if (!num || num <= 0) return 1000;
  const digits = Math.floor(Math.log10(num)) + 1;
  return Math.max(Math.pow(10, digits - 1), 1000);
}

function formatRp(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function categoriesForType(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/**
 * Komponen input Rupiah dengan format ribuan dan smart step ArrowUp/Down
 */
function RupiahInput({ value, onChange, placeholder = '0', id, className = '' }) {
  const [display, setDisplay] = useState(() => formatThousands(value));

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
    const next = e.key === 'ArrowUp' ? current + step : Math.max(0, current - step);
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

function TransactionModal({ open, onClose, onSaved, editData }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const debounceRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    setPrediction(null);
    if (editData) {
      setForm({
        description: editData.description || '',
        amount: editData.amount || '',
        type: editData.type || 'expense',
        categorySlug: editData.category?.slug || (editData.type === 'income' ? 'pemasukan_lain' : 'lainnya'),
        date: editData.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        note: editData.note || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editData]);

  // Debounced prediction for expense transactions
  useEffect(() => {
    // Clear previous timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Only predict for new expense transactions with description
    if (editData || form.type !== 'expense' || !form.description.trim() || form.description.length < 3) {
      setPrediction(null);
      return;
    }

    // Debounce 500ms
    debounceRef.current = setTimeout(async () => {
      setPredicting(true);
      try {
        const result = await predictionService.predictCategory(
          form.description,
          Number(form.amount) || 0,
          'expense'
        );
        setPrediction(result);
      } catch (err) {
        console.error('Prediction failed:', err);
        setPrediction(null);
      } finally {
        setPredicting(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [form.description, form.amount, form.type, editData]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleTypeChange = (type) => {
    setForm((prev) => ({
      ...prev,
      type,
      categorySlug: type === 'income' ? 'pemasukan_lain' : 'lainnya',
    }));
    setPrediction(null);
  };

  // Apply prediction to form
  const applyPrediction = () => {
    if (prediction && prediction.predicted_category) {
      setForm((prev) => ({ ...prev, categorySlug: prediction.predicted_category }));
    }
  };

  // Get confidence badge color
  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) return { bg: 'bg-green-50', text: 'text-green-600', label: 'Tinggi' };
    if (confidence >= 0.6) return { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Sedang' };
    return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Rendah' };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.description.trim()) return setError('Deskripsi wajib diisi.');
    if (!form.amount || Number.isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      return setError('Jumlah harus angka positif.');
    }

    setLoading(true);
    setError('');
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editData) {
        await transactionService.update(editData.id, payload);
      } else {
        await transactionService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal menyimpan transaksi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-[#E8D5C4] rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8D5C4]">
          <h2 className="text-base font-semibold text-gray-900">{editData ? 'Edit Transaksi' : 'Catat Transaksi Baru'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-[#E8D5C4]">
            {['expense', 'income'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  form.type === type
                    ? (type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                    : 'bg-white text-gray-500 hover:text-gray-700'
                }`}
              >
                {type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Deskripsi *</label>
            <input
              id="tx-description"
              type="text"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="mis. Makan siang di warung"
              maxLength={200}
              className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Jumlah (Rp) *</label>
            <RupiahInput
              id="tx-amount"
              value={form.amount}
              onChange={(val) => set('amount', val)}
              placeholder="50.000"
              className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Kategori</label>
              <select
                id="tx-category"
                value={form.categorySlug}
                onChange={(event) => set('categorySlug', event.target.value)}
                className="w-full bg-white border border-[#E8D5C4] rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
              >
                {categoriesForType(form.type).map((category) => (
                  <option key={category.slug} value={category.slug}>{category.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tanggal</label>
              <input
                id="tx-date"
                type="date"
                value={form.date}
                onChange={(event) => set('date', event.target.value)}
                className="w-full bg-white border border-[#E8D5C4] rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors [color-scheme:light]"
              />
            </div>
          </div>

          {/* AI Category Prediction */}
          {!editData && form.type === 'expense' && (
            <div className="bg-[#80A1C1]/10 rounded-xl p-3 border border-[#80A1C1]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-[#2C5282]">
                  <Sparkles size={14} className="text-[#80A1C1]" />
                  <span>Kategori AI</span>
                </div>
                {predicting && <Loader2 size={14} className="animate-spin text-[#80A1C1]" />}
              </div>
              {prediction && !predicting ? (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${CATEGORY_BADGE_CLASSES[prediction.predicted_category] || CATEGORY_BADGE_CLASSES.lainnya}`}>
                    {CATEGORY_LABELS[prediction.predicted_category] || prediction.predicted_category}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceBadge(prediction.confidence).bg} ${getConfidenceBadge(prediction.confidence).text}`}>
                    {Math.round(prediction.confidence * 100)}% • {getConfidenceBadge(prediction.confidence).label}
                  </span>
                  {prediction.predicted_category !== form.categorySlug && (
                    <button
                      type="button"
                      onClick={applyPrediction}
                      className="text-xs text-[#2C5282] hover:text-[#1a365d] underline transition-colors"
                    >
                      Pakai
                    </button>
                  )}
                </div>
              ) : !predicting && form.description.length >= 3 ? (
                <p className="text-xs text-gray-500">Ketik deskripsi untuk melihat prediksi kategori</p>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Catatan (opsional)</label>
            <textarea
              id="tx-notes"
              value={form.note}
              onChange={(event) => set('note', event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Tambahkan catatan"
              className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} />{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E8D5C4] text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
              Batal
            </button>
            <button
              type="submit"
              id="tx-submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#FAD4C0] hover:bg-[#F5C0A8] disabled:opacity-60 text-sm font-medium text-[#7C4A2D] transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <span className="w-4 h-4 border-2 border-[#7C4A2D]/30 border-t-[#7C4A2D] rounded-full animate-spin" /> : <Check size={15} />}
              {editData ? 'Simpan Perubahan' : 'Catat Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({ open, onClose, onConfirm, loading }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border border-[#E8D5C4] rounded-2xl shadow-2xl p-6" onClick={(event) => event.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-600" />
        </div>
        <h3 className="text-gray-900 font-semibold text-center mb-1">Hapus Transaksi?</h3>
        <p className="text-gray-500 text-sm text-center mb-5">Tindakan ini tidak bisa dibatalkan.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E8D5C4] text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Batal
          </button>
          <button
            id="tx-delete-confirm"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TransaksiPage() {
  useDocumentTitle('Transaksi');
  const [data, setData] = useState({ transactions: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (filterCat) params.category = filterCat;
      if (filterType) params.type = filterType;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const result = await transactionService.getAll(params);
      setData(result);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat transaksi.');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCat, filterType, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, filterCat, filterType, dateFrom, dateTo]);

  const handleAdd = () => {
    setEditTx(null);
    setShowModal(true);
  };

  const handleEdit = (transaction) => {
    setEditTx(transaction);
    setShowModal(true);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await transactionService.remove(deleteTx.id);
      setDeleteTx(null);
      fetchData();
    } finally {
      setDeleteLoading(false);
    }
  };

  const { transactions, pagination } = data;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaksi</h1>
          <p className="text-gray-500 text-sm mt-0.5">Kelola semua pemasukan dan pengeluaran Anda</p>
        </div>
        <button id="btn-add-transaction" onClick={handleAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#FAD4C0] hover:bg-[#F5C0A8] text-[#7C4A2D] rounded-xl font-medium text-sm transition-colors shadow-sm">
          <Plus size={16} /> Catat Baru
        </button>
      </div>

      <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-4 space-y-3">
        {/* Row 1: Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="tx-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari deskripsi transaksi..."
            className="w-full bg-white border border-[#E8D5C4] rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
          />
        </div>

        {/* Row 2: Filter Tipe + Kategori + Tanggal */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-gray-400 flex-shrink-0">
            <Filter size={14} />
          </div>

          {/* Tipe — pill toggle */}
          <div className="flex items-center rounded-xl overflow-hidden border border-[#E8D5C4] flex-shrink-0">
            {[
              { value: '', label: 'Semua Tipe' },
              { value: 'expense', label: 'Pengeluaran' },
              { value: 'income', label: 'Pemasukan' },
            ].map(({ value, label }) => (
              <button
                key={value || 'all'}
                id={value ? `tx-filter-type-${value}` : 'tx-filter-type-all'}
                type="button"
                onClick={() => setFilterType(value)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-r border-[#E8D5C4] last:border-r-0 ${
                  filterType === value
                    ? value === 'income'
                      ? 'bg-green-100 text-green-700'
                      : value === 'expense'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-[#FAD4C0] text-[#7C4A2D]'
                    : 'bg-white text-gray-500 hover:bg-[#FFF5E6] hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Kategori — select dropdown */}
          <select
            id="tx-filter-cat"
            value={filterCat}
            onChange={(event) => setFilterCat(event.target.value)}
            className="bg-white border border-[#E8D5C4] rounded-xl px-3 py-2 text-xs text-gray-700 font-medium focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {ALL_CATEGORIES.map((category) => (
              <option key={category.slug} value={category.slug}>{category.label}</option>
            ))}
          </select>

          {/* Tanggal */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              id="tx-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="bg-white border border-[#E8D5C4] rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors [color-scheme:light]"
            />
            <span className="text-gray-400 text-xs">–</span>
            <input
              id="tx-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="bg-white border border-[#E8D5C4] rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors [color-scheme:light]"
            />
          </div>

          {/* Reset */}
          {(search || filterCat || filterType || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setFilterCat(''); setFilterType(''); setDateFrom(''); setDateTo(''); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
            >
              <X size={11} /> Reset Filter
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="w-7 h-7 border-2 border-[#FAD4C0]/30 border-t-[#FAD4C0] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48 gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />{error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <div className="w-14 h-14 rounded-2xl bg-[#FAD4C0]/20 flex items-center justify-center mb-3">
              <ArrowLeftRight size={24} className="text-[#7C4A2D]" />
            </div>
            <p className="text-sm">Belum ada transaksi</p>
            <p className="text-xs text-gray-400 mt-1">Klik "Catat Baru" untuk memulai</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8D5C4]">
                  <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                  <th className="text-left px-4 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                  <th className="text-left px-4 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="text-right px-4 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8D5C4]/50">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-[#FFF5E6] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${transaction.type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                          {transaction.type === 'income'
                            ? <ArrowUpCircle size={16} className="text-green-600" />
                            : <ArrowDownCircle size={16} className="text-red-600" />}
                        </div>
                        <div>
                          <p className="text-gray-900 font-medium truncate max-w-[200px]">{transaction.description}</p>
                          {transaction.note && <p className="text-xs text-gray-500 truncate max-w-[200px]">{transaction.note}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${CATEGORY_BADGE_CLASSES[transaction.category?.slug] || CATEGORY_BADGE_CLASSES.lainnya}`}>
                        {CATEGORY_LABELS[transaction.category?.slug] || transaction.category?.name || 'Lainnya'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(transaction.date)}</td>
                    <td className="px-4 py-4 text-right font-semibold whitespace-nowrap">
                      <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {transaction.type === 'income' ? '+' : '-'}{formatRp(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <button id={`btn-edit-${transaction.id}`} onClick={() => handleEdit(transaction)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#2C5282] hover:bg-[#80A1C1]/10 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button id={`btn-delete-${transaction.id}`} onClick={() => setDeleteTx(transaction)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#E8D5C4]">
            <p className="text-xs text-gray-500">
              {pagination.total} transaksi - Halaman {pagination.page} dari {pagination.totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button id="btn-page-prev" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-[#FFF5E6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => {
                const pageNumber = Math.max(1, Math.min(page - 2, pagination.totalPages - 4)) + index;
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${page === pageNumber ? 'bg-[#FAD4C0] text-[#7C4A2D]' : 'text-gray-500 hover:text-gray-900 hover:bg-[#FFF5E6]'}`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button id="btn-page-next" onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-[#FFF5E6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <TransactionModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditTx(null); }}
        onSaved={fetchData}
        editData={editTx}
      />
      <DeleteModal
        open={Boolean(deleteTx)}
        onClose={() => setDeleteTx(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}