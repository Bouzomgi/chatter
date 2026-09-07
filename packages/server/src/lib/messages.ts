import { randomUUID } from 'crypto'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './dynamo.js'

export interface Message {
  conversationId: string
  id: string
  senderId: string
  body: string
  createdAt: string
}

// sortKey is `${createdAt}#${id}` — ISO-8601 timestamps sort correctly as
// plain strings, so this keeps a conversation's messages in order without
// needing a separate index, and is the same shape the cursor-pagination
// design doc assumed for a future getMessages route.
export async function createMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  const message: Message = {
    conversationId,
    id: randomUUID(),
    senderId,
    body,
    createdAt: new Date().toISOString(),
  }

  await ddb.send(
    new PutCommand({
      TableName: TableNames.messages,
      Item: { ...message, sortKey: `${message.createdAt}#${message.id}` },
    }),
  )

  return message
}
