import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { issueToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './updateMe.js'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

describe('updateMe handler', () => {
  it('rejects an out-of-range avatarIndex with 400', async () => {
    const token = issueToken('user-1')
    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], body: { avatarIndex: 99 } }),
      {} as never,
      () => undefined,
    )
    expect(result).toMatchObject({ statusCode: 400 })
  })

  it('updates the avatar and returns the public profile', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'user-1', username: 'alice', email: 'a@example.com', passwordHash: 'x', avatarIndex: 5 },
    })

    const token = issueToken('user-1')
    const result = await handler(
      fakeEvent({ cookies: [`token=${token}`], body: { avatarIndex: 5 } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body).toMatchObject({ username: 'alice', avatarIndex: 5 })
    expect(body.passwordHash).toBeUndefined()
  })
})
