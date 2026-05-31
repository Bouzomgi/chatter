import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import MessageThread from './MessageThread.js'
import type { Message, UserSummary } from '@chatter/shared'

vi.mock('../../lib/avatars.js', () => ({ getAvatarSrc: () => '/avatar.png' }))

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// Frozen to Sunday 2026-05-24 at 3:00 PM UTC (TZ=UTC set in vitest.config)
const NOW = new Date('2026-05-24T15:00:00.000Z')

function msg(id: string, senderId: string, createdAt: string, body?: string): Message {
  return { id, conversationId: 'c1', senderId, body: body ?? `body-${id}`, createdAt }
}

const alice: UserSummary = { id: 'u1', username: 'alice', avatarIndex: 0 }
const bob: UserSummary = { id: 'u2', username: 'bob', avatarIndex: 1 }
const carol: UserSummary = { id: 'u3', username: 'carol', avatarIndex: 2 }

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

describe('MessageThread group sender names', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  const groupParticipants = [alice, bob, carol]

  it('shows sender name above the first message in a run from another participant', () => {
    const messages = [msg('1', 'u2', '2026-05-24T10:00:00.000Z')]
    const { getByText } = render(
      <MessageThread messages={messages} currentUserId="u1" participants={groupParticipants} />
    )
    expect(getByText('bob')).toBeTruthy()
  })

  it('shows avatar on the first message in a run from another participant', () => {
    const messages = [msg('1', 'u2', '2026-05-24T10:00:00.000Z')]
    const { container } = render(
      <MessageThread messages={messages} currentUserId="u1" participants={groupParticipants} />
    )
    expect(container.querySelector('img[alt="bob"]')).toBeTruthy()
  })

  it('does not show sender name on continuation messages from the same sender', () => {
    const messages = [
      msg('1', 'u2', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u2', '2026-05-24T10:00:05.000Z'),
    ]
    const { getAllByText } = render(
      <MessageThread messages={messages} currentUserId="u1" participants={groupParticipants} />
    )
    // "bob" should appear exactly once (name label), not twice
    expect(getAllByText('bob')).toHaveLength(1)
  })

  it('does not show sender name for own messages', () => {
    const messages = [msg('1', 'u1', '2026-05-24T10:00:00.000Z')]
    const { queryByText } = render(
      <MessageThread messages={messages} currentUserId="u1" participants={groupParticipants} />
    )
    expect(queryByText('alice')).toBeNull()
  })

  it('shows a new sender name after a run break', () => {
    const messages = [
      msg('1', 'u2', '2026-05-24T10:00:00.000Z'),
      msg('2', 'u2', '2026-05-24T10:00:05.000Z'),
      msg('3', 'u3', '2026-05-24T10:00:10.000Z'),
    ]
    const { getByText, getAllByText } = render(
      <MessageThread messages={messages} currentUserId="u1" participants={groupParticipants} />
    )
    expect(getAllByText('bob')).toHaveLength(1)
    expect(getByText('carol')).toBeTruthy()
  })

  it('does not show sender names in a 1-on-1 conversation', () => {
    const messages = [msg('1', 'u2', '2026-05-24T10:00:00.000Z')]
    const { queryByText } = render(
      <MessageThread messages={messages} currentUserId="u1" participants={[bob]} />
    )
    expect(queryByText('bob')).toBeNull()
  })

  it('does not show sender names when participants prop is omitted', () => {
    const messages = [msg('1', 'u2', '2026-05-24T10:00:00.000Z')]
    const { queryByText } = render(
      <MessageThread messages={messages} currentUserId="u1" />
    )
    expect(queryByText('bob')).toBeNull()
  })
})
