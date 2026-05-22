import { Router, IRouter } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router: IRouter = Router()

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
        include: { user: { select: { id: true, username: true } } },
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
        include: { user: { select: { id: true, username: true } } },
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
        include: { user: { select: { id: true, username: true } } },
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

export default router
