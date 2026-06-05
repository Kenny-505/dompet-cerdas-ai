import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TopHeader from './TopHeader';
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank, TrendingUp,
  MessageSquare, AlertTriangle, User, LogOut, Wallet,
} from 'lucide-react';

// Sidebar desktop — semua 7 menu
const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transaksi',  icon: ArrowLeftRight,  label: 'Transaksi' },
  { to: '/budget',     icon: PiggyBank,       label: 'Budget' },
  { to: '/prediksi',   icon: TrendingUp,      label: 'Prediksi' },
  { to: '/chat',       icon: MessageSquare,   label: 'AI Chat' },
  { to: '/anomali',    icon: AlertTriangle,   label: 'Anomali' },
  { to: '/profil',     icon: User,            label: 'Profil' },
];

// Bottom nav mobile — 5 item clean
// Transaksi & Budget diakses via shortcut di Dashboard (Home)
// Logout diakses via halaman Profil
const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/prediksi',   icon: TrendingUp,      label: 'Prediksi' },
  { to: '/anomali',    icon: AlertTriangle,   label: 'Anomali' },
  { to: '/chat',       icon: MessageSquare,   label: 'AI Chat' },
  { to: '/profil',     icon: User,            label: 'Profil' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#FFF5E6] text-gray-900 overflow-hidden">
      {/* —— Sidebar (desktop only) ——————————————— */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-white border-r border-[#E8D5C4]">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#E8D5C4]">
          <div className="w-9 h-9 rounded-xl bg-[#FAD4C0] flex items-center justify-center shadow-sm">
            <Wallet size={18} className="text-[#7C4A2D]" />
          </div>
          <div>
            <p className="font-bold text-sm text-gray-900 leading-tight">DompetCerdas</p>
            <p className="text-xs text-[#80A1C1]">AI Finance</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#FAD4C0]/40 text-[#7C4A2D] border-r-2 border-[#FAD4C0]'
                    : 'text-gray-500 hover:bg-[#FFF5E6] hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-[#E8D5C4] space-y-1">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#FAD4C0] flex items-center justify-center text-xs font-bold text-[#7C4A2D]">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* —— Main Content ————————————————————————————— */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative flex flex-col">
        <div className="flex-shrink-0">
          <TopHeader />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* —— Bottom Navigation (mobile only) — 5 item clean ——————————— */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E8D5C4] flex items-center justify-around px-1 py-2">
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-150 flex-1 ${
                isActive ? 'text-[#7C4A2D]' : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-[#FAD4C0]/40' : ''}`}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
