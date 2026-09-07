import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { issueToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './markRead.js'

const ddbMock = mockClient(ddb)
const token = issueToken('user-1')

beforeEach(() => {
  ddbMock.reset()
})

describe('markRead handler', () => {
  it('returns 401 with no session', async () => {
    const result = await handler(fakeEvent({ pathParameters: { id: 'convo-1' } }), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('returns 403 when the caller is not a participant', async () => {
    ddbMock.on(GetCommand).resolves({})

    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], pathParameters: { id: 'convo-1' } }),
      {} as never,
      () => undefined,
    )
    expect(result).toMatchObject({ statusCode: 403 })
  })

  it('marks the conversation read for the caller', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { conversationId: 'convo-1', userId: 'user-1' } })
    ddbMock.on(UpdateCommand).resolves({})

    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], pathParameters: { id: 'convo-1' } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 204 })
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0]
    expect(updateCall.args[0].input).toMatchObject({
      Key: { conversationId: 'convo-1', userId: 'user-1' },
      ExpressionAttributeValues: { ':seen': true },
    })
  })
})
