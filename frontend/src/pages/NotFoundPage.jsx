import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-9xl font-black text-[#FAD4C0] drop-shadow-sm">404</h1>
      <p className="text-2xl font-semibold text-gray-900 mt-4">Halaman Tidak Ditemukan</p>
      <p className="text-gray-500 mt-2 max-w-md">
        Sepertinya Anda tersesat. Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link 
        to="/dashboard" 
        className="mt-8 flex items-center gap-2 px-6 py-3 bg-[#FAD4C0] hover:bg-[#f0c4b0] text-[#7C4A2D] rounded-xl font-medium transition-colors"
      >
        <Home size={18} />
        Kembali ke Dashboard
      </Link>
    </div>
  );
}