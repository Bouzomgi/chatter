import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useChat } from './useChat.js'
import type { Conversation, Message, UserSummary } from '@chatter/shared'

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
    io: {
      on: vi.fn(),
      off: vi.fn(),
    },
  }
  return { socketHandlers, mockSocket }
})

vi.mock('../lib/socket.js', () => ({ socket: mockSocket }))

const mockSetActiveConversationId = vi.fn()
vi.mock('../context/socket.js', () => ({
  useSocket: () => ({ setActiveConversationId: mockSetActiveConversationId }),
}))

vi.mock('../context/auth.js', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'alice', email: 'a@example.com', avatarIndex: 0, createdAt: '' },
  }),
}))

const { mockApi } = vi.hoisted(() => ({ mockApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
vi.mock('../lib/api.js', () => ({ api: mockApi }))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const bob: UserSummary   = { id: 'user-2', username: 'bob',   avatarIndex: 1 }
const carol: UserSummary = { id: 'user-3', username: 'carol', avatarIndex: 2 }

const conv1: Conversation = {
  id: 'conv-1',
  createdAt: '2024-01-01T10:00:00Z',
  participants: [bob],
  latestMessage: { body: 'hello', senderId: 'user-2', createdAt: '2024-01-01T10:00:00Z' },
  unread: false,
}

const conv2: Conversation = {
  id: 'conv-2',
  createdAt: '2024-01-01T09:00:00Z',
  participants: [carol],
  latestMessage: { body: 'hey', senderId: 'user-3', createdAt: '2024-01-01T09:00:00Z' },
  unread: true,
}

function makeMsg(override: Partial<Message> = {}): Message {
  return { id: 'm1', conversationId: 'conv-1', senderId: 'user-2', body: 'hi', createdAt: '2024-01-01T10:00:00Z', ...override }
}

const noMessages = { messages: [], hasMore: false }
const someMsgs   = { messages: [makeMsg()], hasMore: false }

function emitSocket(event: string, payload: unknown) {
  socketHandlers[event]?.forEach(h => h(payload))
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])
  mockSetActiveConversationId.mockReset()
  mockApi.patch.mockResolvedValue({})
  // Default: one conversation, empty messages
  mockApi.get.mockImplementation((path: string) => {
    if (path === '/conversations')
      return Promise.resolve({ json: () => Promise.resolve([conv1]) })
    if (path === '/conversations/conv-1/messages')
      return Promise.resolve({ json: () => Promise.resolve(noMessages) })
    if (path === '/conversations/conv-2/messages')
      return Promise.resolve({ json: () => Promise.resolve(noMessages) })
    if (path === '/users')
      return Promise.resolve({ json: () => Promise.resolve([bob, carol]) })
    return Promise.resolve({ json: () => Promise.resolve(null) })
  })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useChat — initial load', () => {
  it('fetches conversations on mount and marks loaded', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))
    expect(result.current.state.conversations).toHaveLength(1)
    expect(result.current.state.conversations[0].id).toBe('conv-1')
  })

  it('auto-selects the first conversation after load', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))
    expect(mockSetActiveConversationId).toHaveBeenCalledWith('conv-1')
  })

  it('does not auto-select if there are no conversations', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([]) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))
    expect(result.current.state.activeConversationId).toBeNull()
  })
})

describe('useChat — selectConversation', () => {
  it('fetches messages and activates the conversation', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1, conv2]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(someMsgs) })
      if (path === '/conversations/conv-2/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    // Wait for auto-select of conv-1
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    await act(async () => { await result.current.selectConversation('conv-2') })

    expect(result.current.state.activeConversationId).toBe('conv-2')
    expect(mockApi.get).toHaveBeenCalledWith('/conversations/conv-2/messages')
  })

  it('does not re-fetch messages if already cached', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1, conv2]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(someMsgs) })
      if (path === '/conversations/conv-2/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    const getCallsBefore = mockApi.get.mock.calls.length
    await act(async () => { await result.current.selectConversation('conv-1') })

    const getCallsAfter = mockApi.get.mock.calls.length
    expect(getCallsAfter).toBe(getCallsBefore) // no new fetch
  })

  it('calls PATCH read and sets activeConversationId on the socket context', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))
    expect(mockApi.patch).toHaveBeenCalledWith('/conversations/conv-1/read')
    expect(mockSetActiveConversationId).toHaveBeenCalledWith('conv-1')
  })
})

