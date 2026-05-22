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
  })
}
