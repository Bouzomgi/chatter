import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './register.js'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

describe('register handler', () => {
  it('creates a user and returns a session cookie', async () => {
    ddbMock.on(TransactWriteCommand).resolves({})

    const result = await handler(
      fakeEvent({ body: { username: 'alice', email: 'alice@example.com', password: 'hunter2' } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 201 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body).toMatchObject({ username: 'alice', email: 'alice@example.com' })
    expect(body.passwordHash).toBeUndefined()
    expect((result as { cookies: string[] }).cookies[0]).toMatch(/^token=/)
  })

  it('rejects a taken username or email with 409', async () => {
    ddbMock.on(TransactWriteCommand).rejects(
      new TransactionCanceledException({
        message: 'cancelled',
        $metadata: {},
        CancellationReasons: [{ Code: 'ConditionalCheckFailed' }],
      }),
    )

    const result = await handler(
      fakeEvent({ body: { username: 'alice', email: 'alice@example.com', password: 'hunter2' } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 409 })
  })

  it('rejects an incomplete body with 400', async () => {
    const result = await handler(fakeEvent({ body: { username: 'alice' } }), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 400 })
  })
})
