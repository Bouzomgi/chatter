import { randomUUID } from 'crypto'
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { BatchGetCommand, GetCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
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

export async function getUsersByIds(userIds: string[]): Promise<User[]> {
  if (userIds.length === 0) return []
  const result = await ddb.send(
    new BatchGetCommand({
      RequestItems: { [TableNames.users]: { Keys: userIds.map((userId) => ({ userId })) } },
    }),
  )
  return (result.Responses?.[TableNames.users] as User[] | undefined) ?? []
}

// No index makes "every user but me" cheap in DynamoDB the way it was with a
// single indexed SQL query — this is a full table scan. Fine at this app's
// scale (a personal contact list); would need a different design well before
// it wasn't.
export async function listUsersExcept(userId: string): Promise<PublicUser[]> {
  const result = await ddb.send(new ScanCommand({ TableName: TableNames.users }))
  const users = ((result.Items as User[] | undefined) ?? [])
    .filter((user) => user.userId !== userId)
    .map(toPublicUser)
  users.sort((a, b) => a.username.localeCompare(b.username))
  return users
}

export async function updateAvatarIndex(userId: string, avatarIndex: number): Promise<User> {
  const result = await ddb.send(
    new UpdateCommand({
      TableName: TableNames.users,
      Key: { userId },
      UpdateExpression: 'SET avatarIndex = :avatarIndex',
      ExpressionAttributeValues: { ':avatarIndex': avatarIndex },
      ReturnValues: 'ALL_NEW',
    }),
  )
  return result.Attributes as User
}
