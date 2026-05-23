import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/auth.js'
import Header from './components/layout/Header.js'
import Login from './pages/Login.js'
import Register from './pages/Register.js'
import Chat from './pages/Chat.js'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function GuestRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Header />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Chat />} />
              </Route>
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
