import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { Server } from 'socket.io'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const createConversationSchema = z.object({
  targetUserId: z.string().min(1),
})

const createMessageSchema = z.object({
  body: z.string().min(1).max(4000).transform(s => s.trim()).refine(s => s.length > 0, { message: 'body is required' }),
})

const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
})

export function createConversationsRouter(io: Server): ExpressRouter {
  const router = Router()

  router.post('/', requireAuth, async (req, res) => {
    const currentUserId = req.user!.userId
    const parsed = createConversationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'targetUserId is required' })
      return
    }
    const { targetUserId } = parsed.data

    if (targetUserId === currentUserId) {
      res.status(400).json({ error: 'Cannot start a conversation with yourself' })
      return
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!target) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        participants: {
          where: { userId: targetUserId },
          include: { user: { select: { id: true, username: true, avatarIndex: true } } },
        },
      },
    })

    if (existing) {
      res.json({ id: existing.id, createdAt: existing.createdAt, otherUser: existing.participants[0].user })
      return
    }

    const conversation = await prisma.conversation.create({
      data: {
        participants: { create: [{ userId: currentUserId }, { userId: targetUserId }] },
      },
      include: {
        participants: {
          where: { userId: targetUserId },
          include: { user: { select: { id: true, username: true, avatarIndex: true } } },
        },
      },
    })

    res.status(201).json({
      id: conversation.id,
      createdAt: conversation.createdAt,
      otherUser: conversation.participants[0].user,
    })
  })

  router.get('/', requireAuth, async (req, res) => {
    const currentUserId = req.user!.userId

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: currentUserId } } },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, avatarIndex: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, senderId: true, createdAt: true },
        },
      },
    })

    const result = conversations
      .map(c => {
        const myParticipant = c.participants.find(p => p.userId === currentUserId)
        const otherParticipant = c.participants.find(p => p.userId !== currentUserId)
        return {
          id: c.id,
          createdAt: c.createdAt,
          otherUser: otherParticipant?.user ?? null,
          latestMessage: c.messages[0] ?? null,
          unread: myParticipant ? !myParticipant.seen : false,
        }
      })
      .filter(c => c.latestMessage !== null)
      .sort((a, b) => {
        const aTime = a.latestMessage?.createdAt ?? a.createdAt
        const bTime = b.latestMessage?.createdAt ?? b.createdAt
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })

    res.json(result)
  })

  router.get('/:id/messages', requireAuth, async (req, res) => {
    const currentUserId = req.user!.userId
    const conversationId = req.params.id

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    })

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }

    const isParticipant = conversation.participants.some(p => p.userId === currentUserId)
    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const { limit, before } = messagesQuerySchema.parse(req.query)

    let createdAtFilter: { lt: Date } | undefined
    if (before) {
      const cursorMsg = await prisma.message.findUnique({ where: { id: before } })
      if (!cursorMsg) {
        res.status(400).json({ error: 'Invalid cursor' })
        return
      }
      createdAtFilter = { lt: cursorMsg.createdAt }
    }

    const batch = await prisma.message.findMany({
      where: { conversationId, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })

    const hasMore = batch.length > limit
    const messages = batch.slice(0, limit).reverse()

    res.json({ messages, hasMore })
  })

  router.post('/:id/messages', requireAuth, async (req, res) => {
    const currentUserId = req.user!.userId
    const conversationId = req.params.id
    const parsed = createMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'body is required' })
      return
    }
    const body = parsed.data.body

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    })

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' })
      return
    }

    const isParticipant = conversation.participants.some(p => p.userId === currentUserId)
    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, senderId: currentUserId, body },
      }),
      prisma.participant.updateMany({
        where: { conversationId, userId: { not: currentUserId } },
        data: { seen: false },
      }),
    ])

    io.to(conversationId).emit('message:new', {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt,
    })

    res.status(201).json({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt,
    })
  })

  router.patch('/:id/read', requireAuth, async (req, res) => {
    const currentUserId = req.user!.userId
    const conversationId = req.params.id

    const participant = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
    })

    if (!participant) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    await prisma.participant.update({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      data: { seen: true },
    })

    res.status(204).end()
  })

  return router
}
