import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { ddb } from '../lib/dynamo.js'
import { issueToken } from '../lib/auth.js'
import { handler } from './onConnect.js'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

function fakeEvent(opts: { token?: string; connectionId?: string }): APIGatewayProxyWebsocketEventV2 {
  return {
    queryStringParameters: opts.token ? { token: opts.token } : undefined,
    requestContext: { connectionId: opts.connectionId ?? 'conn-1' },
  } as unknown as APIGatewayProxyWebsocketEventV2
}

describe('onConnect handler', () => {
  it('rejects a connection with no token', async () => {
    const result = await handler(fakeEvent({}), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('rejects a connection with an invalid token', async () => {
    const result = await handler(fakeEvent({ token: 'not-a-real-jwt' }), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('joins every conversation the user is a participant in', async () => {
    ddbMock
      .on(QueryCommand)
      .resolves({ Items: [{ conversationId: 'convo-1' }, { conversationId: 'convo-2' }] })
    ddbMock.on(PutCommand).resolves({})

    const token = issueToken('user-1')
    const result = await handler(fakeEvent({ token, connectionId: 'conn-1' }), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    const putCalls = ddbMock.commandCalls(PutCommand)
    // one to remember the connection's owner, one per conversation joined
    expect(putCalls).toHaveLength(3)
  })
})
