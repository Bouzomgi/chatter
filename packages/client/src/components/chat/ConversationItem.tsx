import { useState, useEffect, useRef } from 'react'
import type { Conversation } from '@chatter/shared'
import { getAvatarSrc } from '../../lib/avatars.js'
import { formatConversationTime } from '../../lib/formatTimestamp.js'

interface Props {
  conversation: Conversation
  isActive: boolean
  isOnline: boolean
  onClick: () => void
}

export default function ConversationItem({ conversation, isActive, isOnline, onClick }: Props) {
  const { participants, latestMessage, unread } = conversation
  const displayName = participants.map(p => p.username).join(', ')
  const firstParticipant = participants[0]
  const prevIsActiveRef = useRef(isActive)
  const prevUnreadRef = useRef(unread)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isActive && !prevIsActiveRef.current && prevUnreadRef.current) {
      setIsAnimating(true)
    }
    prevIsActiveRef.current = isActive
    prevUnreadRef.current = unread
  }, [isActive, unread])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      data-testid="conversation-item"
      role="button"
      tabIndex={0}
      aria-label={`Conversation with ${displayName}${unread ? ', unread' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="relative flex items-center gap-3 pl-8 pr-4 py-3 cursor-pointer hover:bg-[#e0d0c1cc] overflow-hidden"
    >
      {(unread || isAnimating) && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <div
            className="h-2 w-2 rounded-full bg-[#00a676]"
            style={isAnimating ? { animation: 'dot-shrink 0.2s ease-in forwards' } : {}}
            onAnimationEnd={() => setIsAnimating(false)}
          />
        </div>
      )}
      <div className="relative shrink-0">
        {participants.length > 1
          ? <div className="h-12 w-12 rounded-full bg-[#6b7280]" />
          : <img
              src={getAvatarSrc(firstParticipant.avatarIndex)}
              alt={firstParticipant.username}
              className="h-12 w-12 rounded-full"
            />
        }
      </div>
      <div className="flex flex-col overflow-hidden flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-[16px] truncate">{displayName}</span>
          {latestMessage && (
            <span className="text-[11px] text-gray-400 shrink-0">{formatConversationTime(latestMessage.createdAt)}</span>
          )}
        </div>
        <span className="text-[13px] text-gray-500 truncate">{latestMessage?.body ?? ' '}</span>
        <span className="text-[13px]">&nbsp;</span>
      </div>
      {isActive && (
        <div className="absolute top-0 bottom-0 right-0 w-1 bg-[#00a676]" />
      )}
      <div className="absolute bottom-0 left-0 -right-1 h-[2px] bg-white" />
    </div>
  )
}
