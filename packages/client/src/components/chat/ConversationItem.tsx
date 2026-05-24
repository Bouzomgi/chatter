import { useState, useEffect, useRef } from 'react'
import type { Conversation } from '@chatter/shared'
import { getAvatarSrc } from '../../lib/avatars.js'

interface Props {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}

export default function ConversationItem({ conversation, isActive, onClick }: Props) {
  const { otherUser, latestMessage, unread } = conversation
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

  return (
    <div
      data-testid="conversation-item"
      onClick={onClick}
      className="relative flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#e0d0c1cc]"
    >
      <img
        src={getAvatarSrc(otherUser.avatarIndex)}
        alt={otherUser.username}
        className="h-12 w-12 rounded-full shrink-0"
      />
      <div className="flex flex-col overflow-hidden">
        <span className="font-bold text-[16px] truncate">{otherUser.username}</span>
        {latestMessage && (
          <span className="text-[13px] text-gray-500 truncate">{latestMessage.body}</span>
        )}
      </div>
      {(unread || isAnimating) && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div
            className="h-2 w-2 rounded-full bg-[#00a676]"
            style={isAnimating ? { animation: 'dot-shrink 0.2s ease-in forwards' } : {}}
          />
        </div>
      )}
      {(isActive || isAnimating) && (
        <div
          className="absolute top-0 bottom-0 right-0 w-1 bg-[#00a676]"
          style={isAnimating ? { animation: 'bar-grow 0.3s ease-out forwards', transformOrigin: 'top' } : {}}
          onAnimationEnd={() => setIsAnimating(false)}
        />
      )}
      <div className="absolute bottom-0 left-0 -right-1 h-[2px] bg-white" />
    </div>
  )
}
