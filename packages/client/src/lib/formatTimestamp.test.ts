import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatConversationTime, formatMessageTimestamp } from './formatTimestamp.js'

// Frozen to Sunday 2026-05-24 at 3:00 PM UTC (TZ=UTC set in vitest.config)
const NOW = new Date('2026-05-24T15:00:00.000Z')

describe('formatConversationTime', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => vi.useRealTimers())

  it('shows time for a same-day message', () => {
    expect(formatConversationTime('2026-05-24T10:00:00.000Z')).toBe('10:00 AM')
  })

  it('shows weekday for messages within the past 7 days', () => {
    expect(formatConversationTime('2026-05-23T10:00:00.000Z')).toBe('Saturday') // 1 day ago
    expect(formatConversationTime('2026-05-18T10:00:00.000Z')).toBe('Monday')   // 6 days ago
  })

  it('shows short date for messages exactly 7 days old', () => {
    expect(formatConversationTime('2026-05-17T10:00:00.000Z')).toBe('5/17/26')
  })

  it('shows short date for messages older than 7 days', () => {
    expect(formatConversationTime('2026-01-01T10:00:00.000Z')).toBe('1/1/26')
  })
})

describe('formatMessageTimestamp', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => vi.useRealTimers())

  it('shows time only for a same-day message', () => {
    expect(formatMessageTimestamp('2026-05-24T10:00:00.000Z')).toBe('10:00 AM')
  })

  it('shows weekday and time for messages within the past 7 days', () => {
    expect(formatMessageTimestamp('2026-05-23T10:00:00.000Z')).toBe('Saturday 10:00 AM')
    expect(formatMessageTimestamp('2026-05-18T10:00:00.000Z')).toBe('Monday 10:00 AM')
  })

  it('shows abbreviated date at time for messages exactly 7 days old', () => {
    expect(formatMessageTimestamp('2026-05-17T10:00:00.000Z')).toBe('Sun, May 17 at 10:00 AM')
  })

  it('shows abbreviated date at time for messages older than 7 days', () => {
    expect(formatMessageTimestamp('2026-01-01T10:00:00.000Z')).toBe('Thu, Jan 1 at 10:00 AM')
  })
})
