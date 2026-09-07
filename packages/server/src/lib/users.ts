import { randomUUID } from 'crypto'
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './dynamo.js'

export interface User {
  userId: string
  username: string
  email: string
  passwordHash: string
  avatarIndex: number
  createdAt: string
}

export type PublicUser = Omit<User, 'passwordHash'>

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user
  return publicUser
}

export class UsernameOrEmailTakenError extends Error {}

// Users are stored three ways: the canonical record (keyed by userId), and
// two reverse-lookup tables (keyed by email / username) that exist purely to
// give DynamoDB something to enforce uniqueness against — it has no native
// unique-constraint concept outside of primary keys. The transaction fails
// atomically if either the email or username is already taken.
export async function createUser(input: {
  username: string
  email: string
  passwordHash: string
  avatarIndex: number
}): Promise<User> {
  const user: User = {
    userId: randomUUID(),
    username: input.username,
    email: input.email,
    passwordHash: input.passwordHash,
    avatarIndex: input.avatarIndex,
    createdAt: new Date().toISOString(),
  }

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TableNames.usersByEmail,
              Item: { email: user.email, userId: user.userId },
              ConditionExpression: 'attribute_not_exists(email)',
            },
          },
          {
            Put: {
              TableName: TableNames.usersByUsername,
              Item: { username: user.username, userId: user.userId },
              ConditionExpression: 'attribute_not_exists(username)',
            },
          },
          {
            Put: {
              TableName: TableNames.users,
              Item: user,
            },
          },
        ],
      }),
    )
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      throw new UsernameOrEmailTakenError('username or email taken')
    }
    throw err
  }

  return user
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await ddb.send(new GetCommand({ TableName: TableNames.users, Key: { userId } }))
  return (result.Item as User | undefined) ?? null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const lookup = await ddb.send(new GetCommand({ TableName: TableNames.usersByEmail, Key: { email } }))
  const userId = (lookup.Item as { userId: string } | undefined)?.userId
  if (!userId) return null
  return getUserById(userId)
}
