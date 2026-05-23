import type { Conversation } from '@chatter/shared'
import { getAvatarSrc } from '../../lib/avatars.js'

interface Props {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}

export default function ConversationItem({ conversation, isActive, onClick }: Props) {
  const { otherUser, latestMessage, unread } = conversation

  return (
    <div
      data-testid="conversation-item"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#e0d0c1cc] border-b-2 border-white"
      style={{ borderRight: isActive ? '4px solid #00a676' : '4px solid transparent' }}
    >
      <div className="relative shrink-0">
        <img
          src={getAvatarSrc(otherUser.avatarIndex)}
          alt={otherUser.username}
          className="h-12 w-12 rounded-full"
        />
        {unread && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
        )}
      </div>
      <div className="flex flex-col overflow-hidden">
        <span className="font-bold text-[16px] truncate">{otherUser.username}</span>
        {latestMessage && (
          <span className="text-[13px] text-gray-500 truncate">{latestMessage.body}</span>
        )}
      </div>
    </div>
  )
}
