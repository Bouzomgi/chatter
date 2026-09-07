import type { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda'
import { verifyToken } from '../lib/auth.js'
import { joinConversation, rememberConnectionUser } from '../lib/connections.js'
import { getConversationIdsForUser } from '../lib/participants.js'

// Browsers can't set custom headers on a WebSocket handshake, so the JWT
// travels as a query param instead of the httpOnly cookie the REST routes
// use: wss://.../?token=<jwt>.
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const auth = verifyToken(event.queryStringParameters?.token)
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const connectionId = event.requestContext.connectionId
  const conversationIds = await getConversationIdsForUser(auth.userId)

  await Promise.all([
    rememberConnectionUser(connectionId, auth.userId),
    ...conversationIds.map((conversationId) => joinConversation(conversationId, connectionId)),
  ])

  return { statusCode: 200, body: 'Connected' }
}
