import { describe, expect, it } from 'vitest'
import { handler } from './health.js'

describe('health handler', () => {
  it('returns 200 with an ok status', async () => {
    // @ts-expect-error - test doesn't need the full APIGatewayProxyEventV2 shape
    const result = await handler({}, {} as never, () => undefined)

    expect(result).toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' }),
    })
  })
})
