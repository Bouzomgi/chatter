import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { BatchGetCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { issueToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './getConversations.js'

const ddbMock = mockClient(ddb)
const token = issueToken('user-1')

beforeEach(() => {
  ddbMock.reset()
})

describe('getConversations handler', () => {
  it('returns 401 with no session', async () => {
    const result = await handler(fakeEvent(), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('hides a conversation with no messages yet', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'ConversationsTableTest' })
      .resolves({ Item: { conversationId: 'convo-1', createdAt: '2026-01-01T00:00:00.000Z' } })
    // Both the ByUserIndex GSI query and the base-table participants query
    // target the same TableName, so the more specific matcher (IndexName)
    // must be registered last — aws-sdk-client-mock prefers the most
    // recently registered match when more than one applies.
    ddbMock
      .on(QueryCommand, { TableName: 'ParticipantsTableTest' })
      .resolves({ Items: [{ conversationId: 'convo-1', userId: 'user-1', seen: true }] })
    ddbMock
      .on(QueryCommand, { TableName: 'ParticipantsTableTest', IndexName: 'ByUserIndex' })
      .resolves({ Items: [{ conversationId: 'convo-1' }] })
    ddbMock.on(QueryCommand, { TableName: 'MessagesTableTest' }).resolves({ Items: [] })

    const result = await handler(fakeEvent({ cookies: [`token=${token}`] }), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    expect(JSON.parse((result as { body: string }).body)).toEqual([])
  })

  it('includes a conversation with a message, marking unread correctly', async () => {
    ddbMock
      .on(GetCommand, { TableName: 'ConversationsTableTest' })
      .resolves({ Item: { conversationId: 'convo-1', createdAt: '2026-01-01T00:00:00.000Z' } })
    ddbMock.on(QueryCommand, { TableName: 'ParticipantsTableTest' }).resolves({
      Items: [
        { conversationId: 'convo-1', userId: 'user-1', seen: false },
        { conversationId: 'convo-1', userId: 'user-2', seen: true },
      ],
    })
    ddbMock
      .on(QueryCommand, { TableName: 'ParticipantsTableTest', IndexName: 'ByUserIndex' })
      .resolves({ Items: [{ conversationId: 'convo-1' }] })
    ddbMock.on(QueryCommand, { TableName: 'MessagesTableTest' }).resolves({
      Items: [
        {
          conversationId: 'convo-1',
          sortKey: '2026-01-02T00:00:00.000Z#msg-1',
          id: 'msg-1',
          senderId: 'user-2',
          body: 'hi',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    })
    ddbMock
      .on(BatchGetCommand)
      .resolves({ Responses: { UsersTableTest: [{ userId: 'user-2', username: 'bob', avatarIndex: 1 }] } })

    const result = await handler(fakeEvent({ cookies: [`token=${token}`] }), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: 'convo-1',
      participants: [{ id: 'user-2', username: 'bob', avatarIndex: 1 }],
      unread: true,
    })
  })
})
