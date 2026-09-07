import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { ddb } from '../lib/dynamo.js'
import { handler } from './sendMessage.js'

const ddbMock = mockClient(ddb)
const apiGwMock = mockClient(ApiGatewayManagementApiClient)

beforeEach(() => {
  ddbMock.reset()
  apiGwMock.reset()
})

function fakeEvent(body: unknown, connectionId = 'sender-conn'): APIGatewayProxyWebsocketEventV2 {
  return {
    body: JSON.stringify(body),
    requestContext: { connectionId, domainName: 'abc123.execute-api.us-east-1.amazonaws.com', stage: 'prod' },
  } as unknown as APIGatewayProxyWebsocketEventV2
}

describe('sendMessage handler', () => {
  it('rejects an unrecognized connection with 401', async () => {
    ddbMock.on(GetCommand).resolves({})

    const result = await handler(
      fakeEvent({ conversationId: 'convo-1', body: 'hi' }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('rejects an invalid payload with 400', async () => {
    ddbMock.on(GetCommand, { TableName: 'ConnectionUsersTableTest' }).resolves({ Item: { userId: 'user-1' } })

    const result = await handler(fakeEvent({ conversationId: 'convo-1' }), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 400 })
  })

  it('rejects a non-participant with 403', async () => {
    ddbMock.on(GetCommand, { TableName: 'ConnectionUsersTableTest' }).resolves({ Item: { userId: 'user-1' } })
    ddbMock.on(GetCommand, { TableName: 'ParticipantsTableTest' }).resolves({})

    const result = await handler(
      fakeEvent({ conversationId: 'convo-1', body: 'hi' }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 403 })
  })

  it('persists the message and broadcasts to every listener', async () => {
    ddbMock.on(GetCommand, { TableName: 'ConnectionUsersTableTest' }).resolves({ Item: { userId: 'user-1' } })
    ddbMock.on(GetCommand, { TableName: 'ParticipantsTableTest' }).resolves({ Item: { conversationId: 'convo-1', userId: 'user-1' } })
    ddbMock
      .on(QueryCommand, { TableName: 'ConnectionsTableTest' })
      .resolves({ Items: [{ connectionId: 'sender-conn' }, { connectionId: 'other-conn' }] })
    ddbMock
      .on(QueryCommand, { TableName: 'ParticipantsTableTest' })
      .resolves({ Items: [{ conversationId: 'convo-1', userId: 'user-1', seen: true }, { conversationId: 'convo-1', userId: 'user-2', seen: true }] })
    ddbMock.on(PutCommand).resolves({})
    ddbMock.on(UpdateCommand).resolves({})
    apiGwMock.on(PostToConnectionCommand).resolves({})

    const result = await handler(
      fakeEvent({ conversationId: 'convo-1', body: '  hello  ' }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 200 })

    const putCall = ddbMock.commandCalls(PutCommand)[0]
    expect(putCall.args[0].input.Item).toMatchObject({ conversationId: 'convo-1', senderId: 'user-1', body: 'hello' })

    expect(apiGwMock.commandCalls(PostToConnectionCommand)).toHaveLength(2)

    // marks unread for the other participant only, not the sender
    const updateCalls = ddbMock.commandCalls(UpdateCommand)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].args[0].input.Key).toMatchObject({ userId: 'user-2' })
  })

  it('drops a stale connection that has gone away', async () => {
    ddbMock.on(GetCommand, { TableName: 'ConnectionUsersTableTest' }).resolves({ Item: { userId: 'user-1' } })
    ddbMock.on(GetCommand, { TableName: 'ParticipantsTableTest' }).resolves({ Item: { conversationId: 'convo-1', userId: 'user-1' } })
    ddbMock.on(QueryCommand, { TableName: 'ConnectionsTableTest' }).resolves({ Items: [{ connectionId: 'stale-conn' }] })
    ddbMock.on(QueryCommand, { TableName: 'ParticipantsTableTest' }).resolves({ Items: [{ conversationId: 'convo-1', userId: 'user-1', seen: true }] })
    ddbMock.on(PutCommand).resolves({})
    ddbMock.on(UpdateCommand).resolves({})
    ddbMock.on(DeleteCommand).resolves({})
    apiGwMock
      .on(PostToConnectionCommand)
      .rejects(new GoneException({ message: 'gone', $metadata: {} }))

    const result = await handler(
      fakeEvent({ conversationId: 'convo-1', body: 'hi' }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 200 })
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(2) // Connections + ConnectionUsers cleanup
  })
})
