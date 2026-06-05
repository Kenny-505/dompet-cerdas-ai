import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AlertCircle, Check, Eye, EyeOff, Lock, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../services/profileService';

/**
 * Format number to Indonesian thousands (e.g. 5000000 → "5.000.000")
 */
function formatThousands(value) {
  const num = Number(String(value).replace(/\./g, ''));
  if (!num) return '';
  return num.toLocaleString('id-ID');
}

function getStep(num) {
  if (!num || num <= 0) return 100000;
  const digits = Math.floor(Math.log10(num)) + 1;
  return Math.max(Math.pow(10, digits - 1), 100000);
}

/**
 * Input Rupiah: format ribuan, smart step dengan ArrowUp/Down
 */
function RupiahInput({ value, onChange, placeholder = '0', id, className = '' }) {
  const [display, setDisplay] = useState(() => formatThousands(value));
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setDisplay(formatThousands(value));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    const num = Number(raw) || 0;
    setDisplay(num ? num.toLocaleString('id-ID') : '');
    prevValueRef.current = num || '';
    onChange(num || '');
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = Number(String(value).replace(/\./g, '')) || 0;
    const step = getStep(current);
    const next = e.key === 'ArrowUp' ? current + step : Math.max(0, current - step);
    setDisplay(next ? next.toLocaleString('id-ID') : '');
    prevValueRef.current = next || '';
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

const SEGMENT_OPTIONS = [
  { value: 'pelajar_mahasiswa', label: 'Pelajar/Mahasiswa' },
  { value: 'pekerja_tetap', label: 'Pekerja income tetap' },
  { value: 'freelancer', label: 'Freelancer/income tidak tetap' },
];

export default function ProfilPage() {
  useDocumentTitle('Profil');
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({
    name: '',
    monthlyIncome: '',
    userSegment: 'pekerja_tetap',
    hasSavings: false,
    hasDebt: false,
  });
  const [profLoading, setProfLoading] = useState(false);
  const [profError, setProfError] = useState('');
  const [profSuccess, setProfSuccess] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const data = await profileService.get();
      setProfile({
        name: data.name || '',
        monthlyIncome: data.monthlyIncome ?? '',
        userSegment: data.userSegment || 'pekerja_tetap',
        hasSavings: Boolean(data.hasSavings),
        hasDebt: Boolean(data.hasDebt),
      });
    } catch {
      setProfile((prev) => ({ ...prev, name: user?.name || '' }));
    }
  }, [user?.name]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const setProfileField = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!profile.name.trim()) return setProfError('Nama tidak boleh kosong.');

    setProfLoading(true);
    setProfError('');
    setProfSuccess('');
    try {
      const updated = await profileService.update({
        name: profile.name,
        monthlyIncome: profile.monthlyIncome === '' ? undefined : Number(profile.monthlyIncome),
        userSegment: profile.userSegment,
        hasSavings: profile.hasSavings,
        hasDebt: profile.hasDebt,
      });
      updateUser(updated);
      setProfSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      setProfError(err?.response?.data?.message || 'Gagal memperbarui profil.');
    } finally {
      setProfLoading(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (!pwForm.currentPassword) return setPwError('Masukkan password saat ini.');
    if (pwForm.newPassword.length < 8) return setPwError('Password baru minimal 8 karakter.');
    if (pwForm.newPassword !== pwForm.confirmPassword) return setPwError('Konfirmasi password tidak cocok.');

    setPwLoading(true);
    setPwError('');
    setPwSuccess('');
    try {
      await profileService.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess('Password berhasil diubah.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwError(err?.response?.data?.message || 'Gagal mengubah password.');
    } finally {
      setPwLoading(false);
    }
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 h-full overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profil Pengguna</h1>
        <p className="text-gray-500 text-sm mt-0.5">Kelola profil keuangan dan keamanan akun Anda</p>
      </div>

      <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-4 md:p-5 flex items-center gap-3 md:gap-4">
        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-[#FAD4C0] text-[#7C4A2D] border border-[#f0c4b0] flex items-center justify-center text-xl md:text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base md:text-lg font-semibold text-gray-900 truncate">{user?.name || '-'}</p>
          <p className="text-xs md:text-sm text-gray-500 truncate">{user?.email || '-'}</p>
        </div>
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors flex-shrink-0"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
      {/* Mobile logout — shown below card on small screens */}
      <button
        id="btn-logout-mobile"
        onClick={handleLogout}
        className="sm:hidden flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
      >
        <LogOut size={14} />
        Logout
      </button>

      <div className="flex bg-[#FFF5E6] border border-[#E8D5C4] rounded-xl p-1 gap-1">
        {[
          { id: 'profile', label: 'Profil Keuangan', icon: User },
          { id: 'password', label: 'Ubah Password', icon: Lock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-[#7C4A2D] shadow-sm border border-[#E8D5C4]' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nama Lengkap *</label>
              <input
                id="profile-name"
                type="text"
                value={profile.name}
                onChange={(event) => setProfileField('name', event.target.value)}
                placeholder="Nama lengkap Anda"
                maxLength={100}
                className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] transition-colors"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
              <input type="email" readOnly value={user?.email || ''} className="w-full bg-gray-50 border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Segmentasi</label>
              <select
                id="profile-segment"
                value={profile.userSegment}
                onChange={(event) => setProfileField('userSegment', event.target.value)}
                className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#FAD4C0] transition-colors"
              >
                {SEGMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Income Bulanan (Rp)</label>
              <RupiahInput
                id="profile-income"
                value={profile.monthlyIncome}
                onChange={(val) => setProfileField('monthlyIncome', val)}
                placeholder="5.000.000"
                className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] transition-colors"
              />
            </div>

            <label className="sm:col-span-2 flex items-center justify-between gap-3 bg-white border border-[#E8D5C4] rounded-xl px-4 py-3">
              <span className="text-sm text-gray-700">Sudah punya tabungan</span>
              <input
                id="profile-has-savings"
                type="checkbox"
                checked={profile.hasSavings}
                onChange={(event) => setProfileField('hasSavings', event.target.checked)}
                className="h-4 w-4 accent-[#FAD4C0]"
              />
            </label>

            <label className="sm:col-span-2 flex items-center justify-between gap-3 bg-white border border-[#E8D5C4] rounded-xl px-4 py-3">
              <span className="text-sm text-gray-700">Sedang punya hutang</span>
              <input
                id="profile-has-debt"
                type="checkbox"
                checked={profile.hasDebt}
                onChange={(event) => setProfileField('hasDebt', event.target.checked)}
                className="h-4 w-4 accent-[#FAD4C0]"
              />
            </label>
          </div>

          {profError && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} />{profError}
            </div>
          )}
          {profSuccess && (
            <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <Check size={14} />{profSuccess}
            </div>
          )}

          <button type="submit" id="btn-save-profile" disabled={profLoading} className="w-full py-2.5 bg-[#FAD4C0] hover:bg-[#f0c4b0] disabled:opacity-60 text-[#7C4A2D] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {profLoading ? <span className="w-4 h-4 border-2 border-[#7C4A2D]/30 border-t-[#7C4A2D] rounded-full animate-spin" /> : <Check size={15} />}
            Simpan Perubahan
          </button>
        </form>
      )}

      {tab === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm p-5 space-y-4">
          {[
            { id: 'current', label: 'Password Saat Ini', key: 'currentPassword' },
            { id: 'new', label: 'Password Baru (min. 8 karakter)', key: 'newPassword' },
            { id: 'confirm', label: 'Konfirmasi Password Baru', key: 'confirmPassword' },
          ].map(({ id, label, key }) => (
            <div key={id}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
              <div className="relative">
                <input
                  id={`pw-${id}`}
                  type={showPw[id] ? 'text' : 'password'}
                  value={pwForm[key]}
                  onChange={(event) => setPwForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  placeholder="********"
                  className="w-full bg-white border border-[#E8D5C4] rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] transition-colors"
                />
                <button type="button" onClick={() => setShowPw((prev) => ({ ...prev, [id]: !prev[id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw[id] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          {pwError && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} />{pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <Check size={14} />{pwSuccess}
            </div>
          )}

          <button type="submit" id="btn-change-password" disabled={pwLoading} className="w-full py-2.5 bg-[#FAD4C0] hover:bg-[#f0c4b0] disabled:opacity-60 text-[#7C4A2D] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {pwLoading ? <span className="w-4 h-4 border-2 border-[#7C4A2D]/30 border-t-[#7C4A2D] rounded-full animate-spin" /> : <Lock size={15} />}
            Ubah Password
          </button>
        </form>
      )}
    </div>
  );
}