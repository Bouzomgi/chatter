import { z } from 'zod'
import { getConversationById } from '../../lib/conversations.js'
import { json } from '../../lib/http.js'
import { listMessages } from '../../lib/messages.js'
import { isParticipant } from '../../lib/participants.js'
import { withAuth } from '../../lib/withAuth.js'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'

const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
})

function conversationIdFrom(event: APIGatewayProxyEventV2): string | undefined {
  return event.pathParameters?.id
}

export const handler = withAuth(async (event, auth) => {
  const conversationId = conversationIdFrom(event)
  if (!conversationId) {
    return json(400, { error: 'conversation id is required' })
  }

  const conversation = await getConversationById(conversationId)
  if (!conversation) {
    return json(404, { error: 'Conversation not found' })
  }

  if (!(await isParticipant(conversationId, auth.userId))) {
    return json(403, { error: 'Forbidden' })
  }

  const parsed = messagesQuerySchema.safeParse(event.queryStringParameters ?? {})
  if (!parsed.success) {
    return json(400, { error: 'invalid query parameters' })
  }
  const { limit, before } = parsed.data

  const { messages, hasMore } = await listMessages(conversationId, limit, before)
  return json(200, { messages, hasMore })
})
