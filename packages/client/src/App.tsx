import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/auth.js'
import { SocketProvider } from './context/socket.js'
import Header from './components/layout/Header.js'
import Login from './pages/Login.js'
import Register from './pages/Register.js'
import Chat from './pages/Chat.js'
import Settings from './pages/Settings.js'

function GuestRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : <Outlet />
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return (
    <>
      <div style={{ display: pathname === '/' ? 'flex' : 'none', height: '100%' }}>
        <Chat />
      </div>
      {pathname === '/settings' && <Settings />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Header />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Routes>
                <Route element={<GuestRoute />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>
                <Route path="/*" element={<ProtectedLayout />} />
              </Routes>
            </div>
          </div>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
