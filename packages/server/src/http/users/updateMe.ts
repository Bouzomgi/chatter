import { z } from 'zod'
import { json, parseJsonBody } from '../../lib/http.js'
import { toPublicUser, updateAvatarIndex } from '../../lib/users.js'
import { withAuth } from '../../lib/withAuth.js'

const updateAvatarSchema = z.object({
  avatarIndex: z.number().int().min(0).max(8),
})

export const handler = withAuth(async (event, auth) => {
  const parsed = updateAvatarSchema.safeParse(parseJsonBody(event.body))
  if (!parsed.success) {
    return json(400, { error: 'avatarIndex must be a number between 0 and 8' })
  }

  const user = await updateAvatarIndex(auth.userId, parsed.data.avatarIndex)
  return json(200, toPublicUser(user))
})
