import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Wallet } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Cek email dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Mobile brand */}
      <div className="lg:hidden flex items-center gap-3 justify-center">
        <div className="w-10 h-10 rounded-xl bg-[#FAD4C0] flex items-center justify-center">
          <Wallet size={20} className="text-[#7C4A2D]" />
        </div>
        <span className="font-bold text-gray-900 text-lg">DompetCerdas AI</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Selamat datang kembali</h2>
        <p className="text-gray-500 mt-1">Masuk ke akun DompetCerdas AI kamu</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="login-email"
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
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="login-password"
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full bg-white border border-[#E8D5C4] rounded-xl pl-10 pr-11 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FAD4C0] focus:ring-1 focus:ring-[#FAD4C0]/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-[#FAD4C0] hover:bg-[#F5C0A8] text-[#7C4A2D] font-semibold text-sm transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Masuk...' : 'Masuk'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Belum punya akun?{' '}
        <Link to="/register" className="text-[#80A1C1] hover:text-[#2C5282] font-medium transition-colors">
          Daftar sekarang
        </Link>
      </p>
    </div>
  );
}