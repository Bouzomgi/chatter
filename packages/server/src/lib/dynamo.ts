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
}
