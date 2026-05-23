import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import http from 'http'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import authRouter from './auth.js'
import { createConversationsRouter } from './conversations.js'

process.env.JWT_SECRET = 'test-secret'

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use('/auth', authRouter)

const httpServer = http.createServer(app)
const io = new Server(httpServer)
app.use('/conversations', createConversationsRouter(io))

async function loginAs(email: string) {
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'password123' })
  return {
    cookie: res.headers['set-cookie'][0] as string,
    user: res.body as { id: string; username: string; email: string },
  }
}

describe('POST /conversations', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/conversations').send({ targetUserId: 'x' })
    expect(res.status).toBe(401)
  })

  it('rejects missing targetUserId', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({})
    expect(res.status).toBe(400)
  })

  it('rejects self-conversation', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: alice.user.id })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown user', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: 'nonexistent-id' })
    expect(res.status).toBe(404)
  })

  it('returns existing conversation when one already exists (idempotent)', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    const res = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ otherUser: { username: 'bob' } })
    expect(res.body.id).toBeDefined()
  })

  it('creates a new conversation and is idempotent on repeat', async () => {
    const bob = await loginAs('bob@example.com')
    const carol = await loginAs('carol@example.com')

    const first = await request(app)
      .post('/conversations')
      .set('Cookie', bob.cookie)
      .send({ targetUserId: carol.user.id })

    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({ otherUser: { username: 'carol' } })

    const second = await request(app)
      .post('/conversations')
      .set('Cookie', bob.cookie)
      .send({ targetUserId: carol.user.id })

    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)
  })
})

describe('GET /conversations', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/conversations')
    expect(res.status).toBe(401)
  })

  it('returns conversations for the current user', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app).get('/conversations').set('Cookie', alice.cookie)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(2)

    for (const convo of res.body) {
      expect(convo).toHaveProperty('id')
      expect(convo).toHaveProperty('otherUser')
      expect(convo.otherUser).toHaveProperty('username')
    }
  })

  it('returns conversations sorted by latest message descending', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app).get('/conversations').set('Cookie', alice.cookie)

    const times = res.body.map((c: { latestMessage?: { createdAt: string }; createdAt: string }) =>
      new Date(c.latestMessage?.createdAt ?? c.createdAt).getTime(),
    )
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1])
    }
  })

  it('includes latest message preview', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app).get('/conversations').set('Cookie', alice.cookie)

    const carolConvo = res.body.find(
      (c: { otherUser: { username: string } }) => c.otherUser.username === 'carol',
    )
    expect(carolConvo.latestMessage).toMatchObject({ body: 'Perfect 👍' })
  })

  it('returns empty array for user with no conversations', async () => {
    const unique = Date.now().toString()
    await request(app)
      .post('/auth/register')
      .send({ username: `newuser${unique}`, email: `new${unique}@example.com`, password: 'password123' })

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: `new${unique}@example.com`, password: 'password123' })

    const cookie = loginRes.headers['set-cookie'][0]
    const res = await request(app).get('/conversations').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /conversations/:id/messages', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/conversations/fake-id/messages').send({ body: 'hi' })
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown conversation', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .post('/conversations/nonexistent-id/messages')
      .set('Cookie', alice.cookie)
      .send({ body: 'hi' })
    expect(res.status).toBe(404)
  })

  it('returns 403 when user is not a participant', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')
    const carol = await loginAs('carol@example.com')

    // Get bob-carol conversation id (bob creates it)
    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', bob.cookie)
      .send({ targetUserId: carol.user.id })
    const conversationId = convoRes.body.id

    // Alice is not in bob-carol convo
    const res = await request(app)
      .post(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ body: 'sneaky' })
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing body', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })
    const conversationId = convoRes.body.id

    const res = await request(app)
      .post(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)
      .send({})
    expect(res.status).toBe(400)
  })

  it('creates and returns the message', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })
    const conversationId = convoRes.body.id

    const res = await request(app)
      .post(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ body: 'Hello Bob!' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      conversationId,
      senderId: alice.user.id,
      body: 'Hello Bob!',
    })
    expect(res.body.id).toBeDefined()
    expect(res.body.createdAt).toBeDefined()
  })
})
