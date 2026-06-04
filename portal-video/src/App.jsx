import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './services/AuthContext'
import AppLayout from './pages/AppLayout'
import LoginPage from './pages/LoginPage'
import VideoEngine from './pages/VideoEngine'
import VideoHistory from './pages/VideoHistory'

function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>加载中...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/video">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route path="/" element={<Navigate to="/create" replace />} />
            <Route path="/create" element={<VideoEngine />} />
            <Route path="/history" element={<VideoHistory />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
