import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'

export function json(
  statusCode: number,
  body: unknown,
  cookies?: string[],
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...(cookies ? { cookies } : {}),
  }
}

export function parseJsonBody(rawBody: string | undefined): unknown {
  if (!rawBody) return {}
  try {
    return JSON.parse(rawBody)
  } catch {
    return {}
  }
}
