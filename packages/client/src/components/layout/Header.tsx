import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'

export default function Header() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const onSettings = location.pathname === '/settings'

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    navigate('/login')
  }

  return (
    <header style={{
      backgroundColor: '#00a676',
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 25px',
      boxSizing: 'border-box',
      flexShrink: 0,
    }}>
      <h1
        onClick={() => navigate('/')}
        style={{
          color: 'white',
          fontSize: '75px',
          fontWeight: 400,
          cursor: 'pointer',
          margin: 0,
          lineHeight: '65%',
          paddingTop: '35px',
          paddingBottom: '10px',
        }}
      >
        chatter
      </h1>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link
            to="/settings"
            className="header-action"
            style={{ color: onSettings ? 'white' : undefined }}
          >
            settings
          </Link>
          <button className="header-action" onClick={logout}>
            log out
          </button>
        </div>
      )}
    </header>
  )
}
