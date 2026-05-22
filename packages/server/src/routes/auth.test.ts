import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import authRouter from './auth.js'
import prisma from '../lib/prisma.js'

process.env.JWT_SECRET = 'test-secret'

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use('/auth', authRouter)

beforeEach(async () => {
  await prisma.message.deleteMany()
  await prisma.participant.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.user.deleteMany()
})

describe('POST /auth/register', () => {
  it('creates a user and sets a cookie', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ username: 'alice', email: 'alice@example.com' })
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' })

    const res = await request(app)
      .post('/auth/register')
      .send({ username: 'alice', email: 'other@example.com', password: 'password123' })

    expect(res.status).toBe(409)
  })

  it('rejects missing fields', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'alice' })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' })
  })

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ username: 'alice' })
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong' })

    expect(res.status).toBe(401)
  })

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' })

    expect(res.status).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('clears the cookie', async () => {
    const res = await request(app).post('/auth/logout')
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=;/)
  })
})

describe('GET /auth/me', () => {
  it('returns the current user when authenticated', async () => {
    const registerRes = await request(app)
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' })

    const cookie = registerRes.headers['set-cookie'][0]

    const res = await request(app).get('/auth/me').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ username: 'alice' })
  })

  it('returns 401 with no cookie', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })
})
