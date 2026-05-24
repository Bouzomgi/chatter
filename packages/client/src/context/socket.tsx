import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket.js'
import { useAuth } from './auth.js'

interface SocketState {
  socketConnected: boolean
  setActiveConversationId: (id: string | null) => void
}

const SocketContext = createContext<SocketState>({
  socketConnected: false,
  setActiveConversationId: () => {},
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [socketConnected, setSocketConnected] = useState(false)
  const activeConversationIdRef = useRef<string | null>(null)

  function setActiveConversationId(id: string | null) {
    activeConversationIdRef.current = id
  }

  useEffect(() => {
    if (!user) return

    socket.connect()
    function onConnect() { setSocketConnected(true) }
    function onDisconnect() { setSocketConnected(false) }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.disconnect()
      setSocketConnected(false)
    }
  }, [user])

  return (
    <SocketContext.Provider value={{ socketConnected, setActiveConversationId }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
