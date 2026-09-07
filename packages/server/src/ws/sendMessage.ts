import { z } from 'zod'
import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import type { APIGatewayProxyWebsocketEventV2, APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda'
import { forgetConnectionUser, getConnectionIdsForConversation, getConnectionUser, leaveConversation } from '../lib/connections.js'
import { createMessage } from '../lib/messages.js'
import { isParticipant, markUnreadForOthers } from '../lib/participants.js'

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  body: z
    .string()
    .min(1)
    .max(4000)
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: 'body is required' }),
})

// API Gateway only tells a Lambda which stage/domain it's running behind at
// invocation time, so the management client (the thing postToConnection
// lives on) has to be built per-request rather than once at module load.
function managementClientFor(event: APIGatewayProxyWebsocketEventV2) {
  const { domainName, stage } = event.requestContext
  return new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` })
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId

  const senderId = await getConnectionUser(connectionId)
  if (!senderId) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const parsed = sendMessageSchema.safeParse(JSON.parse(event.body ?? '{}'))
  if (!parsed.success) {
    return { statusCode: 400, body: 'invalid message' }
  }
  const { conversationId, body } = parsed.data

  if (!(await isParticipant(conversationId, senderId))) {
    return { statusCode: 403, body: 'not a participant' }
  }

  const message = await createMessage(conversationId, senderId, body)
  await Promise.all([
    markUnreadForOthers(conversationId, senderId),
    broadcast(managementClientFor(event), conversationId, connectionId, message),
  ])

  return { statusCode: 200, body: 'sent' }
}

// The serverless stand-in for `io.to(conversationId).emit()` — Socket.io's
// room broadcast is one call; here it's a query for who's listening plus a
// postToConnection loop. A connection that's gone stale (closed without a
// clean $disconnect) gets cleaned out of both tables when it 410s.
//
// senderConnectionId is always included even if Connections has no entry for
// it yet — true right after creating a brand-new conversation, since $connect
// only joins conversations that existed when the socket opened. Without this,
// the sender would send a message into a conversation their own connection
// was never told about, and get nothing back.
async function broadcast(
  client: ApiGatewayManagementApiClient,
  conversationId: string,
  senderConnectionId: string,
  payload: unknown,
): Promise<void> {
  const listenerIds = await getConnectionIdsForConversation(conversationId)
  const connectionIds = [...new Set([...listenerIds, senderConnectionId])]
  const data = Buffer.from(JSON.stringify({ type: 'message:new', message: payload }))

  await Promise.all(
    connectionIds.map(async (connectionId) => {
      try {
        await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }))
      } catch (err) {
        if (err instanceof GoneException) {
          await Promise.all([leaveConversation(conversationId, connectionId), forgetConnectionUser(connectionId)])
          return
        }
        throw err
      }
    }),
  )
}
