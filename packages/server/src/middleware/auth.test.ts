import { describe, it, expect } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { requireAuth } from './auth.js'

const SECRET = 'test-secret'
process.env.JWT_SECRET = SECRET

function makeApp() {
  const app = express()
  app.use(cookieParser())
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ userId: req.user!.userId })
  })
  return app
}

function validToken(userId = 'user-1') {
  return jwt.sign({ userId }, SECRET)
}

describe('requireAuth middleware', () => {
  it('returns 401 when no cookie is present', async () => {
    const res = await request(makeApp()).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Unauthorized')
  })

  it('returns 401 for a malformed token', async () => {
    const res = await request(makeApp())
      .get('/protected')
      .set('Cookie', 'token=not.a.valid.jwt')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Unauthorized')
  })

  it('returns 401 for a token signed with the wrong secret', async () => {
    const badToken = jwt.sign({ userId: 'user-1' }, 'wrong-secret')
    const res = await request(makeApp())
      .get('/protected')
      .set('Cookie', `token=${badToken}`)
    expect(res.status).toBe(401)
  })

  it('returns 401 for an expired token', async () => {
    const expired = jwt.sign({ userId: 'user-1' }, SECRET, { expiresIn: -1 })
    const res = await request(makeApp())
      .get('/protected')
      .set('Cookie', `token=${expired}`)
    expect(res.status).toBe(401)
  })

  it('calls next and sets req.user for a valid token', async () => {
    const res = await request(makeApp())
      .get('/protected')
      .set('Cookie', `token=${validToken('abc-123')}`)
    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('abc-123')
  })
})
