import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const updateAvatarSchema = z.object({
  avatarIndex: z.number().int().min(0).max(8),
})

const router: ExpressRouter = Router()

router.get('/', requireAuth, async (req, res) => {
  const currentUserId = req.user!.userId

  const users = await prisma.user.findMany({
    where: { id: { not: currentUserId } },
    select: { id: true, username: true, avatarIndex: true },
    orderBy: { username: 'asc' },
  })

  res.json(users)
})

router.put('/me', requireAuth, async (req, res) => {
  const parsed = updateAvatarSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'avatarIndex must be a number between 0 and 8' })
    return
  }
  const { avatarIndex } = parsed.data

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { avatarIndex },
  })

  res.json({ id: user.id, username: user.username, email: user.email, avatarIndex: user.avatarIndex })
})

export default router
