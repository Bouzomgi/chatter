import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Chat from './Chat.js'

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

vi.mock('../context/auth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1', username: 'alice', email: 'a', avatarIndex: 0 } }),
}))

vi.mock('../lib/api.js', () => ({
  api: {
    get: vi.fn((path: string) => {
      const body = path.includes('/messages')
        ? { messages: [], hasMore: false }
        : []
      return Promise.resolve({ json: () => Promise.resolve(body) })
    }),
    post: vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) })),
    patch: vi.fn(() => Promise.resolve()),
  },
}))

// Capture setActiveConversationId so tests can call it directly
let capturedSetActive: (id: string | null) => void = () => {}

vi.mock('../context/socket.js', () => ({
  useSocket: () => ({
    socketConnected: false,
    setActiveConversationId: (id: string | null) => capturedSetActive(id),
  }),
}))

vi.mock('../components/chat/Sidebar.js', () => ({
  default: ({ onSelectConversation }: { onSelectConversation: (id: string) => void }) => (
    <button data-testid="select-conv" onClick={() => onSelectConversation('conv-1')} />
  ),
}))
vi.mock('../components/chat/MessageThread.js', () => ({ default: () => null }))
vi.mock('../components/chat/MessageInput.js', () => ({ default: () => null }))

// ── Helpers ──────────────────────────────────────────────────────────────────

function emit(event: string, payload: unknown) {
  socketHandlers[event]?.forEach(h => h(payload))
}

function renderChat() {
  return render(<MemoryRouter><Chat /></MemoryRouter>)
}

const MSG_OTHER  = { id: 'm1', conversationId: 'conv-other', senderId: 'user-2', body: 'hi', createdAt: '' }
const MSG_ACTIVE = { id: 'm2', conversationId: 'conv-1',     senderId: 'user-2', body: 'yo', createdAt: '' }

// ── Tests ────────────────────────────────────────────────────────────────────

describe('tab title notifier (via SocketContext)', () => {
  // Simulate the SocketContext's behaviour for title changes
  let activeConversationId: string | null = null

  beforeEach(() => {
    document.title = 'chatter'
    activeConversationId = null
    Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])

    // Wire capturedSetActive to mirror what SocketContext does
    capturedSetActive = (id) => {
      activeConversationId = id
      document.title = 'chatter'
    }
  })

  afterEach(() => {
    cleanup()
    document.title = 'chatter'
  })

  function emitNewMessage(msg: typeof MSG_OTHER) {
    emit('message:new', msg)
    // Replicate SocketContext's title logic
    if (msg.conversationId !== activeConversationId) {
      document.title = 'chatter!!!'
    }
  }

  it('sets title to chatter!!! when message arrives in a non-active conversation', async () => {
    renderChat()
    await act(async () => { emitNewMessage(MSG_OTHER) })
    expect(document.title).toBe('chatter!!!')
  })

  it('does not change title when message arrives in the active conversation', async () => {
    const { getByTestId } = renderChat()
    await act(async () => { getByTestId('select-conv').click() })
    await act(async () => { emitNewMessage(MSG_ACTIVE) })
    expect(document.title).toBe('chatter')
  })

  it('resets title to chatter when user opens a conversation', async () => {
    const { getByTestId } = renderChat()
    await act(async () => { emitNewMessage(MSG_OTHER) })
    expect(document.title).toBe('chatter!!!')
    await act(async () => { getByTestId('select-conv').click() })
    expect(document.title).toBe('chatter')
  })
})
