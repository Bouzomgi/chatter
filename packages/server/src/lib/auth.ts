import jwt, { type SignOptions } from 'jsonwebtoken'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

export interface AuthPayload {
  userId: string
}

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60

export function issueToken(userId: string, expiresIn: SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign({ userId } satisfies AuthPayload, process.env.JWT_SECRET!, { expiresIn })
}

// Mirrors the original project's COOKIE_OPTS, expressed as a Set-Cookie
// string — HTTP API's `cookies` response field takes one string per cookie.
export function tokenCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `token=${token}; HttpOnly; SameSite=Strict; Max-Age=${SEVEN_DAYS_SECONDS}; Path=/${secure}`
}

export function clearTokenCookie(): string {
  return 'token=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/'
}

function extractToken(cookies: string[] | undefined): string | null {
  if (!cookies) return null
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=')
    if (key === 'token') return value ?? null
  }
  return null
}

export function verifyToken(token: string | undefined | null): AuthPayload | null {
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
  } catch {
    return null
  }
}

// Stands in for the original project's requireAuth middleware. There's no
// middleware chain in a Lambda handler, so each authenticated handler calls
// this directly and returns 401 itself if it comes back null.
export function verifyRequest(event: APIGatewayProxyEventV2): AuthPayload | null {
  return verifyToken(extractToken(event.cookies))
}
