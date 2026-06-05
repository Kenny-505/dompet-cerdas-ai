import { useState, useEffect, useCallback } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  TrendingUp, TrendingDown, Wallet, Heart, AlertTriangle,
  BarChart2, RefreshCw, Receipt, Utensils, Car, ShoppingBag, Film,
  Zap, GraduationCap, Home, Stethoscope, MoreHorizontal,
  ArrowLeftRight, PiggyBank, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { readinessService } from '../services/readinessService';
import { predictionService } from '../services/predictionService';
import { dashboardService } from '../services/dashboardService';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

// Icon mapping for category display
const ICON_MAP = {
  receipt: Receipt,
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  film: Film,
  zap: Zap,
  'graduation-cap': GraduationCap,
  home: Home,
  stethoscope: Stethoscope,
  'more-horizontal': MoreHorizontal,
};

// Category colors for Bento theme with explicit bar colors to support Tailwind compiler JIT
const CATEGORY_COLORS = {
  tagihan: { icon: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', bar: 'bg-red-400' },
  makanan: { icon: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100', bar: 'bg-orange-400' },
  transportasi: { icon: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100', bar: 'bg-blue-400' },
  belanja: { icon: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-100', bar: 'bg-pink-400' },
  hiburan: { icon: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100', bar: 'bg-purple-400' },
  kesehatan: { icon: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', bar: 'bg-emerald-400' },
  pendidikan: { icon: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-100', bar: 'bg-cyan-400' },
  kos_sewa: { icon: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', bar: 'bg-amber-400' },
  lainnya: { icon: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100', bar: 'bg-gray-400' },
};

function CategoryIcon({ iconName, size = 16 }) {
  const IconComponent = ICON_MAP[iconName] || MoreHorizontal;
  return <IconComponent size={size} />;
}

function StatCard({ icon: Icon, label, value, sub, color = 'emerald', loading }) {
  const colorMap = {
    emerald: 'text-green-600 bg-green-50 border-green-200',
    red: 'text-red-600 bg-red-50 border-red-200',
    blue: 'text-[#2C5282] bg-[#80A1C1]/10 border-[#80A1C1]/30',
    amber: 'text-amber-600 bg-amber-50 border-amber-200',
  };
  return (
    <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-4 space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm text-gray-500 truncate">{label}</span>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${colorMap[color]}`}>
          <Icon size={16} />
        </div>
      </div>
      {loading ? (
        <div className="h-6 w-24 bg-[#FAD4C0]/40 rounded animate-pulse" />
      ) : (
        <p className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate" title={value}>{value}</p>
      )}
      {sub && <p className="text-[10px] sm:text-xs text-gray-500 truncate">{sub}</p>}
    </div>
  );
}

// Mobile-only shortcut buttons — Transaksi & Budget
function MobileShortcuts({ navigate }) {
  return (
    <div className="md:hidden grid grid-cols-2 gap-3">
      <button
        onClick={() => navigate('/transaksi')}
        className="flex items-center gap-3 bg-white border border-[#E8D5C4] rounded-2xl p-4 shadow-sm hover:bg-[#FFF5E6] transition-colors active:scale-95"
      >
        <div className="w-10 h-10 rounded-xl bg-[#80A1C1]/10 flex items-center justify-center flex-shrink-0">
          <ArrowLeftRight size={18} className="text-[#2C5282]" />
        </div>
        <div className="text-left min-w-0">
          <p className="text-sm font-semibold text-gray-900">Transaksi</p>
          <p className="text-xs text-gray-500">Catat & lihat</p>
        </div>
        <ChevronRight size={16} className="text-gray-400 ml-auto flex-shrink-0" />
      </button>
      <button
        onClick={() => navigate('/budget')}
        className="flex items-center gap-3 bg-white border border-[#E8D5C4] rounded-2xl p-4 shadow-sm hover:bg-[#FFF5E6] transition-colors active:scale-95"
      >
        <div className="w-10 h-10 rounded-xl bg-[#FAD4C0]/40 flex items-center justify-center flex-shrink-0">
          <PiggyBank size={18} className="text-[#7C4A2D]" />
        </div>
        <div className="text-left min-w-0">
          <p className="text-sm font-semibold text-gray-900">Budget</p>
          <p className="text-xs text-gray-500">Kelola anggaran</p>
        </div>
        <ChevronRight size={16} className="text-gray-400 ml-auto flex-shrink-0" />
      </button>
    </div>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary]   = useState(null);
  const [trend, setTrend]       = useState([]);
  const [health, setHealth]     = useState(null);
  const [prediction, setPred]   = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [generatingPred, setGeneratingPred] = useState(false);
  const [generateAttempts, setGenerateAttempts] = useState(0);
  const [generatingHealth, setGeneratingHealth] = useState(false);
  const [healthGenerateAttempts, setHealthGenerateAttempts] = useState(0);

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const loadDashboard = useCallback(async () => {
    try {
      const [sumRes, trendRes, healthRes, predRes, anomalyRes, readinessRes] = await Promise.allSettled([
        api.get(`/dashboard/summary?monthYear=${monthYear}`),
        api.get('/dashboard/spending-trend'),
        api.get(`/dashboard/health-score?monthYear=${monthYear}`),
        api.get('/predictions'),
        api.get('/anomalies'),
        readinessService.get(),
      ]);

      if (sumRes.status === 'fulfilled')    setSummary(sumRes.value.data.data);
      if (trendRes.status === 'fulfilled')  setTrend(trendRes.value.data.data);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data.data);
      // predRes.data.data is an array of SpendingPrediction rows — find the __total row
      if (predRes.status === 'fulfilled') {
        const predArray = predRes.value.data.data;
        const totalRow = Array.isArray(predArray)
          ? predArray.find(p => p.categorySlug === '__total') ?? null
          : (predArray ?? null);
        setPred(totalRow);
      }
      if (anomalyRes.status === 'fulfilled') setAnomalies(anomalyRes.value.data.data?.filter(a => !a.isResolved) || []);
      if (readinessRes.status === 'fulfilled') setReadiness(readinessRes.value);

      // Auto-generate prediction if data is ready/limited but prediction is null
      // Max 2 attempts to prevent infinite loop
      const currentReadiness = readinessRes.status === 'fulfilled' ? readinessRes.value : null;
      // Extract __total row from array to determine if prediction already exists
      const predRawArray = predRes.status === 'fulfilled' ? predRes.value.data.data : null;
      const currentPrediction = Array.isArray(predRawArray)
        ? predRawArray.find(p => p.categorySlug === '__total') ?? null
        : (predRawArray ?? null);
      const predStatus = currentReadiness?.prediction?.status;
      
      // Generate for both 'enough_data' (LSTM) and 'limited_data' (simple average)
      // Only attempt if we haven't tried too many times
      if ((predStatus === 'enough_data' || predStatus === 'limited_data') && !currentPrediction && !generatingPred && generateAttempts < 2) {
        setGeneratingPred(true);
        setGenerateAttempts(prev => prev + 1);
        try {
          await predictionService.generate();
          // Reload prediction after generation — extract __total from array
          const newPredRes = await api.get('/predictions');
          if (newPredRes.data?.data) {
            const newArray = newPredRes.data.data;
            const newTotal = Array.isArray(newArray)
              ? newArray.find(p => p.categorySlug === '__total') ?? null
              : (newArray ?? null);
            setPred(newTotal);
          }
        } catch (genErr) {
          console.error('Failed to generate prediction:', genErr);
        } finally {
          setGeneratingPred(false);
        }
      }

      // Auto-generate health score if data is ready but health score is null or 0
      const currentHealth = healthRes.status === 'fulfilled' ? healthRes.value.data.data : null;
      const healthStatus = currentReadiness?.healthScore?.status;
      
      // Generate for 'enough_data' (AI Dense NN) and 'limited_data' (rule-based)
      // Also regenerate if score is 0 (not yet properly calculated)
      const needsHealthGeneration = !currentHealth || currentHealth.score === 0 || currentHealth.score === null;
      if ((healthStatus === 'enough_data' || healthStatus === 'limited_data') && needsHealthGeneration && !generatingHealth && healthGenerateAttempts < 2) {
        setGeneratingHealth(true);
        setHealthGenerateAttempts(prev => prev + 1);
        try {
          await dashboardService.calculateHealthScore(monthYear);
          // Reload health score after generation
          const newHealthRes = await api.get(`/dashboard/health-score?monthYear=${monthYear}`);
          if (newHealthRes.data?.data) {
            setHealth(newHealthRes.data.data);
          }
        } catch (genErr) {
          console.error('Failed to generate health score:', genErr);
        } finally {
          setGeneratingHealth(false);
        }
      }
    } catch { /* silently ignore */ }
    setLoading(false);
  }, [monthYear]); // Removed generatingPred to prevent re-triggering

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const healthColor = health?.score >= 80 ? 'emerald' : health?.score >= 60 ? 'amber' : 'red';
  const healthLabel = health?.score >= 80 ? 'Sehat' : health?.score >= 60 ? 'Cukup Baik' : 'Perlu Perhatian';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Selamat datang, <span className="text-[#7C4A2D] font-medium">{user?.name}</span>
          </p>
        </div>
        <button onClick={() => { setLoading(true); loadDashboard(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8D5C4] text-gray-500 hover:text-gray-900 text-sm transition-colors">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Budget Alert Banner */}
      {summary?.budget && summary.budget.utilization >= 80 && summary.budget.utilization < 100 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Budget hingga {summary.budget.utilization.toFixed(0)}%</span> terpakai bulan ini.{' '}
            <a href="/budget" className="underline hover:text-amber-900">Kelola budget →</a>
          </p>
        </div>
      )}

      {/* Budget Exceeded Alert */}
      {summary?.budget && summary.budget.utilization >= 100 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">Budget terlampaui!</span> Pengeluaran melebihi budget bulan ini.{' '}
            <a href="/budget" className="underline hover:text-red-900">Lihat detail →</a>
          </p>
        </div>
      )}

      {/* Mobile shortcuts — Transaksi & Budget */}
      <MobileShortcuts navigate={navigate} />

      {/* Anomaly Alert Banner */}
      {readiness?.anomaly?.status === 'no_data' ? null : anomalies.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{anomalies.length} transaksi anomali</span> terdeteksi bulan ini.{' '}
            <a href="/anomali" className="underline hover:text-amber-900">Lihat detail →</a>
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp} label="Total Pemasukan" color="emerald" loading={loading}
          value={summary ? formatRupiah(summary.totalIncome) : 'Rp 0'}
          sub={`Bulan ${monthYear}`}
        />
        <StatCard
          icon={TrendingDown} label="Total Pengeluaran" color="red" loading={loading}
          value={summary ? formatRupiah(summary.totalExpense) : 'Rp 0'}
          sub={`${summary?.transactionCount || 0} transaksi`}
        />
        <StatCard
          icon={Wallet} label="Net Tabungan" color="blue" loading={loading}
          value={summary ? formatRupiah(summary.netSavings) : 'Rp 0'}
          sub={summary ? `Savings rate: ${summary.savingsRate?.toFixed(1)}%` : ''}
        />
        <StatCard
          icon={Heart} label="Health Score" 
          color={readiness?.healthScore?.status === 'no_data' ? 'amber' : healthColor} 
          loading={loading || generatingHealth}
          value={readiness?.healthScore?.status === 'no_data' ? 'N/A' : (health ? `${Math.round(health.score)}/100` : 'N/A')}
          sub={readiness?.healthScore?.status === 'no_data' ? 'Data belum cukup' : generatingHealth ? 'Menghitung health score...' : (health ? `${healthLabel} • Akurasi: ${health?.confidence || 'N/A'}` : 'Belum tersedia')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Spending Trend Chart */}
        <div className="lg:col-span-2 bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart2 size={18} className="text-[#7C4A2D]" />
              Tren Pengeluaran 6 Bulan
            </h2>
          </div>
          <div className="h-[320px] w-full flex flex-col justify-center">
            {loading ? (
              <div className="h-full w-full bg-[#FAD4C0]/40 rounded-xl animate-pulse" />
            ) : trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8D5C4" />
                  <XAxis dataKey="monthYear" tick={{ fill: '#6B7280', fontSize: 12 }} height={30} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(v) => `${(v/1e6).toFixed(1)}jt`} width={50} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E8D5C4', borderRadius: '12px', color: '#111827' }}
                    formatter={(v) => formatRupiah(v)}
                  />
                  <Area type="monotone" dataKey="income"  stroke="#10B981" fill="url(#incomeGrad)"  strokeWidth={2} name="Pemasukan" />
                  <Area type="monotone" dataKey="expense" stroke="#EF4444" fill="url(#expenseGrad)" strokeWidth={2} name="Pengeluaran" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3 border border-dashed border-[#E8D5C4]">
                  <BarChart2 size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">Belum ada data tren</p>
                <p className="text-xs text-gray-400 mt-1">Data grafik akan muncul setelah Anda mencatat transaksi</p>
              </div>
            )}
          </div>
        </div>

        {/* Category Pie + Prediction */}
        <div className="space-y-4">
          {/* Prediction Card */}
          <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-[#80A1C1]" />
              Prediksi Bulan Depan
            </h3>
            {loading ? (
              <div className="h-12 bg-[#FAD4C0]/40 rounded-xl animate-pulse" />
            ) : readiness?.prediction?.status === 'no_data' ? (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-600 font-medium flex items-center gap-2"><AlertTriangle size={14} />Belum Cukup Data</p>
                <p className="text-xs text-gray-500 mt-1">{readiness.prediction.message}</p>
              </div>
            ) : (
              <>
                {readiness?.prediction?.status === 'limited_data' && (
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-3">
                    <p className="text-sm text-yellow-600 font-medium flex items-center gap-2"><AlertTriangle size={14} />Akurasi Terbatas</p>
                    <p className="text-xs text-gray-500 mt-1">{readiness.prediction.message}</p>
                  </div>
                )}
                {generatingPred ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-sm">Menghitung prediksi...</span>
                  </div>
                ) : prediction ? (
                  <div>
                    <p className="text-xl font-bold text-[#2C5282]">{formatRupiah(prediction.predictedAmount)}</p>
                    {prediction.confidence && (
                      <p className="text-xs text-gray-500 mt-1">Akurasi: {(prediction.confidence * 100).toFixed(1)}%</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Menunggu AI melakukan prediksi</p>
                )}
              </>
            )}
          </div>

          {/* Category breakdown */}
          <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-5">
                <BarChart2 size={18} className="text-[#7C4A2D]" />
                Kategori Terbesar
              </h3>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FAD4C0]/40 animate-pulse" />
                      <div className="flex-1">
                        <div className="h-3 bg-[#FAD4C0]/40 rounded w-2/3 mb-2 animate-pulse" />
                        <div className="h-1.5 bg-[#FAD4C0]/40 rounded w-full animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : summary?.spendingByCategory?.length > 0 ? (
                <div className="space-y-4">
                  {(() => {
                    const total = summary.spendingByCategory.reduce((sum, c) => sum + (c.amount || 0), 0);
                    return summary.spendingByCategory.slice(0, 5).map((c) => {
                      const percentage = total > 0 ? ((c.amount || 0) / total) * 100 : 0;
                      const colors = CATEGORY_COLORS[c.slug] || CATEGORY_COLORS.lainnya;
                      return (
                        <div key={c.slug} className="flex items-center gap-3">
                          {/* Icon badge */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.icon} shrink-0`}>
                            <CategoryIcon iconName={c.icon} size={15} />
                          </div>
                          {/* Category name & bar */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-medium text-gray-900 truncate">{c.name}</span>
                                <span className="text-xs text-gray-400 font-normal">{percentage.toFixed(0)}%</span>
                              </div>
                              <span className="font-semibold text-gray-900">{formatRupiah(c.amount)}</span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3 border border-dashed border-[#E8D5C4]">
                    <BarChart2 size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Belum ada pengeluaran</p>
                  <p className="text-xs text-gray-400 mt-1">Catat transaksi untuk melihat kategori</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
