import { randomUUID } from 'crypto'
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './dynamo.js'

export interface Message {
  conversationId: string
  id: string
  senderId: string
  body: string
  createdAt: string
}

export type MessageWithCursor = Message & { cursor: string }

type MessageItem = Message & { sortKey: string }

function toSortKey(message: Message): string {
  return `${message.createdAt}#${message.id}`
}

function fromItem({ sortKey, ...message }: MessageItem): MessageWithCursor {
  return { ...message, cursor: sortKey }
}

// sortKey is `${createdAt}#${id}` — ISO-8601 timestamps sort correctly as
// plain strings, so this keeps a conversation's messages in order without
// needing a separate index.
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
      Item: { ...message, sortKey: toSortKey(message) },
    }),
  )

  return message
}

export async function getLatestMessage(conversationId: string): Promise<Message | null> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TableNames.messages,
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: { ':conversationId': conversationId },
      ScanIndexForward: false,
      Limit: 1,
    }),
  )
  const item = result.Items?.[0] as MessageItem | undefined
  if (!item) return null
  const { cursor: _cursor, ...message } = fromItem(item)
  return message
}

// The original project's cursor was a bare message id, looked up via a
// direct primary-key read (Prisma's `id` was its own top-level key). This
// table's key is (conversationId, sortKey), so a bare id isn't queryable on
// its own — the cursor here is the message's own sortKey instead, which the
// client gets back on every message and echoes as `before` for the next
// page. One fewer round trip than the original design, at the cost of a
// slightly different (still opaque) cursor value.
export async function listMessages(
  conversationId: string,
  limit: number,
  beforeCursor?: string,
): Promise<{ messages: MessageWithCursor[]; hasMore: boolean }> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TableNames.messages,
      KeyConditionExpression: beforeCursor
        ? 'conversationId = :conversationId AND sortKey < :before'
        : 'conversationId = :conversationId',
      ExpressionAttributeValues: {
        ':conversationId': conversationId,
        ...(beforeCursor ? { ':before': beforeCursor } : {}),
      },
      ScanIndexForward: false,
      Limit: limit + 1,
    }),
  )

  const items = (result.Items ?? []) as MessageItem[]
  const hasMore = items.length > limit
  const messages = items.slice(0, limit).reverse().map(fromItem)
  return { messages, hasMore }
}