describe('useChat — loadMore', () => {
  it('prepends older messages', async () => {
    const older = makeMsg({ id: 'm-old', body: 'older message', createdAt: '2024-01-01T09:00:00Z' })
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(someMsgs) })
      if (path === '/conversations/conv-1/messages?before=m1') return Promise.resolve({ json: () => Promise.resolve({ messages: [older], hasMore: false }) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.activeMessages).toHaveLength(1))

    await act(async () => { await result.current.loadMore('conv-1') })

    expect(result.current.activeMessages).toHaveLength(2)
    expect(result.current.activeMessages![0].id).toBe('m-old')
    expect(result.current.activeMessages![1].id).toBe('m1')
  })

  it('updates hasMore flag after load', async () => {
    const older = makeMsg({ id: 'm-old' })
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(someMsgs) })
      if (path === '/conversations/conv-1/messages?before=m1') return Promise.resolve({ json: () => Promise.resolve({ messages: [older], hasMore: true }) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.activeMessages).toHaveLength(1))

    await act(async () => { await result.current.loadMore('conv-1') })
    expect(result.current.activeHasMore).toBe(true)
  })
})

describe('useChat — socket message:new', () => {
  it('appends incoming message to the conversation', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    const incomingMsg = makeMsg({ id: 'm-incoming', senderId: 'user-2' })
    act(() => { emitSocket('message:new', incomingMsg) })

    expect(result.current.activeMessages).toHaveLength(1)
    expect(result.current.activeMessages![0].id).toBe('m-incoming')
  })

  it('marks conversation unread when message arrives in a non-active conversation', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1, conv2]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      if (path === '/conversations/conv-2/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    const msgForConv2 = makeMsg({ id: 'm-2', conversationId: 'conv-2', senderId: 'user-3' })
    act(() => { emitSocket('message:new', msgForConv2) })

    const c2 = result.current.state.conversations.find(c => c.id === 'conv-2')
    expect(c2?.unread).toBe(true)
  })

  it('calls PATCH read when message arrives in the active conversation', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    mockApi.patch.mockReset()
    const incomingMsg = makeMsg({ id: 'm-in', senderId: 'user-2' })
    act(() => { emitSocket('message:new', incomingMsg) })

    expect(mockApi.patch).toHaveBeenCalledWith('/conversations/conv-1/read')
  })

  // NOTE: own messages sent to existing conversations do NOT appear immediately.
  // sendMessage() only POSTs to the API; the message is appended via the socket
  // echo. If the socket delivery is slow or fails the sender won't see their
  // own message until it arrives.
  it('does not mark conversation unread when the incoming message is from the current user', async () => {
    const conv2Read: Conversation = { ...conv2, unread: false }
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1, conv2Read]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      if (path === '/conversations/conv-2/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    // Own message arrives on conv-2 (e.g. sent from another tab)
    const ownMsg = makeMsg({ id: 'm-own', conversationId: 'conv-2', senderId: 'user-1' })
    act(() => { emitSocket('message:new', ownMsg) })

    const c2 = result.current.state.conversations.find(c => c.id === 'conv-2')
    expect(c2?.unread).toBe(false)
  })
})

describe('useChat — sendMessage', () => {
  it('posts to the active conversation when there are no pending users', async () => {
    mockApi.post.mockResolvedValue({ json: () => Promise.resolve(makeMsg()) })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    await act(async () => { await result.current.sendMessage('hello') })

    expect(mockApi.post).toHaveBeenCalledWith('/conversations/conv-1/messages', { body: 'hello' })
  })

  it('is a no-op when there is no active conversation and no pending users', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([]) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))

    mockApi.post.mockReset()
    await act(async () => { await result.current.sendMessage('hello') })

    expect(mockApi.post).not.toHaveBeenCalled()
  })

  it('creates a conversation then sends the message when pending users are set', async () => {
    const newConv: Conversation = { ...conv2, id: 'conv-new' }
    const newMsg = makeMsg({ id: 'm-new', conversationId: 'conv-new' })
    mockApi.post
      .mockResolvedValueOnce({ json: () => Promise.resolve(newConv) })  // POST /conversations
      .mockResolvedValueOnce({ json: () => Promise.resolve(newMsg) })   // POST /conversations/conv-new/messages

    // Simulate user list: handleToggleUserList then togglePendingUser(carol)
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([]) })
      if (path === '/users') return Promise.resolve({ json: () => Promise.resolve([carol]) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })

    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))

    await act(async () => { await result.current.handleToggleUserList() })
    await act(async () => { await result.current.togglePendingUser(carol) })
    await act(async () => { await result.current.sendMessage('hi carol') })

    expect(mockApi.post).toHaveBeenCalledWith('/conversations', { participantIds: ['user-3'] })
    expect(mockApi.post).toHaveBeenCalledWith('/conversations/conv-new/messages', { body: 'hi carol' })
    expect(result.current.state.activeConversationId).toBe('conv-new')
  })
})

