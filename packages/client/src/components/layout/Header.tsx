import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth.js'

export default function Header() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

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
        <button
          onClick={logout}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            color: hovered ? 'white' : 'black',
            fontSize: '30px',
            fontWeight: 400,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          log out
        </button>
      )}
    </header>
  )
}
