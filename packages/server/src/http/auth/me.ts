import { json } from '../../lib/http.js'
import { getUserById, toPublicUser } from '../../lib/users.js'
import { withAuth } from '../../lib/withAuth.js'

export const handler = withAuth(async (_event, auth) => {
  const user = await getUserById(auth.userId)
  if (!user) {
    return json(401, { error: 'Unauthorized' })
  }
  return json(200, toPublicUser(user))
})
