import { useEffect, useState } from 'react'
import { socket } from '../lib/socket.js'

export function usePresence(): Set<string> {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    function onInit({ onlineUserIds }: { onlineUserIds: string[] }) {
      setOnlineUserIds(new Set(onlineUserIds))
    }
    function onUserOnline({ userId }: { userId: string }) {
      setOnlineUserIds(prev => new Set([...prev, userId]))
    }
    function onUserOffline({ userId }: { userId: string }) {
      setOnlineUserIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }

    socket.on('presence:init', onInit)
    socket.on('user:online', onUserOnline)
    socket.on('user:offline', onUserOffline)

    return () => {
      socket.off('presence:init', onInit)
      socket.off('user:online', onUserOnline)
      socket.off('user:offline', onUserOffline)
    }
  }, [])

  return onlineUserIds
}
