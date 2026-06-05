import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, Wallet } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password minimal 8 karakter');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      return setError('Password harus mengandung huruf besar, kecil, dan angka');
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const strengthLabels = ['', 'Lemah', 'Cukup', 'Baik', 'Kuat'];

  return (
    <div className="space-y-8">
      <div className="lg:hidden flex items-center gap-3 justify-center">
        <div className="w-10 h-10 rounded-xl bg-[#FAD4C0] flex items-center justify-center">
          <Wallet size={20} className="text-[#7C4A2D]" />
        </div>
        <span className="font-bold text-gray-900 text-lg">DompetCerdas AI</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Buat akun baru</h2>
        <p className="text-gray-500 mt-1">Mulai kelola keuanganmu dengan AI</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="reg-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="Nama Kamu"
              className="w-full bg-white border border-[#E8D5C4] rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="email@contoh.com"
              className="w-full bg-white border border-[#E8D5C4] rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="reg-password"
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 8 karakter"
              className="w-full bg-white border border-[#E8D5C4] rounded-xl pl-10 pr-11 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Password strength */}
          {form.password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= pwStrength ? strengthColors[pwStrength] : 'bg-[#E8D5C4]'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-500">Kekuatan: <span className="text-gray-700">{strengthLabels[pwStrength]}</span></p>
            </div>
          )}
        </div>

        <button
          id="register-submit"
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-[#FAD4C0] hover:bg-[#F5C0A8] text-[#7C4A2D] font-semibold text-sm transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Sudah punya akun?{' '}
        <Link to="/login" className="text-[#80A1C1] hover:text-[#2C5282] font-medium transition-colors">
          Masuk
        </Link>
      </p>
    </div>
  );
}