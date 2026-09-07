import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { issueToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './getUsers.js'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

describe('getUsers handler', () => {
  it('returns 401 with no session', async () => {
    const result = await handler(fakeEvent(), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('lists every user but the caller, sorted by username', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { userId: 'user-1', username: 'zeta', email: 'z@example.com', passwordHash: 'x', avatarIndex: 0 },
        { userId: 'user-2', username: 'alice', email: 'a@example.com', passwordHash: 'x', avatarIndex: 1 },
        { userId: 'caller', username: 'me', email: 'me@example.com', passwordHash: 'x', avatarIndex: 2 },
      ],
    })

    const token = issueToken('caller')
    const result = await handler(fakeEvent({ cookies: [`token=${token}`] }), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body.map((u: { username: string }) => u.username)).toEqual(['alice', 'zeta'])
    expect(body[0].passwordHash).toBeUndefined()
  })
})
