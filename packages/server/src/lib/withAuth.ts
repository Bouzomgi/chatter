import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { verifyRequest, type AuthPayload } from './auth.js'
import { json } from './http.js'

// The REST equivalent of the original project's requireAuth middleware —
// plain function composition instead of a middleware chain, since Lambda
// handlers don't have one. Wrap a handler in this once instead of repeating
// the "verify or 401" check in every protected route.
export function withAuth(
  handler: (event: APIGatewayProxyEventV2, auth: AuthPayload) => Promise<APIGatewayProxyStructuredResultV2>,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const auth = verifyRequest(event)
    if (!auth) return json(401, { error: 'Unauthorized' })
    return handler(event, auth)
  }
}
