import { randomUUID } from 'crypto'
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './dynamo.js'

export interface Conversation {
  conversationId: string
  createdAt: string
}

// Sorting the full participant set into a stable string gives DynamoDB
// something to key a uniqueness check against — the same "reverse lookup
// table" trick used for email/username uniqueness in src/lib/users.ts. The
// original project found an existing conversation with a relational query
// over the exact participant set; this is the DynamoDB equivalent of that.
function participantSetKey(participantIds: string[]): string {
  return [...participantIds].sort().join('#')
}

// Finds a conversation with this exact participant set, or creates one.
// Returns the conversation and whether it was newly created (the original
// route returned 201 for new, 200 for existing).
export async function findOrCreateConversation(
  participantIds: string[],
): Promise<{ conversation: Conversation; isNew: boolean }> {
  const key = participantSetKey(participantIds)
  const newConversation: Conversation = { conversationId: randomUUID(), createdAt: new Date().toISOString() }

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TableNames.conversationsByKey,
              Item: { participantSetKey: key, conversationId: newConversation.conversationId },
              ConditionExpression: 'attribute_not_exists(participantSetKey)',
            },
          },
          {
            Put: {
              TableName: TableNames.conversations,
              Item: newConversation,
            },
          },
          ...participantIds.map((userId) => ({
            Put: {
              TableName: TableNames.participants,
              Item: { conversationId: newConversation.conversationId, userId, seen: true },
            },
          })),
        ],
      }),
    )
    return { conversation: newConversation, isNew: true }
  } catch (err) {
    if (!(err instanceof TransactionCanceledException)) throw err
  }

  // Someone (possibly this same request racing another) already created a
  // conversation with this exact participant set — look it up instead.
  const lookup = await ddb.send(
    new GetCommand({ TableName: TableNames.conversationsByKey, Key: { participantSetKey: key } }),
  )
  const conversationId = (lookup.Item as { conversationId: string } | undefined)?.conversationId
  if (!conversationId) {
    // The transaction failed for some other reason (e.g. a participant Put
    // collided) — surface it rather than pretending we found a conversation.
    throw new Error('failed to create or locate conversation')
  }

  const existing = await getConversationById(conversationId)
  if (!existing) throw new Error('conversation record missing after lookup')
  return { conversation: existing, isNew: false }
}

export async function getConversationById(conversationId: string): Promise<Conversation | null> {
  const result = await ddb.send(new GetCommand({ TableName: TableNames.conversations, Key: { conversationId } }))
  return (result.Item as Conversation | undefined) ?? null
}
