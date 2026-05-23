import { Router, IRouter } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router: IRouter = Router()

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function issueToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body as Record<string, unknown>
  if (!username || !email || !password) {
    res.status(400).json({ error: 'username, email and password are required' })
    return
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: String(username) }, { email: String(email) }] },
  })
  if (existing) {
    res.status(409).json({ error: 'Username or email already taken' })
    return
  }

  const passwordHash = await bcrypt.hash(String(password), 12)
  const avatarIndex = Math.floor(Math.random() * 9)
  const user = await prisma.user.create({
    data: { username: String(username), email: String(email), passwordHash, avatarIndex },
  })

  res.cookie('token', issueToken(user.id), COOKIE_OPTS)
  res.status(201).json({ id: user.id, username: user.username, email: user.email, avatarIndex: user.avatarIndex })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body as Record<string, unknown>
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email: String(email) } })
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  res.cookie('token', issueToken(user.id), COOKIE_OPTS)
  res.json({ id: user.id, username: user.username, email: user.email, avatarIndex: user.avatarIndex })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.sendStatus(200)
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  res.json({ id: user.id, username: user.username, email: user.email, avatarIndex: user.avatarIndex })
})

export default router
