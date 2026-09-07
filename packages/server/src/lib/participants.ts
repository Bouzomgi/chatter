import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, IndexNames, TableNames } from './dynamo.js'

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
