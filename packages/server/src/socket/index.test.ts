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
