import { useEffect, useRef, useState } from 'react'
import type { Message } from '@chatter/shared'
import { formatMessageTimestamp } from '../../lib/formatTimestamp.js'

interface Props {
  messages: Message[]
  currentUserId: string
  hasMore?: boolean
  onLoadMore?: () => void
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const THIRTY_SECONDS_MS = 30 * 1000

function showTimestamp(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return true
  const gap = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()
  const prevDay = new Date(prev.createdAt)
  const currDay = new Date(curr.createdAt)
  const differentDays = prevDay.toDateString() !== currDay.toDateString()
  return gap >= TWO_HOURS_MS || differentDays
}

function addSpacing(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return false
  const senderChanged = prev.senderId !== curr.senderId
  const gap = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()
  return senderChanged || gap >= THIRTY_SECONDS_MS
}

export default function MessageThread({ messages, currentUserId, hasMore, onLoadMore }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const firstMsgIdRef = useRef<string | undefined>(undefined)
  const prevScrollHeightRef = useRef<number | null>(null)
  const isLoadingMoreRef = useRef(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const firstId = messages[0]?.id

    if (prevScrollHeightRef.current !== null) {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = null
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
      firstMsgIdRef.current = firstId
      return
    }

    if (firstId !== firstMsgIdRef.current) {
      firstMsgIdRef.current = firstId
      bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
    } else {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  function handleScroll() {
    const el = containerRef.current
    if (!el || !hasMore || !onLoadMore || isLoadingMoreRef.current) return
    if (el.scrollTop < 100) {
      isLoadingMoreRef.current = true
      prevScrollHeightRef.current = el.scrollHeight
      setIsLoadingMore(true)
      onLoadMore()
    }
  }

  return (
    <div
      ref={containerRef}
      data-testid="message-thread"
      className="flex-1 overflow-y-auto py-4"
      onScroll={handleScroll}
    >
      <div className="w-[93%] mx-auto flex flex-col gap-1">
        {isLoadingMore && (
          <div data-testid="load-more-spinner" className="flex justify-center py-2">
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-[#00a676] animate-spin" />
          </div>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const isMine = msg.senderId === currentUserId
          const showTs = showTimestamp(prev, msg)
          const addSpace = !showTs && addSpacing(prev, msg)

          return (
            <div key={msg.id}>
              {showTs && (
                <div className={`text-center text-[12px] text-gray-400 mb-2 ${i === 0 ? 'mt-1' : 'mt-2'}`}>
                  {formatMessageTimestamp(msg.createdAt)}
                </div>
              )}
              <div
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${addSpace ? 'mt-2' : ''}`}
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
