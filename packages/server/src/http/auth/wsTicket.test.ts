import { describe, expect, it } from 'vitest'
import { issueToken, verifyToken } from '../../lib/auth.js'
import { fakeEvent } from '../../test/fakeEvent.js'
import { handler } from './wsTicket.js'

describe('wsTicket handler', () => {
  it('returns 401 with no session', async () => {
    const result = await handler(fakeEvent(), {} as never, () => undefined)
    expect(result).toMatchObject({ statusCode: 401 })
  })

  it('returns a short-lived token for the caller', async () => {
    const token = issueToken('user-1')
    const result = await handler(fakeEvent({ cookies: [`token=${token}`] }), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    const body = JSON.parse((result as { body: string }).body)
    expect(verifyToken(body.token)).toMatchObject({ userId: 'user-1' })
  })
})
