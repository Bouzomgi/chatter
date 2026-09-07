import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})

// marshallOptions strips undefined attributes instead of throwing, which
// keeps handlers from having to scrub optional fields before every put.
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

export const TableNames = {
  users: process.env.USERS_TABLE!,
  usersByEmail: process.env.USERS_BY_EMAIL_TABLE!,
  usersByUsername: process.env.USERS_BY_USERNAME_TABLE!,
  participants: process.env.PARTICIPANTS_TABLE!,
  messages: process.env.MESSAGES_TABLE!,
  connections: process.env.CONNECTIONS_TABLE!,
  connectionUsers: process.env.CONNECTION_USERS_TABLE!,
  conversations: process.env.CONVERSATIONS_TABLE!,
  conversationsByKey: process.env.CONVERSATIONS_BY_KEY_TABLE!,
}

export const IndexNames = {
  // GSI on ParticipantsTable: partitionKey userId, sortKey conversationId.
  // The table's own key (conversationId, userId) answers "who's in this
  // conversation"; this index answers the reverse — "what conversations is
  // this user in" — which is what $connect needs to rejoin rooms.
  participantsByUser: 'ByUserIndex',
}
