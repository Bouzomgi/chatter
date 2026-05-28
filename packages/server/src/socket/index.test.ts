import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
import authRouter from '../routes/auth.js'
import { createConversationsRouter } from '../routes/conversations.js'
import { registerSocketHandlers } from './index.js'

process.env.JWT_SECRET = 'test-secret'

let httpServer: http.Server
let serverUrl: string
let io: Server

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use('/auth', authRouter)

beforeAll(
  () =>
    new Promise<void>(resolve => {
      httpServer = http.createServer(app)
      io = new Server(httpServer)
      app.use('/conversations', createConversationsRouter(io))
      registerSocketHandlers(io)
      httpServer.listen(0, () => {
        const addr = httpServer.address() as { port: number }
        serverUrl = `http://localhost:${addr.port}`
        resolve()
      })
    }),
)

afterAll(
  () =>
    new Promise<void>(resolve => {
      io.close(() => httpServer.close(() => resolve()))
    }),
)

async function loginAs(email: string) {
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'password123' })
  return {
    cookie: res.headers['set-cookie'][0] as string,
    user: res.body as { id: string; username: string; email: string },
  }
}

function connectWithCookie(cookie: string): ClientSocket {
  return ioc(serverUrl, {
    extraHeaders: { cookie },
    autoConnect: false,
  })
}

function waitFor<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), 3000)
    socket.once(event, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

describe('Socket.io auth', () => {
  it('rejects connection with no token', () =>
    new Promise<void>((resolve, reject) => {
      const socket = ioc(serverUrl, { autoConnect: false })
      socket.on('connect_error', err => {
        expect(err.message).toBe('Unauthorized')
        socket.disconnect()
        resolve()
      })
      socket.on('connect', () => {
        socket.disconnect()
        reject(new Error('Should not have connected'))
      })
      socket.connect()
    }))

  it('rejects connection with a bad token', () =>
    new Promise<void>((resolve, reject) => {
      const socket = ioc(serverUrl, {
        extraHeaders: { cookie: 'token=bad.token.here' },
        autoConnect: false,
      })
      socket.on('connect_error', err => {
        expect(err.message).toBe('Unauthorized')
        socket.disconnect()
        resolve()
      })
      socket.on('connect', () => {
        socket.disconnect()
        reject(new Error('Should not have connected'))
      })
      socket.connect()
    }))

  it('connects successfully with a valid token', () =>
    new Promise<void>((resolve, reject) => {
      loginAs('alice@example.com').then(alice => {
        const socket = connectWithCookie(alice.cookie)
        socket.on('connect', () => {
          socket.disconnect()
          resolve()
        })
        socket.on('connect_error', reject)
        socket.connect()
      })
    }))
})

describe('Socket.io reconnect', () => {
  it('re-joins conversation rooms after reconnect so messages created during gap are received', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    // Alice connects before the conversation exists
    const aliceSocket = connectWithCookie(alice.cookie)
    await new Promise<void>((resolve, reject) => {
      aliceSocket.on('connect', resolve)
      aliceSocket.on('connect_error', reject)
      aliceSocket.connect()
    })

    // Bob creates a conversation with Alice (after Alice connected — she won't be in the room yet)
    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', bob.cookie)
      .send({ targetUserId: alice.user.id })
    const conversationId = convoRes.body.id

    // Alice disconnects and reconnects — server should re-join her to all rooms including the new one
    await new Promise<void>(resolve => {
      aliceSocket.once('disconnect', () => resolve())
      aliceSocket.disconnect()
    })
    await new Promise<void>((resolve, reject) => {
      aliceSocket.once('connect', resolve)
      aliceSocket.once('connect_error', reject)
      aliceSocket.connect()
    })

    const messagePromise = waitFor<Record<string, unknown>>(aliceSocket, 'message:new')

    await request(app)
      .post(`/conversations/${conversationId}/messages`)
      .set('Cookie', bob.cookie)
      .send({ body: 'Did you get this after reconnect?' })

    const received = await messagePromise
    expect(received).toMatchObject({
      conversationId,
      body: 'Did you get this after reconnect?',
    })

    aliceSocket.disconnect()
  })
})

