import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, IndexNames, TableNames } from './dynamo.js'

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
