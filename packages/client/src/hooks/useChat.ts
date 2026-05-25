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
      return { ...state, activeConversationId: action.conversationId, showUserList: false }
    case 'UPSERT_CONVERSATION': {
      const exists = state.conversations.some(c => c.id === action.conversation.id)
      const conversations = exists
        ? state.conversations
        : [...state.conversations, action.conversation].sort(byLatestMessage)
      return { ...state, conversations, activeConversationId: action.conversation.id, showUserList: false }
    }
    case 'TOGGLE_USER_LIST':
      return { ...state, showUserList: !state.showUserList }
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

  async function selectUser(u: UserSummary) {
    const conversation: Conversation = await api
      .post('/conversations', { targetUserId: u.id })
      .then(r => r.json())
    if (!state.messages[conversation.id]) {
      await fetchMessages(conversation.id)
    }
    dispatch({ type: 'UPSERT_CONVERSATION', conversation })
    activeConvRef.current = conversation.id
    setActiveConversationId(conversation.id)
    api.patch(`/conversations/${conversation.id}/read`)
  }

  async function handleToggleUserList() {
    if (!state.showUserList && state.users.length === 0) {
      const users: UserSummary[] = await api.get('/users').then(r => r.json())
      dispatch({ type: 'SET_USERS', users })
    }
    dispatch({ type: 'TOGGLE_USER_LIST' })
  }

  async function sendMessage(body: string) {
    const id = state.activeConversationId
    if (!id) return
    await api.post(`/conversations/${id}/messages`, { body })
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
    selectConversation,
    loadMore,
    selectUser,
    handleToggleUserList,
    sendMessage,
  }
}
