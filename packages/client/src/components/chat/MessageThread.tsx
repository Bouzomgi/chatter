import { useEffect, useRef } from 'react'
import type { Message } from '@chatter/shared'

interface Props {
  messages: Message[]
  currentUserId: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })
}

function showTimestamp(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return true
  const gap = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()
  return gap > 2 * 60 * 60 * 1000
}

export default function MessageThread({ messages, currentUserId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const firstMsgIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const firstId = messages[0]?.id
    if (firstId !== firstMsgIdRef.current) {
      firstMsgIdRef.current = firstId
      bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
    } else {
      const el = containerRef.current
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  return (
    <div ref={containerRef} data-testid="message-thread" className="flex-1 overflow-y-auto py-4">
      <div className="w-[93%] mx-auto flex flex-col gap-1">
        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const isMine = msg.senderId === currentUserId
          const senderChanged = prev && prev.senderId !== msg.senderId

          return (
            <div key={msg.id}>
              {showTimestamp(prev, msg) && (
                <div className="text-center text-[12px] text-gray-400 my-5">
                  {formatTime(msg.createdAt)}
                </div>
              )}
              <div
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${senderChanged ? 'mt-4' : ''}`}
              >
                <div
                  className="max-w-[60%] px-3 py-2 rounded-[10px] text-[15px] leading-snug"
                  style={{
                    background: isMine ? 'rgba(0,166,118,0.2)' : 'rgba(217,217,217,0.7)',
                  }}
                >
                  {msg.body}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
