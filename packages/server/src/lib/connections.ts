import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './dynamo.js'

// ConnectionsTable (conversationId, connectionId) is Socket.io's room
// membership made durable — "who's currently listening to this
// conversation." $connect populates it, $disconnect clears it, and the
// sendMessage Lambda (step 4) queries it to fan out.
export async function joinConversation(conversationId: string, connectionId: string): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TableNames.connections,
      Item: { conversationId, connectionId },
    }),
  )
}

export async function leaveConversation(conversationId: string, connectionId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TableNames.connections,
      Key: { conversationId, connectionId },
    }),
  )
}

// ConnectionUsersTable (connectionId -> userId) has no Socket.io equivalent —
// it exists because $disconnect only gets a connectionId, and there's
// nothing else that maps a bare connectionId back to the user it belongs to.
export async function rememberConnectionUser(connectionId: string, userId: string): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TableNames.connectionUsers,
      Item: { connectionId, userId, connectedAt: new Date().toISOString() },
    }),
  )
}

export async function getConnectionUser(connectionId: string): Promise<string | null> {
  const result = await ddb.send(
    new GetCommand({ TableName: TableNames.connectionUsers, Key: { connectionId } }),
  )
  return (result.Item?.userId as string | undefined) ?? null
}

export async function forgetConnectionUser(connectionId: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TableNames.connectionUsers, Key: { connectionId } }))
}
