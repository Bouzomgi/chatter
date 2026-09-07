import { json } from '../../lib/http.js'
import { isParticipant, markRead } from '../../lib/participants.js'
import { withAuth } from '../../lib/withAuth.js'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

function conversationIdFrom(event: APIGatewayProxyEventV2): string | undefined {
  return event.pathParameters?.id
}

export const handler = withAuth(async (event, auth) => {
  const conversationId = conversationIdFrom(event)
  if (!conversationId) {
    return json(400, { error: 'conversation id is required' })
  }

  if (!(await isParticipant(conversationId, auth.userId))) {
    return json(403, { error: 'Forbidden' })
  }

  await markRead(conversationId, auth.userId)
  return { statusCode: 204 }
})
