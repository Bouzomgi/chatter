import { getConversationById } from '../../lib/conversations.js'
import { getLatestMessage } from '../../lib/messages.js'
import { getConversationIdsForUser, getParticipantsForConversation } from '../../lib/participants.js'
import { getUsersByIds } from '../../lib/users.js'
import { json } from '../../lib/http.js'
import { withAuth } from '../../lib/withAuth.js'

export const handler = withAuth(async (_event, auth) => {
  const conversationIds = await getConversationIdsForUser(auth.userId)

  const summaries = await Promise.all(conversationIds.map((id) => buildSummary(id, auth.userId)))

  const conversations = summaries
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => {
      const aTime = a.latestMessage?.createdAt ?? a.createdAt
      const bTime = b.latestMessage?.createdAt ?? b.createdAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

  return json(200, conversations)
})

// A conversation stays hidden from the list until its first message is
// sent (see the original project's #64/#61) — the client creates a
// conversation record lazily, before anyone's actually said anything.
async function buildSummary(conversationId: string, currentUserId: string) {
  const [conversation, participants, latestMessage] = await Promise.all([
    getConversationById(conversationId),
    getParticipantsForConversation(conversationId),
    getLatestMessage(conversationId),
  ])

  if (!conversation || !latestMessage) return null

  const myParticipant = participants.find((p) => p.userId === currentUserId)
  const otherParticipantIds = participants.filter((p) => p.userId !== currentUserId).map((p) => p.userId)
  const otherUsers = await getUsersByIds(otherParticipantIds)

  return {
    id: conversation.conversationId,
    createdAt: conversation.createdAt,
    participants: otherUsers
      .map((u) => ({ id: u.userId, username: u.username, avatarIndex: u.avatarIndex }))
      .sort((a, b) => a.username.localeCompare(b.username)),
    latestMessage,
    unread: myParticipant ? !myParticipant.seen : false,
  }
}
