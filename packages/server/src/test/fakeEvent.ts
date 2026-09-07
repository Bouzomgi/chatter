import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Handlers only ever read a handful of fields off the event, so the fake
// only needs to satisfy those — cast past the rest of the (large) real shape.
export function fakeEvent(
  opts: {
    body?: unknown
    cookies?: string[]
    pathParameters?: Record<string, string>
    queryStringParameters?: Record<string, string>
  } = {},
): APIGatewayProxyEventV2 {
  return {
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cookies: opts.cookies,
    pathParameters: opts.pathParameters,
    queryStringParameters: opts.queryStringParameters,
  } as unknown as APIGatewayProxyEventV2
}
