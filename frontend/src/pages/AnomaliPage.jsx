 import { useState, useEffect, useCallback, useRef } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  AlertTriangle, CheckCircle, Loader2, RefreshCw, ScanSearch,
  Info, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import { anomalyService } from '../services/anomalyService';
import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS } from '../constants/categories';

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

function getScoreBadge(score) {
  if (score >= 0.8)
    return { bg: 'bg-red-100', text: 'text-red-700', border: 'border border-red-200', label: 'Tinggi', dot: 'bg-red-500' };
  if (score >= 0.5)
    return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border border-amber-200', label: 'Sedang', dot: 'bg-amber-500' };
  return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border border-gray-200', label: 'Rendah', dot: 'bg-gray-400' };
}

export default function AnomaliPage() {
  useDocumentTitle('Anomali');
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('unresolved');
  // severityFilter default 'medium_up' — hanya tampilkan sedang & tinggi
  const [severityFilter, setSeverityFilter] = useState('medium_up');
  const [resolvingId, setResolvingId] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const autoResolvedRef = useRef(false);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await anomalyService.getAll({ unresolvedOnly: false });
      setAnomalies(data || []);
      return data || [];
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat data anomali.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-resolve semua low score di background (silent, tanpa UI)
  const autoResolveLow = useCallback(async (data) => {
    if (autoResolvedRef.current) return;
    const lowUnresolved = data.filter((a) => !a.isResolved && (a.score || 0) < 0.5);
    if (lowUnresolved.length === 0) return;
    autoResolvedRef.current = true;
    try {
      await Promise.allSettled(lowUnresolved.map((a) => anomalyService.resolve(a.id)));
      // Update local state tanpa refetch
      setAnomalies((prev) =>
        prev.map((a) =>
          !a.isResolved && (a.score || 0) < 0.5 ? { ...a, isResolved: true } : a
        )
      );
    } catch {
      // Gagal silent — tidak tampilkan error ke user
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchAnomalies();
      if (!cancelled) {
        autoResolveLow(data);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchAnomalies, autoResolveLow]);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    setError('');
    try {
      const result = await anomalyService.scan();
      setScanResult(result);
      // Reset flag agar low score baru juga di-resolve
      autoResolvedRef.current = false;
      const data = await fetchAnomalies();
      autoResolveLow(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal melakukan scan anomali.');
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async (anomalyId) => {
    setResolvingId(anomalyId);
    try {
      await anomalyService.resolve(anomalyId);
      setAnomalies((prev) =>
        prev.map((a) => (a.id === anomalyId ? { ...a, isResolved: true } : a))
      );
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal menyelesaikan anomali.');
    } finally {
      setResolvingId(null);
    }
  };

  // Stats — hanya hitung medium ke atas
  const totalCount = anomalies.length;
  const unresolvedCount = anomalies.filter((a) => !a.isResolved).length;
  const highCount = anomalies.filter((a) => !a.isResolved && (a.score || 0) >= 0.8).length;
  const mediumCount = anomalies.filter((a) => !a.isResolved && (a.score || 0) >= 0.5 && (a.score || 0) < 0.8).length;
  // Jumlah yang relevan (medium + high)
  const relevantCount = highCount + mediumCount;

  // Apply filters
  const filteredAnomalies = anomalies.filter((a) => {
    const statusOk = statusFilter === 'all' || (statusFilter === 'unresolved' && !a.isResolved);
    let severityOk = true;
    if (severityFilter === 'medium_up') severityOk = (a.score || 0) >= 0.5;
    else if (severityFilter === 'high') severityOk = (a.score || 0) >= 0.8;
    else if (severityFilter === 'medium') severityOk = (a.score || 0) >= 0.5 && (a.score || 0) < 0.8;
    return statusOk && severityOk;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={24} className="text-amber-600" />
            Anomali
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {relevantCount > 0
              ? `${relevantCount} anomali perlu perhatian (skor sedang–tinggi)`
              : unresolvedCount > 0
              ? 'Hanya anomali skor rendah tersisa — tidak perlu tindakan'
              : 'Semua anomali sudah ditangani'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-scan-anomaly"
            onClick={handleScan}
            disabled={scanning || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAD4C0] text-[#7C4A2D] font-medium text-sm hover:bg-[#f5c4ac] disabled:opacity-50 transition-colors"
          >
            {scanning ? (
              <><Loader2 size={14} className="animate-spin" />Scanning...</>
            ) : (
              <><ScanSearch size={14} />Scan Anomali</>
            )}
          </button>
          <button
            id="btn-refresh-anomaly"
            onClick={async () => {
              autoResolvedRef.current = false;
              const data = await fetchAnomalies();
              autoResolveLow(data);
            }}
            disabled={loading || scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8D5C4] text-gray-600 hover:text-gray-900 hover:bg-[#FFF5E6] text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Info Panel — hanya muncul kalau ada anomali tinggi/sedang */}
      {relevantCount > 5 && (
        <div className="bg-[#80A1C1]/10 border border-[#80A1C1]/30 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowInfoPanel((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Info size={16} className="text-[#2C5282] flex-shrink-0" />
              <span className="text-sm font-medium text-[#2C5282]">
                Mengapa ada {totalCount} anomali terdeteksi?
              </span>
            </div>
            {showInfoPanel
              ? <ChevronUp size={16} className="text-[#2C5282] flex-shrink-0" />
              : <ChevronDown size={16} className="text-[#2C5282] flex-shrink-0" />
            }
          </button>
          {showInfoPanel && (
            <div className="px-4 pb-4 space-y-3 text-sm text-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 border border-[#E8D5C4]">
                  <p className="font-semibold text-red-600 mb-1">Skor Tinggi (≥80%)</p>
                  <p className="text-xs text-gray-600">Transaksi yang benar-benar mencurigakan. <strong>Perlu ditinjau.</strong></p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-[#E8D5C4]">
                  <p className="font-semibold text-amber-600 mb-1">Skor Sedang (50–80%)</p>
                  <p className="text-xs text-gray-600">Pola agak tidak biasa, masih dalam toleransi. Bisa jadi pengeluaran musiman.</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 bg-white rounded-xl p-3 border border-[#E8D5C4]">
                <strong>Catatan:</strong> Anomali skor rendah (&lt;50%) sudah otomatis ditangani. Model autoencoder akan semakin akurat seiring bertambahnya data transaksi Anda.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stat Summary Cards — hanya tampilkan total, tinggi, sedang */}
      {!loading && totalCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-[#E8D5C4] rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{relevantCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Perlu Perhatian</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{highCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Skor Tinggi</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{mediumCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Skor Sedang</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-gray-500 flex-shrink-0">
            <Filter size={14} />
            <span className="text-sm font-medium">Filter:</span>
          </div>

          {/* Status Filter — pill toggle */}
          <div className="flex items-center rounded-xl overflow-hidden border border-[#E8D5C4] flex-shrink-0">
            {[
              { value: 'unresolved', label: 'Belum Ditangani' },
              { value: 'all', label: 'Semua Status' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === value
                    ? 'bg-[#FAD4C0] text-[#7C4A2D]'
                    : 'bg-white text-gray-500 hover:bg-[#FFF5E6] hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Severity Filter — pill toggle */}
          <div className="flex items-center rounded-xl overflow-hidden border border-[#E8D5C4] flex-shrink-0 flex-wrap">
            {[
              { value: 'medium_up', label: 'Sedang & Tinggi' },
              { value: 'high', label: '≥80%' },
              { value: 'medium', label: '50–80%' },
              { value: 'all', label: 'Semua' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverityFilter(value)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-r border-[#E8D5C4] last:border-r-0 ${
                  severityFilter === value
                    ? 'bg-[#FAD4C0] text-[#7C4A2D]'
                    : 'bg-white text-gray-500 hover:bg-[#FFF5E6] hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-800 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Scan Result Banner */}
      {scanResult && (
        <div className="flex items-center gap-2 text-green-800 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle size={16} className="flex-shrink-0" />
          <span>
            Scan selesai: <strong>{scanResult.scanned ?? 0}</strong> transaksi diperiksa,{' '}
            <strong>{scanResult.detected ?? 0}</strong> anomali baru terdeteksi.
          </span>
        </div>
      )}

      {/* Anomaly List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={32} className="animate-spin text-[#FAD4C0]" />
        </div>
      ) : filteredAnomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <div className="w-16 h-16 rounded-2xl bg-[#FAD4C0]/20 flex items-center justify-center mb-3">
            <CheckCircle size={32} className="text-[#7C4A2D]" />
          </div>
          <p className="text-sm font-medium text-gray-700">Tidak ada anomali ditemukan</p>
          <p className="text-xs text-gray-400 mt-1">
            {severityFilter !== 'all' && severityFilter !== 'medium_up'
              ? 'Coba ubah filter severity'
              : statusFilter === 'unresolved'
              ? 'Semua anomali sudah ditangani'
              : 'Tidak ada anomali terdeteksi'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Menampilkan {filteredAnomalies.length} anomali
          </p>

          {filteredAnomalies.map((anomaly) => {
            const tx = anomaly.transaction;
            const score = anomaly.score || 0;
            const scoreBadge = getScoreBadge(score);
            const categorySlug = tx?.category?.slug || 'lainnya';

            return (
              <div
                key={anomaly.id}
                className={`bg-white border rounded-2xl shadow-sm p-4 transition-opacity ${
                  anomaly.isResolved
                    ? 'border-[#E8D5C4] opacity-50'
                    : score >= 0.8
                    ? 'border-red-300'
                    : score >= 0.5
                    ? 'border-amber-300'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left: Anomaly Info */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${scoreBadge.dot}`} />
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${scoreBadge.bg} ${scoreBadge.text} ${scoreBadge.border}`}>
                        Skor {scoreBadge.label}: {Math.round(score * 100)}%
                      </span>
                      {anomaly.isResolved && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-600 border border-green-200">
                          ✓ Ditangani
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium truncate">{tx?.description || 'Transaksi tidak ditemukan'}</p>
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className={`font-semibold ${tx?.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx?.type === 'income' ? '+' : '-'}{formatRp(tx?.amount)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-xs ${CATEGORY_BADGE_CLASSES[categorySlug] || CATEGORY_BADGE_CLASSES.lainnya}`}>
                        {CATEGORY_LABELS[categorySlug] || tx?.category?.name || 'Lainnya'}
                      </span>
                      <span className="text-gray-400 text-xs">{formatDate(tx?.date)}</span>
                    </div>
                    {anomaly.reason && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                        <span className="text-amber-600 font-medium">Alasan: </span>{anomaly.reason}
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  {!anomaly.isResolved && (
                    <button
                      id={`btn-resolve-${anomaly.id}`}
                      onClick={() => handleResolve(anomaly.id)}
                      disabled={resolvingId === anomaly.id}
                      className="self-start sm:self-center flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E8D5C4] hover:bg-[#FFF5E6] disabled:opacity-50 text-gray-700 text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap"
                    >
                      {resolvingId === anomaly.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={14} />
                          Bukan Anomali
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
