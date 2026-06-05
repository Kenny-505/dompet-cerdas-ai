import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TransaksiPage from './pages/TransaksiPage';
import BudgetPage from './pages/BudgetPage';
import PrediksiPage from './pages/PrediksiPage';
import ChatPage from './pages/ChatPage';
import AnomaliPage from './pages/AnomaliPage';
import ProfilPage from './pages/ProfilPage';

/**
 * Route guard: redirect ke /login jika belum autentikasi
 */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
  </div>;
  return user ? children : <Navigate to="/login" replace />;
}

/**
 * Route guard: redirect ke /dashboard jika sudah login
 */
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={
              <PublicRoute><LoginPage /></PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute><RegisterPage /></PublicRoute>
            } />
          </Route>

          {/* Protected Routes */}
          <Route element={
            <PrivateRoute><AppLayout /></PrivateRoute>
          }>
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/transaksi"  element={<TransaksiPage />} />
            <Route path="/budget"     element={<BudgetPage />} />
            <Route path="/prediksi"   element={<PrediksiPage />} />
            <Route path="/chat"       element={<ChatPage />} />
            <Route path="/anomali"    element={<AnomaliPage />} />
            <Route path="/profil"     element={<ProfilPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
