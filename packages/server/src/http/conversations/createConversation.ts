import { z } from 'zod'
import { findOrCreateConversation } from '../../lib/conversations.js'
import { json, parseJsonBody } from '../../lib/http.js'
import { getUsersByIds } from '../../lib/users.js'
import { withAuth } from '../../lib/withAuth.js'

const createConversationSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
})

export const handler = withAuth(async (event, auth) => {
  const parsed = createConversationSchema.safeParse(parseJsonBody(event.body))
  if (!parsed.success) {
    return json(400, { error: 'participantIds is required' })
  }
  const { participantIds } = parsed.data

  if (participantIds.includes(auth.userId)) {
    return json(400, { error: 'Cannot start a conversation with yourself' })
  }

  const targets = await getUsersByIds(participantIds)
  if (targets.length !== participantIds.length) {
    return json(404, { error: 'User not found' })
  }

  const { conversation, isNew } = await findOrCreateConversation([auth.userId, ...participantIds])

  const participants = targets
    .map((u) => ({ id: u.userId, username: u.username, avatarIndex: u.avatarIndex }))
    .sort((a, b) => a.username.localeCompare(b.username))

  return json(isNew ? 201 : 200, {
    id: conversation.conversationId,
    createdAt: conversation.createdAt,
    participants,
  })
})
