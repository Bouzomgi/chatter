import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { issueToken, tokenCookie } from '../../lib/auth.js'
import { json, parseJsonBody } from '../../lib/http.js'
import { getUserByEmail, toPublicUser } from '../../lib/users.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const parsed = loginSchema.safeParse(parseJsonBody(event.body))
  if (!parsed.success) {
    return json(400, { error: 'all fields required' })
  }
  const { email, password } = parsed.data

  const user = await getUserByEmail(email)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return json(401, { error: 'Invalid credentials' })
  }

  return json(200, toPublicUser(user), [tokenCookie(issueToken(user.userId))])
}
