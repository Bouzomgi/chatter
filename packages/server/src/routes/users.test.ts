import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import authRouter from './auth.js'
import usersRouter from './users.js'

process.env.JWT_SECRET = 'test-secret'

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use('/auth', authRouter)
app.use('/users', usersRouter)

async function loginAs(email: string) {
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'password123' })
  return { cookie: res.headers['set-cookie'][0] as string, user: res.body }
}

// ── GET /users ────────────────────────────────────────────────────────────────

describe('GET /users', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/users')
    expect(res.status).toBe(401)
  })

  it('returns other users excluding the current user', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app).get('/users').set('Cookie', alice.cookie)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    const returnedIds = res.body.map((u: { id: string }) => u.id)
    expect(returnedIds).not.toContain(alice.user.id)
  })

  it('returns users with id, username, and avatarIndex only', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app).get('/users').set('Cookie', alice.cookie)

    for (const user of res.body) {
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('username')
      expect(user).toHaveProperty('avatarIndex')
      expect(user).not.toHaveProperty('email')
      expect(user).not.toHaveProperty('passwordHash')
    }
  })

  it('returns users sorted alphabetically by username', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app).get('/users').set('Cookie', alice.cookie)

    const names = res.body.map((u: { username: string }) => u.username)
    expect(names).toEqual([...names].sort())
  })
})

// ── PUT /users/me ─────────────────────────────────────────────────────────────

describe('PUT /users/me', () => {
  it('requires auth', async () => {
    const res = await request(app).put('/users/me').send({ avatarIndex: 3 })
    expect(res.status).toBe(401)
  })

  it('updates the avatar index and returns updated user', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .put('/users/me')
      .set('Cookie', alice.cookie)
      .send({ avatarIndex: 5 })

    expect(res.status).toBe(200)
    expect(res.body.avatarIndex).toBe(5)
    expect(res.body.id).toBe(alice.user.id)
    expect(res.body).toHaveProperty('username')
    expect(res.body).toHaveProperty('email')
  })

  it('rejects avatarIndex below 0', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .put('/users/me')
      .set('Cookie', alice.cookie)
      .send({ avatarIndex: -1 })

    expect(res.status).toBe(400)
  })

  it('rejects avatarIndex above 8', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .put('/users/me')
      .set('Cookie', alice.cookie)
      .send({ avatarIndex: 9 })

    expect(res.status).toBe(400)
  })

  it('rejects a string avatarIndex', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .put('/users/me')
      .set('Cookie', alice.cookie)
      .send({ avatarIndex: '3' })

    expect(res.status).toBe(400)
  })

  it('rejects a missing avatarIndex', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .put('/users/me')
      .set('Cookie', alice.cookie)
      .send({})

    expect(res.status).toBe(400)
  })

  it('accepts boundary values 0 and 8', async () => {
    const alice = await loginAs('alice@example.com')

    const res0 = await request(app)
      .put('/users/me')
      .set('Cookie', alice.cookie)
      .send({ avatarIndex: 0 })
    expect(res0.status).toBe(200)
    expect(res0.body.avatarIndex).toBe(0)

    const res8 = await request(app)
      .put('/users/me')
      .set('Cookie', alice.cookie)
      .send({ avatarIndex: 8 })
    expect(res8.status).toBe(200)
    expect(res8.body.avatarIndex).toBe(8)
  })
})
