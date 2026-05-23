import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router: ExpressRouter = Router()

router.put('/', requireAuth, async (req, res) => {
  const { avatarIndex } = req.body as Record<string, unknown>

  if (typeof avatarIndex !== 'number' || avatarIndex < 0 || avatarIndex > 8) {
    res.status(400).json({ error: 'avatarIndex must be a number between 0 and 8' })
    return
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { avatarIndex },
  })

  res.json({ id: user.id, username: user.username, email: user.email, avatarIndex: user.avatarIndex })
})

export default router
