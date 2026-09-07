import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { verifyRequest } from '../../lib/auth.js'
import { json } from '../../lib/http.js'
import { getUserById, toPublicUser } from '../../lib/users.js'

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const auth = verifyRequest(event)
  if (!auth) {
    return json(401, { error: 'Unauthorized' })
  }

  const user = await getUserById(auth.userId)
  if (!user) {
    return json(401, { error: 'Unauthorized' })
  }

  return json(200, toPublicUser(user))
}
