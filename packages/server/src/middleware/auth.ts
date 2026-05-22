import { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthPayload {
  userId: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.token as string | undefined
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