describe('useChat — togglePendingUser', () => {
  beforeEach(async () => {
    // Start in user list mode with no conversations
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([]) })
      if (path === '/users') return Promise.resolve({ json: () => Promise.resolve([bob, carol]) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
  })

  it('adds a user to pendingUsers', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))
    await act(async () => { await result.current.handleToggleUserList() })

    await act(async () => { await result.current.togglePendingUser(bob) })
    expect(result.current.pendingUsers).toHaveLength(1)
    expect(result.current.pendingUsers[0].id).toBe('user-2')
  })

  it('removes a user who is already pending', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))
    await act(async () => { await result.current.handleToggleUserList() })

    await act(async () => { await result.current.togglePendingUser(bob) })
    await act(async () => { await result.current.togglePendingUser(bob) })
    expect(result.current.pendingUsers).toHaveLength(0)
  })

  it('previews an existing conversation when pending users match exactly', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      if (path === '/users') return Promise.resolve({ json: () => Promise.resolve([bob]) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    // Wait for auto-select
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))
    await act(async () => { await result.current.handleToggleUserList() })

    await act(async () => { await result.current.togglePendingUser(bob) })

    // conv-1 has exactly [bob] as participants, matching the pending selection
    expect(result.current.state.activeConversationId).toBe('conv-1')
  })

  // NOTE: when no conversation matches the pending users, activeConversationId
  // is set to null. The chat area goes blank ("Select one or more people").
  // This is intentional — selecting users that don't have an existing conversation
  // clears the main panel.
  it('sets activeConversationId to null when pending users have no existing conversation', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))
    await act(async () => { await result.current.handleToggleUserList() })

    await act(async () => { await result.current.togglePendingUser(carol) })
    expect(result.current.state.activeConversationId).toBeNull()
  })
})

describe('useChat — handleToggleUserList', () => {
  it('fetches users the first time the list is opened', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))

    await act(async () => { await result.current.handleToggleUserList() })

    expect(mockApi.get).toHaveBeenCalledWith('/users')
    expect(result.current.state.users).toHaveLength(2)
  })

  it('does not re-fetch users if already loaded', async () => {
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.loaded).toBe(true))

    await act(async () => { await result.current.handleToggleUserList() })
    await act(async () => { await result.current.handleToggleUserList() }) // close
    const getCallsAfterFirst = mockApi.get.mock.calls.filter(c => c[0] === '/users').length

    await act(async () => { await result.current.handleToggleUserList() }) // reopen
    const getCallsAfterSecond = mockApi.get.mock.calls.filter(c => c[0] === '/users').length

    expect(getCallsAfterSecond).toBe(getCallsAfterFirst) // no extra fetch
  })

  it('saves and restores the active conversation when toggling the user list', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      if (path === '/users') return Promise.resolve({ json: () => Promise.resolve([bob]) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    await act(async () => { await result.current.handleToggleUserList() })
    expect(result.current.state.activeConversationId).toBeNull()

    await act(async () => { await result.current.handleToggleUserList() })
    expect(result.current.state.activeConversationId).toBe('conv-1')
  })

  // NOTE: closing the user list after previewing a different conversation
  // navigates to the previewed conversation, not the original one. Selecting users
  // whose conversation exists and then dismissing the panel moves to that conversation.
  it('does not restore saved conversation when user list closed after a preview', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/conversations') return Promise.resolve({ json: () => Promise.resolve([conv1, conv2]) })
      if (path === '/conversations/conv-1/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      if (path === '/conversations/conv-2/messages') return Promise.resolve({ json: () => Promise.resolve(noMessages) })
      if (path === '/users') return Promise.resolve({ json: () => Promise.resolve([bob, carol]) })
      return Promise.resolve({ json: () => Promise.resolve(null) })
    })
    const { result } = renderHook(() => useChat())
    await waitFor(() => expect(result.current.state.activeConversationId).toBe('conv-1'))

    await act(async () => { await result.current.handleToggleUserList() })
    // Preview conv-2 by selecting carol
    await act(async () => { await result.current.togglePendingUser(carol) })
    expect(result.current.state.activeConversationId).toBe('conv-2')

    // Close user list without sending — lands on conv-2, not the original conv-1
    await act(async () => { await result.current.handleToggleUserList() })
    expect(result.current.state.activeConversationId).toBe('conv-2')
  })
})
