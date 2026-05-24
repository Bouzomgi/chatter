import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ConversationItem from './ConversationItem.js'
import type { Conversation } from '@chatter/shared'

vi.mock('../../lib/avatars.js', () => ({ getAvatarSrc: () => '/avatar.png' }))

// Frozen to Sunday 2026-05-24 at 3:00 PM UTC (TZ=UTC set in vitest.config)
const NOW = new Date('2026-05-24T15:00:00.000Z')

const base: Conversation = {
  id: 'c1',
  createdAt: '2026-05-01T00:00:00.000Z',
  otherUser: { id: 'u2', username: 'bob', avatarIndex: 0 },
  latestMessage: null,
  unread: false,
}

function makeConv(createdAt: string): Conversation {
  return { ...base, latestMessage: { body: 'hey', senderId: 'u2', createdAt } }
}

describe('ConversationItem timestamp', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('shows no timestamp when there is no latest message', () => {
    const { queryByText } = render(
      <ConversationItem conversation={base} isActive={false} onClick={() => {}} />
    )
    expect(queryByText(/AM|PM|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\d+\/\d+/)).toBeNull()
  })

  it('shows time for a same-day message', () => {
    const { getByText } = render(
      <ConversationItem conversation={makeConv('2026-05-24T10:00:00.000Z')} isActive={false} onClick={() => {}} />
    )
    expect(getByText('10:00 AM')).toBeTruthy()
  })

  it('shows weekday for a message earlier this week', () => {
    const { getByText } = render(
      <ConversationItem conversation={makeConv('2026-05-23T10:00:00.000Z')} isActive={false} onClick={() => {}} />
    )
    expect(getByText('Saturday')).toBeTruthy()
  })

  it('shows short date for a message 7+ days old', () => {
    const { getByText } = render(
      <ConversationItem conversation={makeConv('2026-05-17T10:00:00.000Z')} isActive={false} onClick={() => {}} />
    )
    expect(getByText('5/17/26')).toBeTruthy()
  })
})
