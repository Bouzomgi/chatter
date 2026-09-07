import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { issueToken, tokenCookie } from '../../lib/auth.js'
import { json, parseJsonBody } from '../../lib/http.js'
import { createUser, toPublicUser, UsernameOrEmailTakenError } from '../../lib/users.js'

const registerSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
})

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const parsed = registerSchema.safeParse(parseJsonBody(event.body))
  if (!parsed.success) {
    return json(400, { error: 'all fields required' })
  }
  const { username, email, password } = parsed.data

  const passwordHash = await bcrypt.hash(password, 12)
  const avatarIndex = Math.floor(Math.random() * 9)

  try {
    const user = await createUser({ username, email, passwordHash, avatarIndex })
    return json(201, toPublicUser(user), [tokenCookie(issueToken(user.userId))])
  } catch (err) {
    if (err instanceof UsernameOrEmailTakenError) {
      return json(409, { error: 'username or email taken' })
    }
    throw err
  }
}
