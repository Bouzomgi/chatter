import { useEffect, useReducer, useRef } from 'react'
import type { Conversation, Message, UserSummary } from '@chatter/shared'
import { useAuth } from '../context/auth.js'
import { useSocket } from '../context/socket.js'
import { api } from '../lib/api.js'
import { socket } from '../lib/socket.js'

interface State {
  conversations: Conversation[]
  messages: Record<string, Message[]>
  hasMore: Record<string, boolean>
  users: UserSummary[]
  activeConversationId: string | null
  savedConversationId: string | null
  pendingUsers: UserSummary[]
  showUserList: boolean
  loaded: boolean
}

type Action =
  | { type: 'SET_CONVERSATIONS'; conversations: Conversation[] }
  | { type: 'SET_MESSAGES'; conversationId: string; messages: Message[]; hasMore: boolean }
  | { type: 'PREPEND_MESSAGES'; conversationId: string; messages: Message[]; hasMore: boolean }
  | { type: 'APPEND_MESSAGE'; message: Message }
  | { type: 'SET_USERS'; users: UserSummary[] }
  | { type: 'SET_ACTIVE'; conversationId: string }
  | { type: 'UPSERT_CONVERSATION'; conversation: Conversation }
  | { type: 'TOGGLE_USER_LIST' }
  | { type: 'TOGGLE_PENDING_USER'; user: UserSummary }
  | { type: 'PREVIEW_CONVERSATION'; conversationId: string | null }
  | { type: 'CLEAR_PENDING_USERS' }
  | { type: 'MARK_UNREAD'; conversationId: string }
  | { type: 'MARK_READ'; conversationId: string }

function byLatestMessage(a: Conversation, b: Conversation) {
  const aTime = a.latestMessage?.createdAt ?? a.createdAt
  const bTime = b.latestMessage?.createdAt ?? b.createdAt
  return new Date(bTime).getTime() - new Date(aTime).getTime()
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: [...action.conversations].sort(byLatestMessage), loaded: true }
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: { ...state.messages, [action.conversationId]: action.messages },
        hasMore: { ...state.hasMore, [action.conversationId]: action.hasMore },
      }
    case 'PREPEND_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.conversationId]: [...action.messages, ...(state.messages[action.conversationId] ?? [])],
        },
        hasMore: { ...state.hasMore, [action.conversationId]: action.hasMore },
      }
    case 'APPEND_MESSAGE': {
      const existing = state.messages[action.message.conversationId] ?? []
      if (existing.some(m => m.id === action.message.id)) return state
      const updated = state.conversations.map(c =>
        c.id === action.message.conversationId
          ? { ...c, latestMessage: { body: action.message.body, senderId: action.message.senderId, createdAt: action.message.createdAt } }
          : c
      )
      return {
        ...state,
        messages: { ...state.messages, [action.message.conversationId]: [...existing, action.message] },
        conversations: updated.sort(byLatestMessage),
      }
    }
    case 'SET_USERS':
      return { ...state, users: action.users }
    case 'SET_ACTIVE':
      return { ...state, activeConversationId: action.conversationId, showUserList: false, pendingUsers: [], savedConversationId: null }
    case 'UPSERT_CONVERSATION': {
      const exists = state.conversations.some(c => c.id === action.conversation.id)
      const conversations = exists
        ? state.conversations
        : [...state.conversations, action.conversation].sort(byLatestMessage)
      return { ...state, conversations, activeConversationId: action.conversation.id, showUserList: false, pendingUsers: [], savedConversationId: null }
    }
    case 'TOGGLE_USER_LIST':
      if (!state.showUserList) {
        // entering user list: save current selection and clear it
        return { ...state, showUserList: true, pendingUsers: [], savedConversationId: state.activeConversationId, activeConversationId: null }
      } else {
        // leaving user list: always restore the saved selection
        return { ...state, showUserList: false, pendingUsers: [], activeConversationId: state.savedConversationId, savedConversationId: null }
      }
    case 'TOGGLE_PENDING_USER': {
      const exists = state.pendingUsers.some(u => u.id === action.user.id)
      return {
        ...state,
        pendingUsers: exists
          ? state.pendingUsers.filter(u => u.id !== action.user.id)
          : [...state.pendingUsers, action.user],
      }
    }
    case 'PREVIEW_CONVERSATION':
      return { ...state, activeConversationId: action.conversationId }
    case 'CLEAR_PENDING_USERS':
      return { ...state, pendingUsers: [] }
    case 'MARK_UNREAD':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId ? { ...c, unread: true } : c
        ),
      }
    case 'MARK_READ':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId ? { ...c, unread: false } : c
        ),
      }
    default:
      return state
  }
}

const initialState: State = {
  conversations: [],
  messages: {},
  hasMore: {},
  users: [],
  activeConversationId: null,
  savedConversationId: null,
  pendingUsers: [],
  showUserList: false,
  loaded: false,
}

