import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { SocketProvider, useSocket } from './socket.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

const { socketHandlers, mockSocket } = vi.hoisted(() => {
  const socketHandlers: Record<string, ((...args: unknown[]) => void)[]> = {}
  const mockSocket = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      socketHandlers[event] = socketHandlers[event] ?? []
      socketHandlers[event].push(handler)
    }),
    off: vi.fn((event: string) => { delete socketHandlers[event] }),
  }
  return { socketHandlers, mockSocket }
})

vi.mock('../lib/socket.js', () => ({ socket: mockSocket }))

vi.mock('./auth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1', username: 'alice', email: 'a', avatarIndex: 0 } }),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function emit(event: string, payload: unknown) {
  socketHandlers[event]?.forEach(h => h(payload))
}

// Minimal consumer that exposes setActiveConversationId to tests
let testSetActive: (id: string | null) => void = () => {}
function Consumer() {
  const { setActiveConversationId } = useSocket()
  testSetActive = setActiveConversationId
  return null
}

function renderProvider() {
  return render(
    <SocketProvider>
      <Consumer />
    </SocketProvider>
  )
}

const MSG_OTHER  = { id: 'm1', conversationId: 'conv-other', senderId: 'user-2', body: 'hi', createdAt: '' }
const MSG_ACTIVE = { id: 'm2', conversationId: 'conv-1',     senderId: 'user-2', body: 'yo', createdAt: '' }

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SocketContext tab title', () => {
  beforeEach(() => {
    document.title = 'chatter'
    Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])
  })

  afterEach(() => {
    cleanup()
    document.title = 'chatter'
  })

  it('sets title to chatter!!! when message arrives in a non-active conversation', async () => {
    renderProvider()
    await act(async () => { emit('message:new', MSG_OTHER) })
    expect(document.title).toBe('chatter!!!')
  })

  it('does not change title when message arrives in the active conversation', async () => {
    renderProvider()
    await act(async () => { testSetActive('conv-1') })
    await act(async () => { emit('message:new', MSG_ACTIVE) })
    expect(document.title).toBe('chatter')
  })

  it('resets title to chatter when setActiveConversationId is called', async () => {
    renderProvider()
    await act(async () => { emit('message:new', MSG_OTHER) })
    expect(document.title).toBe('chatter!!!')
    await act(async () => { testSetActive('conv-1') })
    expect(document.title).toBe('chatter')
  })
})
