import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Component, type ReactNode } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: '#F8FAFF', fontFamily: 'Manrope, sans-serif' }}>
          <p style={{ fontSize: 15, color: '#0E2A55', fontWeight: 700 }}>Erro na página</p>
          <pre style={{ fontSize: 12, color: '#ef4444', background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #fecaca', maxWidth: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.error}</pre>
          <button onClick={() => { this.setState({ error: null }); window.location.href = '/home' }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#2A60C2', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Voltar ao início</button>
        </div>
      )
    }
    return this.props.children
  }
}
import Landing from '@/pages/Landing'
import Auth from '@/pages/Auth'
import Home from '@/pages/Home'
import Resultados from '@/pages/Resultados'
import Promotions from '@/pages/Promotions'
import Wallet from '@/pages/Wallet'
import SavedStrategies from '@/pages/SavedStrategies'
import SearchWizard from '@/pages/SearchWizard'
import Roteiro from '@/pages/Roteiro'
import Configuracoes from '@/pages/Configuracoes'
import Planos from '@/pages/Planos'
import Checkout from '@/pages/Checkout'
import Onboarding from '@/pages/Onboarding'
import ChatBuscaAvancada from '@/pages/ChatBuscaAvancada'
import Mapa from '@/pages/Mapa'
import Admin from '@/pages/Admin'
import { BottomNav } from '@/components/BottomNav'
import { useAdmin } from '@/hooks/useAdmin'

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
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin()
  if (authLoading || adminLoading) return null
  if (!user || !isAdmin) return <Navigate to="/home" replace />
  return <>{children}</>
}

// Pages that should show BottomNav (authenticated app pages)
const APP_ROUTES = ['/home', '/resultados', '/promotions', '/wallet', '/saved-strategies', '/roteiro', '/configuracoes', '/busca-avancada', '/chat', '/mapa']

function AppRoutesInner() {
  const { user } = useAuth()
  const location = useLocation()
  const showBottomNav = user && APP_ROUTES.some(r => location.pathname.startsWith(r))
  return showBottomNav ? <BottomNav /> : null
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
    <>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/home" replace /> : <Landing />} />
        <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <Auth />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/resultados" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
        <Route path="/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/saved-strategies" element={<ProtectedRoute><SavedStrategies /></ProtectedRoute>} />
        <Route path="/busca-avancada" element={<ProtectedRoute><SearchWizard /></ProtectedRoute>} />
        <Route path="/roteiro" element={<ProtectedRoute><Roteiro /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
        <Route path="/planos" element={<ProtectedRoute><Planos /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/chat/:id" element={<ProtectedRoute><ChatBuscaAvancada /></ProtectedRoute>} />
        <Route path="/mapa" element={<ProtectedRoute><Mapa /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppRoutesInner />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
