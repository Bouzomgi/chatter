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
    const res = await request(app).post('/conversations').send({ participantIds: ['x'] })
    expect(res.status).toBe(401)
  })

  it('rejects missing participantIds', async () => {
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
      .send({ participantIds: [alice.user.id] })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown user', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ participantIds: ['nonexistent-id'] })
    expect(res.status).toBe(404)
  })

  it('returns existing conversation when one already exists (idempotent)', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    const res = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ participantIds: [bob.user.id] })

    expect(res.status).toBe(200)
    expect(res.body.participants).toEqual(expect.arrayContaining([expect.objectContaining({ username: 'bob' })]))
    expect(res.body.id).toBeDefined()
  })

  it('creates a new conversation and is idempotent on repeat', async () => {
    const bob = await loginAs('bob@example.com')
    const carol = await loginAs('carol@example.com')

    const first = await request(app)
      .post('/conversations')
      .set('Cookie', bob.cookie)
      .send({ participantIds: [carol.user.id] })

    expect(first.status).toBe(201)
    expect(first.body.participants).toEqual(expect.arrayContaining([expect.objectContaining({ username: 'carol' })]))

    const second = await request(app)
      .post('/conversations')
      .set('Cookie', bob.cookie)
      .send({ participantIds: [carol.user.id] })

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
      expect(convo).toHaveProperty('participants')
      expect(Array.isArray(convo.participants)).toBe(true)
      expect(convo.participants[0]).toHaveProperty('username')
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
      (c: { participants: { username: string }[] }) => c.participants.some(p => p.username === 'carol'),
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
      .send({ participantIds: [carol.user.id] })
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
      .send({ participantIds: [bob.user.id] })
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
      .send({ participantIds: [bob.user.id] })
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

describe('GET /conversations/:id/messages', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/conversations/fake-id/messages')
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown conversation', async () => {
    const alice = await loginAs('alice@example.com')
    const res = await request(app)
      .get('/conversations/nonexistent-id/messages')
      .set('Cookie', alice.cookie)
    expect(res.status).toBe(404)
  })

  it('returns 403 when user is not a participant', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')
    const carol = await loginAs('carol@example.com')

    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', bob.cookie)
      .send({ participantIds: [carol.user.id] })
    const conversationId = convoRes.body.id

    const res = await request(app)
      .get(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)
    expect(res.status).toBe(403)
  })

  it('returns messages and hasMore=false when all messages fit in the limit', async () => {
    const alice = await loginAs('alice@example.com')
    const convos = await request(app).get('/conversations').set('Cookie', alice.cookie)
    const conversationId = convos.body[0].id

    const res = await request(app)
      .get(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.messages)).toBe(true)
    expect(typeof res.body.hasMore).toBe('boolean')
    expect(res.body.hasMore).toBe(false)
  })

  it('returns messages in ascending createdAt order', async () => {
    const alice = await loginAs('alice@example.com')
    const convos = await request(app).get('/conversations').set('Cookie', alice.cookie)
    const conversationId = convos.body[0].id

    const res = await request(app)
      .get(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)

    const times = res.body.messages.map((m: { createdAt: string }) => new Date(m.createdAt).getTime())
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
    }
  })

  it('respects the limit param and sets hasMore=true', async () => {
    const unique = Date.now().toString()
    const u1Res = await request(app).post('/auth/register').send({ username: `u1${unique}`, email: `u1${unique}@test.com`, password: 'pw' })
    const u2Res = await request(app).post('/auth/register').send({ username: `u2${unique}`, email: `u2${unique}@test.com`, password: 'pw' })
    const cookie = u1Res.headers['set-cookie'][0] as string

    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', cookie)
      .send({ participantIds: [u2Res.body.id] })
    const conversationId = convoRes.body.id

    for (const body of ['msg1', 'msg2', 'msg3']) {
      await request(app).post(`/conversations/${conversationId}/messages`).set('Cookie', cookie).send({ body })
    }

    const res = await request(app)
      .get(`/conversations/${conversationId}/messages?limit=2`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.messages).toHaveLength(2)
    expect(res.body.hasMore).toBe(true)
    expect(res.body.messages[0].body).toBe('msg2')
    expect(res.body.messages[1].body).toBe('msg3')
  }, 15000)

  it('paginates correctly using the before cursor', async () => {
    const unique = (Date.now() + 1).toString()
    const u1Res = await request(app).post('/auth/register').send({ username: `pa1${unique}`, email: `pa1${unique}@test.com`, password: 'pw' })
    const u2Res = await request(app).post('/auth/register').send({ username: `pa2${unique}`, email: `pa2${unique}@test.com`, password: 'pw' })
    const cookie = u1Res.headers['set-cookie'][0] as string

    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', cookie)
      .send({ participantIds: [u2Res.body.id] })
    const conversationId = convoRes.body.id

    for (const body of ['a', 'b', 'c']) {
      await request(app).post(`/conversations/${conversationId}/messages`).set('Cookie', cookie).send({ body })
    }

    // Get last 2 messages (b, c)
    const firstPage = await request(app)
      .get(`/conversations/${conversationId}/messages?limit=2`)
      .set('Cookie', cookie)

    expect(firstPage.body.hasMore).toBe(true)
    const oldest = firstPage.body.messages[0]

    // Fetch the page before the oldest (should return just 'a')
    const secondPage = await request(app)
      .get(`/conversations/${conversationId}/messages?limit=2&before=${oldest.id}`)
      .set('Cookie', cookie)

    expect(secondPage.status).toBe(200)
    expect(secondPage.body.messages).toHaveLength(1)
    expect(secondPage.body.messages[0].body).toBe('a')
    expect(secondPage.body.hasMore).toBe(false)
  }, 15000)

  it('returns 400 for an invalid before cursor', async () => {
    const alice = await loginAs('alice@example.com')
    const convos = await request(app).get('/conversations').set('Cookie', alice.cookie)
    const conversationId = convos.body[0].id

    const res = await request(app)
      .get(`/conversations/${conversationId}/messages?before=nonexistent-msg-id`)
      .set('Cookie', alice.cookie)

    expect(res.status).toBe(400)
  })
})
