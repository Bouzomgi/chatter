import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

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

export default router
