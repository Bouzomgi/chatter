import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import MessageThread from './MessageThread.js'
import type { Message } from '@chatter/shared'

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// Frozen to Sunday 2026-05-24 at 3:00 PM UTC (TZ=UTC set in vitest.config)
const NOW = new Date('2026-05-24T15:00:00.000Z')

function msg(id: string, senderId: string, createdAt: string): Message {
  return { id, conversationId: 'c1', senderId, body: `body-${id}`, createdAt }
}

describe('MessageThread timestamp labels', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('shows a timestamp for the first message', () => {
    const { getByText } = render(
      <MessageThread messages={[msg('1', 'u1', '2026-05-24T10:00:00.000Z')]} currentUserId="u1" />
    )
    expect(getByText('10:00 AM')).toBeTruthy()
  })

  it('does not show a second timestamp when messages are within 2 hours', () => {
    const messages = [
      msg('1', 'u1', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u1', '2026-05-24T10:30:00.000Z'),
    ]
    const { queryByText } = render(<MessageThread messages={messages} currentUserId="u1" />)
    expect(queryByText('10:30 AM')).toBeNull()
  })

  it('shows a new timestamp when messages are 2+ hours apart', () => {
    const messages = [
      msg('1', 'u1', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u1', '2026-05-24T13:00:00.000Z'),
    ]
    const { getByText } = render(<MessageThread messages={messages} currentUserId="u1" />)
    expect(getByText('10:00 AM')).toBeTruthy()
    expect(getByText('1:00 PM')).toBeTruthy()
  })

  it('shows a new timestamp when messages are on different calendar days', () => {
    const messages = [
      msg('1', 'u1', '2026-05-23T22:00:00.000Z'),
      msg('2', 'u1', '2026-05-24T01:00:00.000Z'),
    ]
    const { getByText } = render(<MessageThread messages={messages} currentUserId="u1" />)
    expect(getByText('Saturday 10:00 PM')).toBeTruthy()
    expect(getByText('1:00 AM')).toBeTruthy()
  })
})

describe('MessageThread message spacing', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('does not add spacing for a single message', () => {
    const { container } = render(
      <MessageThread messages={[msg('1', 'u1', '2026-05-24T10:00:00.000Z')]} currentUserId="u1" />
    )
    expect(container.querySelector('.flex.mt-2')).toBeNull()
  })

  it('adds spacing when the sender changes', () => {
    const messages = [
      msg('1', 'u1', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u2', '2026-05-24T10:00:05.000Z'),
    ]
    const { container } = render(<MessageThread messages={messages} currentUserId="u1" />)
    expect(container.querySelector('.flex.mt-2')).toBeTruthy()
  })

  it('adds spacing when same-sender messages are 30+ seconds apart', () => {
    const messages = [
      msg('1', 'u1', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u1', '2026-05-24T10:00:31.000Z'),
    ]
    const { container } = render(<MessageThread messages={messages} currentUserId="u1" />)
    expect(container.querySelector('.flex.mt-2')).toBeTruthy()
  })

  it('does not add spacing when same-sender messages are within 30 seconds', () => {
    const messages = [
      msg('1', 'u1', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u1', '2026-05-24T10:00:10.000Z'),
    ]
    const { container } = render(<MessageThread messages={messages} currentUserId="u1" />)
    expect(container.querySelector('.flex.mt-2')).toBeNull()
  })

  it('does not add spacing when a timestamp is shown (timestamp provides separation)', () => {
    const messages = [
      msg('1', 'u1', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u2', '2026-05-24T13:00:00.000Z'), // 3h later, different sender
    ]
    const { container } = render(<MessageThread messages={messages} currentUserId="u1" />)
    // timestamp shown → addSpace suppressed regardless of sender change
    expect(container.querySelector('.flex.mt-2')).toBeNull()
  })
})
