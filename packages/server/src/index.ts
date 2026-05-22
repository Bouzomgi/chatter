import express from 'express'
import cookieParser from 'cookie-parser'
import authRouter from './routes/auth.js'
import conversationsRouter from './routes/conversations.js'

const app = express()
const port = process.env.PORT ?? 3000

app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRouter)
app.use('/conversations', conversationsRouter)

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
