import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import prisma from '../lib/prisma.js'
import type { AuthPayload } from '../middleware/auth.js'

declare module 'socket.io' {
  interface SocketData {
    userId: string
  }
}

function extractToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/)
  return match ? match[1] : null
}

export function registerSocketHandlers(io: Server) {
  io.use((socket: Socket, next) => {
    const token = extractToken(socket.handshake.headers.cookie)
    if (!token) {
      next(new Error('Unauthorized'))
      return
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
      socket.data.userId = payload.userId
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', async (socket: Socket) => {
    const participants = await prisma.participant.findMany({
      where: { userId: socket.data.userId },
      select: { conversationId: true },
    })
    for (const { conversationId } of participants) {
      socket.join(conversationId)
    }

    const rooms = [...socket.rooms].filter(r => r !== socket.id)

    if (rooms.length > 0) {
      socket.to(rooms).emit('user:online', { userId: socket.data.userId })
    }

    const onlineInRooms = new Set<string>()
    for (const roomId of rooms) {
      const sockets = await io.in(roomId).fetchSockets()
      for (const s of sockets) {
        if (s.data.userId && s.data.userId !== socket.data.userId) {
          onlineInRooms.add(s.data.userId)
        }
      }
    }
    socket.emit('presence:init', { onlineUserIds: [...onlineInRooms] })

    socket.on('disconnecting', () => {
      const disconnectRooms = [...socket.rooms].filter(r => r !== socket.id)
      if (disconnectRooms.length > 0) {
        socket.to(disconnectRooms).emit('user:offline', { userId: socket.data.userId })
      }
    })
  })
}
