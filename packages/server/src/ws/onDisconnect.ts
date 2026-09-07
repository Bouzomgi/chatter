import type { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda'
import { forgetConnectionUser, getConnectionUser, leaveConversation } from '../lib/connections.js'
import { getConversationIdsForUser } from '../lib/participants.js'

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId

  const userId = await getConnectionUser(connectionId)
  if (!userId) {
    // Nothing recorded for this connection (e.g. $connect rejected it before
    // writing anything) — disconnect is still a success from API Gateway's
    // point of view.
    return { statusCode: 200, body: 'Disconnected' }
  }

  const conversationIds = await getConversationIdsForUser(userId)

  await Promise.all([
    forgetConnectionUser(connectionId),
    ...conversationIds.map((conversationId) => leaveConversation(conversationId, connectionId)),
  ])

  return { statusCode: 200, body: 'Disconnected' }
}
