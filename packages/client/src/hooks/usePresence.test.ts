import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePresence } from './usePresence.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

const { socketHandlers, mockSocket } = vi.hoisted(() => {
  const socketHandlers: Record<string, ((...args: unknown[]) => void)[]> = {}
  const mockSocket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      socketHandlers[event] = socketHandlers[event] ?? []
      socketHandlers[event].push(handler)
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      socketHandlers[event] = (socketHandlers[event] ?? []).filter(h => h !== handler)
    }),
  }
  return { socketHandlers, mockSocket }
})

vi.mock('../lib/socket.js', () => ({ socket: mockSocket }))

function emit(event: string, payload: unknown) {
  socketHandlers[event]?.forEach(h => h(payload))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('usePresence', () => {
  beforeEach(() => {
    Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])
  })

  it('starts with an empty set', () => {
    const { result } = renderHook(() => usePresence())
    expect(result.current.size).toBe(0)
  })

  it('populates online users from presence:init', () => {
    const { result } = renderHook(() => usePresence())
    act(() => { emit('presence:init', { onlineUserIds: ['u1', 'u2'] }) })
    expect(result.current).toEqual(new Set(['u1', 'u2']))
  })

  it('replaces the full set on repeated presence:init', () => {
    const { result } = renderHook(() => usePresence())
    act(() => { emit('presence:init', { onlineUserIds: ['u1', 'u2'] }) })
    act(() => { emit('presence:init', { onlineUserIds: ['u3'] }) })
    expect(result.current).toEqual(new Set(['u3']))
  })

  it('adds a user on user:online', () => {
    const { result } = renderHook(() => usePresence())
    act(() => { emit('presence:init', { onlineUserIds: ['u1'] }) })
    act(() => { emit('user:online', { userId: 'u2' }) })
    expect(result.current).toEqual(new Set(['u1', 'u2']))
  })

  it('does not duplicate a user already in the set on user:online', () => {
    const { result } = renderHook(() => usePresence())
    act(() => { emit('presence:init', { onlineUserIds: ['u1'] }) })
    act(() => { emit('user:online', { userId: 'u1' }) })
    expect(result.current.size).toBe(1)
  })

  it('removes a user on user:offline', () => {
    const { result } = renderHook(() => usePresence())
    act(() => { emit('presence:init', { onlineUserIds: ['u1', 'u2'] }) })
    act(() => { emit('user:offline', { userId: 'u1' }) })
    expect(result.current).toEqual(new Set(['u2']))
  })

  it('is a no-op when user:offline fires for a user not in the set', () => {
    const { result } = renderHook(() => usePresence())
    act(() => { emit('presence:init', { onlineUserIds: ['u1'] }) })
    act(() => { emit('user:offline', { userId: 'u999' }) })
    expect(result.current).toEqual(new Set(['u1']))
  })
})
