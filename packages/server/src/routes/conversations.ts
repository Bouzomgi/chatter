import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { Server } from 'socket.io'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

export function createConversationsRouter(io: Server): ExpressRouter {
  const router = Router()

  router.post('/', requireAuth, async (req, res) => {
    const currentUserId = req.user!.userId
    const { targetUserId } = req.body as Record<string, unknown>

    if (!targetUserId || typeof targetUserId !== 'string') {
      res.status(400).json({ error: 'targetUserId is required' })
      return
    }

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
          where: { userId: { not: currentUserId } },
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
      .map(c => ({
        id: c.id,
        createdAt: c.createdAt,
        otherUser: c.participants[0]?.user ?? null,
        latestMessage: c.messages[0] ?? null,
      }))
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

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })

    res.json(messages)
  })

  router.post('/:id/messages', requireAuth, async (req, res) => {
    const currentUserId = req.user!.userId
    const conversationId = req.params.id
    const { body } = req.body as Record<string, unknown>

    if (!body || typeof body !== 'string' || body.trim() === '') {
      res.status(400).json({ error: 'body is required' })
      return
    }

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

    const message = await prisma.message.create({
      data: { conversationId, senderId: currentUserId, body: body.trim() },
    })

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

  return router
}
