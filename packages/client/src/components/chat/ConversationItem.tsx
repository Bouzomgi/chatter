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
      style={{ borderRight: isActive && !isAnimating ? '4px solid #00a676' : '4px solid transparent' }}
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
      {unread && !isAnimating && (
        <div
          className="absolute top-0 -right-1"
          style={{ width: 0, height: 0, borderTop: '20px solid #00a676', borderLeft: '20px solid transparent' }}
        />
      )}
      {isAnimating && (
        <div
          className="absolute top-0 bottom-0 -right-1 w-5 bg-[#00a676] pointer-events-none"
          style={{ animation: 'unread-to-active 0.2s ease-in-out forwards' }}
          onAnimationEnd={() => setIsAnimating(false)}
        />
      )}
      <div className="absolute bottom-0 left-0 -right-1 h-[2px] bg-white" />
    </div>
  )
}
