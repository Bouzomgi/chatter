import { issueToken } from '../../lib/auth.js'
import { json } from '../../lib/http.js'
import { withAuth } from '../../lib/withAuth.js'

// The WebSocket handshake can't carry the httpOnly session cookie the way a
// normal REST call does — client JS can't read it to put it in the
// connection URL, and even if it could, the WebSocket API lives on a
// different default domain than the HTTP API. This issues a short-lived
// token instead: the client fetches one (authenticated by the cookie, like
// any other REST call) immediately before opening the socket, and it's
// used once and discarded. Short-lived because it travels in a URL —
// visible in logs, browser history — unlike the cookie it's standing in for.
export const handler = withAuth(async (_event, auth) => {
  return json(200, { token: issueToken(auth.userId, '60s') })
})
