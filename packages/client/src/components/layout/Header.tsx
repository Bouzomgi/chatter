import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'

export default function Header() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

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
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 25px',
      height: '80px',
      flexShrink: 0,
    }}>
      <h1
        onClick={() => navigate('/')}
        style={{ color: 'white', fontSize: '75px', cursor: 'pointer', margin: 0, lineHeight: 1 }}
      >
        chatter
      </h1>
      {user && (
        <button
          onClick={logout}
          style={{ color: 'white', fontSize: '30px', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          log out
        </button>
      )}
    </header>
  )
}
