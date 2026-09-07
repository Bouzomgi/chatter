import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, IndexNames, TableNames } from './dynamo.js'

export interface Participant {
  conversationId: string
  userId: string
  seen: boolean
}

// Guards sendMessage against a user posting into a conversation they were
// never added to — checked against the table's own key, no index needed.
export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const result = await ddb.send(
    new GetCommand({ TableName: TableNames.participants, Key: { conversationId, userId } }),
  )
  return result.Item !== undefined
}

// Which conversations is this user in — the reverse of the table's own key
// (conversationId, userId), so it queries the ByUserIndex GSI instead of
// the base table. This is the DynamoDB equivalent of the original project's
// `prisma.participant.findMany({ where: { userId } })`.
export async function getConversationIdsForUser(userId: string): Promise<string[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TableNames.participants,
      IndexName: IndexNames.participantsByUser,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ProjectionExpression: 'conversationId',
    }),
  )
  return (result.Items ?? []).map((item) => item.conversationId as string)
}

export async function getParticipantsForConversation(conversationId: string): Promise<Participant[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TableNames.participants,
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: { ':conversationId': conversationId },
    }),
  )
  return (result.Items ?? []) as Participant[]
}

// Mirrors the original project's `participant.updateMany({ seen: false })` —
// called after a message is sent so everyone but the sender sees an unread
// indicator. No batch-update primitive for this in DynamoDB, so it's one
// UpdateItem per other participant.
export async function markUnreadForOthers(conversationId: string, exceptUserId: string): Promise<void> {
  const participants = await getParticipantsForConversation(conversationId)
  await Promise.all(
    participants
      .filter((p) => p.userId !== exceptUserId)
      .map((p) =>
        ddb.send(
          new UpdateCommand({
            TableName: TableNames.participants,
            Key: { conversationId, userId: p.userId },
            UpdateExpression: 'SET seen = :seen',
            ExpressionAttributeValues: { ':seen': false },
          }),
        ),
      ),
  )
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TableNames.participants,
      Key: { conversationId, userId },
      UpdateExpression: 'SET seen = :seen',
      ExpressionAttributeValues: { ':seen': true },
    }),
  )
}
