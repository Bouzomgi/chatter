import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { BatchGetCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { issueToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './createConversation.js'

const ddbMock = mockClient(ddb)
const token = issueToken('user-1')

beforeEach(() => {
  ddbMock.reset()
})

describe('createConversation handler', () => {
  it('returns 401 with no session', async () => {
    const result = await handler(fakeEvent(), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('rejects starting a conversation with yourself', async () => {
    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], body: { participantIds: ['user-1'] } }),
      {} as never,
      () => undefined,
    )
    expect(result).toMatchObject({ statusCode: 400 })
  })

  it('returns 404 when a target user does not exist', async () => {
    ddbMock.on(BatchGetCommand).resolves({ Responses: { UsersTableTest: [] } })

    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], body: { participantIds: ['ghost'] } }),
      {} as never,
      () => undefined,
    )
    expect(result).toMatchObject({ statusCode: 404 })
  })

  it('creates a new conversation', async () => {
    ddbMock
      .on(BatchGetCommand)
      .resolves({ Responses: { UsersTableTest: [{ userId: 'user-2', username: 'bob', avatarIndex: 1 }] } })
    ddbMock.on(TransactWriteCommand).resolves({})

    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], body: { participantIds: ['user-2'] } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 201 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body.participants).toEqual([{ id: 'user-2', username: 'bob', avatarIndex: 1 }])
  })

  it('returns the existing conversation for a repeat participant set', async () => {
    ddbMock
      .on(BatchGetCommand)
      .resolves({ Responses: { UsersTableTest: [{ userId: 'user-2', username: 'bob', avatarIndex: 1 }] } })
    ddbMock.on(TransactWriteCommand).rejects(
      new TransactionCanceledException({
        message: 'cancelled',
        $metadata: {},
        CancellationReasons: [{ Code: 'ConditionalCheckFailed' }],
      }),
    )
    ddbMock
      .on(GetCommand, { TableName: 'ConversationsByKeyTableTest' })
      .resolves({ Item: { conversationId: 'convo-1' } })
    ddbMock
      .on(GetCommand, { TableName: 'ConversationsTableTest' })
      .resolves({ Item: { conversationId: 'convo-1', createdAt: '2026-01-01T00:00:00.000Z' } })

    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], body: { participantIds: ['user-2'] } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body.id).toBe('convo-1')
  })
})
