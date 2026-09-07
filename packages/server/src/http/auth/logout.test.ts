import { describe, expect, it } from 'vitest'
import { handler } from './logout.js'

describe('logout handler', () => {
  it('clears the session cookie', async () => {
    const result = await handler(fakeGatewayEvent(), {} as never, () => undefined)

    expect(result).toMatchObject({ statusCode: 200 })
    expect((result as { cookies: string[] }).cookies[0]).toMatch(/^token=;/)
  })
})

function fakeGatewayEvent() {
  return {} as never
}