export function useChat() {
  const { user } = useAuth()
  const { setActiveConversationId } = useSocket()
  const [state, dispatch] = useReducer(reducer, initialState)
  const activeConvRef = useRef<string | null>(null)
  const hasAutoSelectedRef = useRef(false)
  const userRef = useRef(user)

  useEffect(() => {
    userRef.current = user
  }, [user])

  // Auto-select the first conversation once on initial load. The ref prevents
  // re-selection after the user manually navigates away. The effect re-runs on
  // every conversations update but the ref guards make the body a no-op after
  // the first selection fires.
  useEffect(() => {
    if (!hasAutoSelectedRef.current && state.conversations.length > 0 && state.activeConversationId === null) {
      hasAutoSelectedRef.current = true
      selectConversation(state.conversations[0].id)
    }
  // selectConversation is stable across renders given the same dispatch/refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.conversations])

  useEffect(() => {
    api.get('/conversations')
      .then(r => r.json())
      .then((conversations: Conversation[]) => dispatch({ type: 'SET_CONVERSATIONS', conversations }))

    function refetchConversations() {
      api.get('/conversations')
        .then(r => r.json())
        .then((conversations: Conversation[]) => dispatch({ type: 'SET_CONVERSATIONS', conversations }))
    }

    // Re-fetch on reconnect so conversations created while disconnected become visible.
    socket.io.on('reconnect', refetchConversations)

    function onMessageNew(message: Message) {
      dispatch({ type: 'APPEND_MESSAGE', message })
      if (message.conversationId === activeConvRef.current) {
        api.patch(`/conversations/${message.conversationId}/read`)
      } else if (message.senderId !== userRef.current!.id) {
        dispatch({ type: 'MARK_UNREAD', conversationId: message.conversationId })
      }
    }

    socket.on('message:new', onMessageNew)

    return () => {
      socket.off('message:new', onMessageNew)
      socket.io.off('reconnect', refetchConversations)
      setActiveConversationId(null)
    }
  // Intentionally runs once on mount; setActiveConversationId is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchMessages(id: string) {
    const data: { messages: Message[]; hasMore: boolean } = await api
      .get(`/conversations/${id}/messages`)
      .then(r => r.json())
    dispatch({ type: 'SET_MESSAGES', conversationId: id, messages: data.messages, hasMore: data.hasMore })
  }

  async function selectConversation(id: string) {
    if (!state.messages[id]) {
      await fetchMessages(id)
    }
    dispatch({ type: 'SET_ACTIVE', conversationId: id })
    dispatch({ type: 'MARK_READ', conversationId: id })
    activeConvRef.current = id
    setActiveConversationId(id)
    api.patch(`/conversations/${id}/read`)
  }

  async function loadMore(id: string) {
    const msgs = state.messages[id] ?? []
    const oldest = msgs[0]
    if (!oldest) return
    const data: { messages: Message[]; hasMore: boolean } = await api
      .get(`/conversations/${id}/messages?before=${oldest.id}`)
      .then(r => r.json())
    dispatch({ type: 'PREPEND_MESSAGES', conversationId: id, messages: data.messages, hasMore: data.hasMore })
  }

  async function togglePendingUser(u: UserSummary) {
    const exists = state.pendingUsers.some(p => p.id === u.id)
    const newPending = exists
      ? state.pendingUsers.filter(p => p.id !== u.id)
      : [...state.pendingUsers, u]

    dispatch({ type: 'TOGGLE_PENDING_USER', user: u })

    if (newPending.length === 0) {
      dispatch({ type: 'PREVIEW_CONVERSATION', conversationId: null })
      return
    }

    const match = state.conversations.find(c =>
      c.participants.length === newPending.length &&
      newPending.every(pu => c.participants.some(p => p.id === pu.id))
    )

    dispatch({ type: 'PREVIEW_CONVERSATION', conversationId: match?.id ?? null })

    if (match && !state.messages[match.id]) {
      const data: { messages: Message[]; hasMore: boolean } = await api
        .get(`/conversations/${match.id}/messages`)
        .then(r => r.json())
      dispatch({ type: 'SET_MESSAGES', conversationId: match.id, messages: data.messages, hasMore: data.hasMore })
    }
  }

  async function handleToggleUserList() {
    if (!state.showUserList && state.users.length === 0) {
      const users: UserSummary[] = await api.get('/users').then(r => r.json())
      dispatch({ type: 'SET_USERS', users })
    }
    dispatch({ type: 'TOGGLE_USER_LIST' })
  }

  async function sendMessage(body: string) {
    if (state.pendingUsers.length > 0) {
      const conversation: Conversation = await api
        .post('/conversations', { participantIds: state.pendingUsers.map(u => u.id) })
        .then(r => r.json())
      const message: Message = await api
        .post(`/conversations/${conversation.id}/messages`, { body })
        .then(r => r.json())
      // Socket won't deliver message:new for a brand-new room (joined at connect
      // time, before this conversation existed), so append it directly.
      dispatch({ type: 'UPSERT_CONVERSATION', conversation })
      dispatch({ type: 'APPEND_MESSAGE', message })
      activeConvRef.current = conversation.id
      setActiveConversationId(conversation.id)
      api.patch(`/conversations/${conversation.id}/read`)
      return
    }
    const id = state.activeConversationId
    if (!id) return
    const message: Message = await api.post(`/conversations/${id}/messages`, { body }).then(r => r.json())
    dispatch({ type: 'APPEND_MESSAGE', message })
  }

  const activeMessages = state.activeConversationId
    ? (state.messages[state.activeConversationId] ?? null)
    : null

  const activeHasMore = state.activeConversationId
    ? (state.hasMore[state.activeConversationId] ?? false)
    : false

  const activeConversation = state.conversations.find(c => c.id === state.activeConversationId)

  return {
    state,
    activeMessages,
    activeHasMore,
    activeConversation,
    pendingUsers: state.pendingUsers,
    selectConversation,
    loadMore,
    togglePendingUser,
    handleToggleUserList,
    sendMessage,
  }
}
