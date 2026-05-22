import http from 'http'
import express from 'express'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import authRouter from './routes/auth.js'
import { createConversationsRouter } from './routes/conversations.js'
import { registerSocketHandlers } from './socket/index.js'

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(cookieParser())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/auth', authRouter)

  const httpServer = http.createServer(app)
  const io = new Server(httpServer)

  app.use('/conversations', createConversationsRouter(io))

  registerSocketHandlers(io)

  return { app, httpServer, io }
}
