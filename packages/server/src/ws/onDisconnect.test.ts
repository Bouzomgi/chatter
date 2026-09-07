import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { DeleteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { ddb } from '../lib/dynamo.js'
import { handler } from './onDisconnect.js'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

function fakeEvent(connectionId = 'conn-1'): APIGatewayProxyWebsocketEventV2 {
  return { requestContext: { connectionId } } as unknown as APIGatewayProxyWebsocketEventV2
}

describe('onDisconnect handler', () => {
  it('is a no-op when the connection was never recorded', async () => {
    ddbMock.on(GetCommand).resolves({})

    const result = await handler(fakeEvent(), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(0)
  })

  it('leaves every conversation and forgets the connection', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', userId: 'user-1' } })
    ddbMock.on(QueryCommand).resolves({ Items: [{ conversationId: 'convo-1' }, { conversationId: 'convo-2' }] })
    ddbMock.on(DeleteCommand).resolves({})

    const result = await handler(fakeEvent(), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    // one to forget the connection's owner, one per conversation left
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(3)
  })
})
