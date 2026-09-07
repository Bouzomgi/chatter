import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { issueToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './me.js'

const ddbMock = mockClient(ddb)

const USER = {
  userId: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: 'irrelevant-hash',
  avatarIndex: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  ddbMock.reset()
})

describe('me handler', () => {
  it('returns 401 with no cookie', async () => {
    const result = await handler(fakeEvent(), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('returns 401 with an invalid token', async () => {
    const result = await handler(fakeEvent({ cookies: ['token=not-a-real-jwt'] }), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('returns the current user for a valid token', async () => {
    ddbMock.on(GetCommand).resolves({ Item: USER })
    const token = issueToken(USER.userId)

    const result = await handler(fakeEvent({ cookies: [`token=${token}`] }), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body).toMatchObject({ username: 'alice', avatarIndex: 3 })
    expect(body.passwordHash).toBeUndefined()
  })
})
