import { describe, it, expect } from 'vitest'
import { formatParticipantNames } from './formatParticipantNames.js'

describe('formatParticipantNames', () => {
  it('returns empty string for empty array', () => {
    expect(formatParticipantNames([])).toBe('')
  })

  it('returns the single name as-is', () => {
    expect(formatParticipantNames(['alice'])).toBe('alice')
  })

  it('joins two names with &', () => {
    expect(formatParticipantNames(['alice', 'bob'])).toBe('alice & bob')
  })

  it('sorts two names alphabetically before joining', () => {
    expect(formatParticipantNames(['bob', 'alice'])).toBe('alice & bob')
  })

  it('joins three names with commas and & before last', () => {
    expect(formatParticipantNames(['alice', 'bob', 'carol'])).toBe('alice, bob & carol')
  })

  it('sorts three names alphabetically', () => {
    expect(formatParticipantNames(['carol', 'alice', 'bob'])).toBe('alice, bob & carol')
  })

  it('joins four names correctly', () => {
    expect(formatParticipantNames(['dave', 'alice', 'carol', 'bob'])).toBe('alice, bob, carol & dave')
  })

  it('does not mutate the input array', () => {
    const names = ['charlie', 'alice', 'bob']
    formatParticipantNames(names)
    expect(names).toEqual(['charlie', 'alice', 'bob'])
  })
})
