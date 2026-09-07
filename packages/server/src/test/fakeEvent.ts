import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Handlers only ever read `body` and `cookies` off the event, so the fake
// only needs to satisfy those — cast past the rest of the (large) real shape.
export function fakeEvent(opts: { body?: unknown; cookies?: string[] } = {}): APIGatewayProxyEventV2 {
  return {
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cookies: opts.cookies,
  } as unknown as APIGatewayProxyEventV2
}
