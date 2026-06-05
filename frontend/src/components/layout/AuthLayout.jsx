import { Outlet } from 'react-router-dom';
import { Wallet } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#FFF5E6] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#FAD4C0]/20 p-12 border-r border-[#E8D5C4]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAD4C0] flex items-center justify-center shadow-sm">
            <Wallet size={20} className="text-[#7C4A2D]" />
          </div>
          <div>
            <p className="font-bold text-gray-900">DompetCerdas AI</p>
            <p className="text-xs text-[#80A1C1]">Keuangan Cerdas untuk Gen-Z</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight">
              Kelola keuangan<br />
              dengan <span className="text-[#7C4A2D]">kecerdasan AI</span>
            </h1>
            <p className="mt-4 text-gray-500 text-lg leading-relaxed">
              Auto-kategorisasi, prediksi pengeluaran, deteksi anomali, dan asisten keuangan personal — semua dalam satu platform.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Auto-Kategorisasi', desc: 'CNN klasifikasi 12 kategori' },
              { label: 'Prediksi Pengeluaran', desc: 'LSTM time-series forecasting' },
              { label: 'Deteksi Anomali', desc: 'Autoencoder real-time' },
              { label: 'AI Assistant', desc: 'Groq LLaMA financial advisor' },
            ].map((f) => (
              <div key={f.label} className="bg-white rounded-xl p-4 border border-[#E8D5C4]">
                <p className="text-sm font-semibold text-[#7C4A2D]">{f.label}</p>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-400 text-sm">© 2026 DompetCerdas AI. Capstone Dicoding CC26-PSU115</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}