import { json } from '../../lib/http.js'
import { listUsersExcept } from '../../lib/users.js'
import { withAuth } from '../../lib/withAuth.js'

export const handler = withAuth(async (_event, auth) => {
  const users = await listUsersExcept(auth.userId)
  return json(200, users)
})
