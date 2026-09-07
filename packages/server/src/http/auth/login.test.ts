import { beforeEach, describe, expect, it } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import bcrypt from 'bcryptjs'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../lib/dynamo.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './login.js'

const ddbMock = mockClient(ddb)

const USER = {
  userId: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: bcrypt.hashSync('hunter2', 12),
  avatarIndex: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  ddbMock.reset()
})

describe('login handler', () => {
  it('logs in with correct credentials', async () => {
    ddbMock.on(GetCommand, { TableName: 'UsersByEmailTableTest' }).resolves({ Item: { userId: USER.userId } })
    ddbMock.on(GetCommand, { TableName: 'UsersTableTest' }).resolves({ Item: USER })

    const result = await handler(
      fakeEvent({ body: { email: USER.email, password: 'hunter2' } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(body).toMatchObject({ username: 'alice', avatarIndex: 3 })
    expect((result as { cookies: string[] }).cookies[0]).toMatch(/^token=/)
  })

  it('rejects an unknown email with 401', async () => {
    ddbMock.on(GetCommand, { TableName: 'UsersByEmailTableTest' }).resolves({})

    const result = await handler(
      fakeEvent({ body: { email: 'nobody@example.com', password: 'hunter2' } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('rejects a wrong password with 401', async () => {
    ddbMock.on(GetCommand, { TableName: 'UsersByEmailTableTest' }).resolves({ Item: { userId: USER.userId } })
    ddbMock.on(GetCommand, { TableName: 'UsersTableTest' }).resolves({ Item: USER })

    const result = await handler(
      fakeEvent({ body: { email: USER.email, password: 'wrong' } }),
      {} as never,
      () => undefined,
    )

    expect(result).toMatchObject({ statusCode: 401 })
  })
})
