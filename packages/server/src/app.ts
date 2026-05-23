import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import express, { Express } from 'express'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import authRouter from './routes/auth.js'
import { createConversationsRouter } from './routes/conversations.js'
import usersRouter from './routes/users.js'
import { registerSocketHandlers } from './socket/index.js'

export function createApp(): { app: Express; httpServer: http.Server; io: Server } {
  const app = express()

  app.use(express.json())
  app.use(cookieParser())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  if (process.env.DEPLOY_SECRET) {
    app.use((req, res, next) => {
      if (req.headers['x-deploy-secret'] !== process.env.DEPLOY_SECRET) {
        res.sendStatus(403)
        return
      }
      next()
    })
  }

  app.use('/auth', authRouter)

  const httpServer = http.createServer(app)
  const io = new Server(httpServer)

  app.use('/conversations', createConversationsRouter(io))
  app.use('/users', usersRouter)

  registerSocketHandlers(io)

  if (process.env.NODE_ENV === 'production') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const clientDist = path.resolve(__dirname, '../../client/dist')
    app.use(express.static(clientDist))
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
  }

  return { app, httpServer, io }
}
