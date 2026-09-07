import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { issueToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './getMessages.js'

const ddbMock = mockClient(ddb)
const token = issueToken('user-1')

beforeEach(() => {
  ddbMock.reset()
})

describe('getMessages handler', () => {
  it('returns 401 with no session', async () => {
    const result = await handler(fakeEvent({ pathParameters: { id: 'convo-1' } }), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('returns 404 when the conversation does not exist', async () => {
    ddbMock.on(GetCommand, { TableName: 'ConversationsTableTest' }).resolves({})

    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], pathParameters: { id: 'convo-1' } }),
      {} as never,
      () => undefined,
    )
    expect(result).toMatchObject({ statusCode: 404 })
  })

  it('returns 403 when the caller is not a participant', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'ConversationsTableTest' })
      .resolves({ Item: { conversationId: 'convo-1', createdAt: '2026-01-01T00:00:00.000Z' } })
    ddbMock.on(GetCommand, { TableName: 'ParticipantsTableTest' }).resolves({})

    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], pathParameters: { id: 'convo-1' } }),
      {} as never,
      () => undefined,
    )
    expect(result).toMatchObject({ statusCode: 403 })
  })

  it('returns a page of messages with a cursor', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'ConversationsTableTest' })
      .resolves({ Item: { conversationId: 'convo-1', createdAt: '2026-01-01T00:00:00.000Z' } })
    ddbMock
      .on(GetCommand, { TableName: 'ParticipantsTableTest' })
      .resolves({ Item: { conversationId: 'convo-1', userId: 'user-1' } })
    ddbMock.on(QueryCommand, { TableName: 'MessagesTableTest' }).resolves({
      Items: [
        {
          conversationId: 'convo-1',
          sortKey: '2026-01-02T00:00:00.000Z#msg-1',
          id: 'msg-1',
          senderId: 'user-1',
          body: 'hi',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    })

    const result = await handler(
      fakeEvent({
        cookies: [`token=${token}`],
        pathParameters: { id: 'convo-1' },
        queryStringParameters: { limit: '10' },
      }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body.hasMore).toBe(false)
    expect(body.messages).toEqual([
      {
        conversationId: 'convo-1',
        id: 'msg-1',
        senderId: 'user-1',
        body: 'hi',
        createdAt: '2026-01-02T00:00:00.000Z',
        cursor: '2026-01-02T00:00:00.000Z#msg-1',
      },
    ])
  })
})