describe('Socket.io presence', () => {
  it('emits user:online to conversation partners when a user connects', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })

    const aliceSocket = connectWithCookie(alice.cookie)
    await new Promise<void>((resolve, reject) => {
      aliceSocket.on('connect', resolve)
      aliceSocket.on('connect_error', reject)
      aliceSocket.connect()
    })

    const bobSocket = connectWithCookie(bob.cookie)
    const onlinePromise = waitFor<{ userId: string }>(aliceSocket, 'user:online')

    await new Promise<void>((resolve, reject) => {
      bobSocket.on('connect', resolve)
      bobSocket.on('connect_error', reject)
      bobSocket.connect()
    })

    const { userId } = await onlinePromise
    expect(userId).toBe(bob.user.id)

    aliceSocket.disconnect()
    bobSocket.disconnect()
  })

  it('emits user:offline to conversation partners when a user disconnects', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })

    const aliceSocket = connectWithCookie(alice.cookie)
    const bobSocket = connectWithCookie(bob.cookie)

    await Promise.all([
      new Promise<void>((resolve, reject) => { aliceSocket.on('connect', resolve); aliceSocket.on('connect_error', reject); aliceSocket.connect() }),
      new Promise<void>((resolve, reject) => { bobSocket.on('connect', resolve); bobSocket.on('connect_error', reject); bobSocket.connect() }),
    ])

    const offlinePromise = waitFor<{ userId: string }>(aliceSocket, 'user:offline')
    bobSocket.disconnect()

    const { userId } = await offlinePromise
    expect(userId).toBe(bob.user.id)

    aliceSocket.disconnect()
  })

  it('emits presence:init with already-online partners when connecting', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })

    const aliceSocket = connectWithCookie(alice.cookie)
    await new Promise<void>((resolve, reject) => {
      aliceSocket.on('connect', resolve)
      aliceSocket.on('connect_error', reject)
      aliceSocket.connect()
    })

    const bobSocket = connectWithCookie(bob.cookie)
    const initPromise = waitFor<{ onlineUserIds: string[] }>(bobSocket, 'presence:init')

    bobSocket.connect()

    const { onlineUserIds } = await initPromise
    expect(onlineUserIds).toContain(alice.user.id)

    aliceSocket.disconnect()
    bobSocket.disconnect()
  })

  it('does not emit presence events to non-conversation-partners', async () => {
    // bob and carol share no seeded conversation, so carol should not receive bob's presence
    const bob = await loginAs('bob@example.com')
    const carol = await loginAs('carol@example.com')

    const carolSocket = connectWithCookie(carol.cookie)
    await new Promise<void>((resolve, reject) => {
      carolSocket.on('connect', resolve)
      carolSocket.on('connect_error', reject)
      carolSocket.connect()
    })

    let carolReceivedOnline = false
    carolSocket.on('user:online', ({ userId }: { userId: string }) => {
      if (userId === bob.user.id) carolReceivedOnline = true
    })

    const bobSocket = connectWithCookie(bob.cookie)
    await new Promise<void>((resolve, reject) => {
      bobSocket.on('connect', resolve)
      bobSocket.on('connect_error', reject)
      bobSocket.connect()
    })

    await new Promise(r => setTimeout(r, 200))
    expect(carolReceivedOnline).toBe(false)

    bobSocket.disconnect()
    carolSocket.disconnect()
  })
})

describe('Socket.io message:new delivery', () => {
  it('delivers message:new to connected participant after REST POST', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')

    // Get alice-bob conversation id
    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })
    const conversationId = convoRes.body.id

    // Bob connects and waits for message:new
    const bobSocket = connectWithCookie(bob.cookie)
    await new Promise<void>((resolve, reject) => {
      bobSocket.on('connect', resolve)
      bobSocket.on('connect_error', reject)
      bobSocket.connect()
    })

    const messagePromise = waitFor<Record<string, unknown>>(bobSocket, 'message:new')

    // Alice sends a message via REST
    const msgRes = await request(app)
      .post(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ body: 'Hey Bob via socket!' })

    expect(msgRes.status).toBe(201)

    const received = await messagePromise
    expect(received).toMatchObject({
      conversationId,
      senderId: alice.user.id,
      body: 'Hey Bob via socket!',
    })

    bobSocket.disconnect()
  })

  it('does not deliver message:new to a non-participant', async () => {
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs('bob@example.com')
    const carol = await loginAs('carol@example.com')

    // alice-bob conversation
    const convoRes = await request(app)
      .post('/conversations')
      .set('Cookie', alice.cookie)
      .send({ targetUserId: bob.user.id })
    const conversationId = convoRes.body.id

    // Carol connects — she is not in alice-bob
    const carolSocket = connectWithCookie(carol.cookie)
    await new Promise<void>((resolve, reject) => {
      carolSocket.on('connect', resolve)
      carolSocket.on('connect_error', reject)
      carolSocket.connect()
    })

    let carolReceived = false
    carolSocket.on('message:new', () => {
      carolReceived = true
    })

    await request(app)
      .post(`/conversations/${conversationId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ body: 'Private message' })

    // Wait briefly to confirm carol did not receive it
    await new Promise(r => setTimeout(r, 200))
    expect(carolReceived).toBe(false)

    carolSocket.disconnect()
  })
})
