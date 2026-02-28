import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Landing from '@/pages/Landing'
import Auth from '@/pages/Auth'
import Home from '@/pages/Home'
import Resultados from '@/pages/Resultados'
import Promotions from '@/pages/Promotions'
import Wallet from '@/pages/Wallet'
import SavedStrategies from '@/pages/SavedStrategies'
import SearchWizard from '@/pages/SearchWizard'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080a10', color: '#64748b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); }}`}</style>
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  // Wait for Supabase session check before rendering any route.
  // This prevents the white-screen flash caused by briefly showing Landing
  // or bouncing to /auth before we know the auth state.
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080a10' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="#1e3a5f" strokeWidth="2" />
            <path d="M12 2a10 10 0 0110 10" stroke="#4a90e2" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); }}`}</style>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/home" replace /> : <Landing />} />
      <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <Auth />} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/resultados" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
      <Route path="/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
      <Route path="/saved-strategies" element={<ProtectedRoute><SavedStrategies /></ProtectedRoute>} />
      <Route path="/busca-avancada" element={<ProtectedRoute><SearchWizard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
