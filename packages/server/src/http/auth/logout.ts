import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { clearTokenCookie } from '../../lib/auth.js'
import { json } from '../../lib/http.js'

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return json(200, { ok: true }, [clearTokenCookie()])
}
