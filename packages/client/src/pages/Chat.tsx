import { useEffect, useReducer } from 'react'
import type { Conversation, Message, UserSummary } from '@chatter/shared'
import { useAuth } from '../context/auth.js'
import { useSocket } from '../context/socket.js'
import { api } from '../lib/api.js'
import { socket } from '../lib/socket.js'
import Sidebar from '../components/chat/Sidebar.js'
import MessageThread from '../components/chat/MessageThread.js'
import MessageInput from '../components/chat/MessageInput.js'

interface State {
  conversations: Conversation[]
  messages: Record<string, Message[]>
  users: UserSummary[]
  activeConversationId: string | null
  showUserList: boolean
}

type Action =
  | { type: 'SET_CONVERSATIONS'; conversations: Conversation[] }
  | { type: 'SET_MESSAGES'; conversationId: string; messages: Message[] }
  | { type: 'APPEND_MESSAGE'; message: Message }
  | { type: 'SET_USERS'; users: UserSummary[] }
  | { type: 'SET_ACTIVE'; conversationId: string }
  | { type: 'UPSERT_CONVERSATION'; conversation: Conversation }
  | { type: 'TOGGLE_USER_LIST' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.conversations }
    case 'SET_MESSAGES':
      return { ...state, messages: { ...state.messages, [action.conversationId]: action.messages } }
    case 'APPEND_MESSAGE': {
      const existing = state.messages[action.message.conversationId] ?? []
      return {
        ...state,
        messages: { ...state.messages, [action.message.conversationId]: [...existing, action.message] },
        conversations: state.conversations.map(c =>
          c.id === action.message.conversationId
            ? { ...c, latestMessage: { body: action.message.body, senderId: action.message.senderId, createdAt: action.message.createdAt } }
            : c
        ),
      }
    }
    case 'SET_USERS':
      return { ...state, users: action.users }
    case 'SET_ACTIVE':
      return { ...state, activeConversationId: action.conversationId, showUserList: false }
    case 'UPSERT_CONVERSATION': {
      const exists = state.conversations.some(c => c.id === action.conversation.id)
      return {
        ...state,
        conversations: exists
          ? state.conversations
          : [action.conversation, ...state.conversations],
        activeConversationId: action.conversation.id,
        showUserList: false,
      }
    }
    case 'TOGGLE_USER_LIST':
      return { ...state, showUserList: !state.showUserList }
    default:
      return state
  }
}

const initialState: State = {
  conversations: [],
  messages: {},
  users: [],
  activeConversationId: null,
  showUserList: false,
}

export default function Chat() {
  const { user } = useAuth()
  const { socketConnected, setActiveConversationId } = useSocket()
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    api.get('/conversations')
      .then(r => r.json())
      .then((conversations: Conversation[]) => dispatch({ type: 'SET_CONVERSATIONS', conversations }))

    function onMessageNew(message: Message) {
      dispatch({ type: 'APPEND_MESSAGE', message })
    }

    socket.on('message:new', onMessageNew)

    return () => {
      socket.off('message:new', onMessageNew)
      setActiveConversationId(null)
    }
  }, [])

  async function selectConversation(id: string) {
    if (!state.messages[id]) {
      const messages: Message[] = await api.get(`/conversations/${id}/messages`).then(r => r.json())
      dispatch({ type: 'SET_MESSAGES', conversationId: id, messages })
    }
    dispatch({ type: 'SET_ACTIVE', conversationId: id })
    setActiveConversationId(id)
  }

  async function selectUser(u: UserSummary) {
    const conversation: Conversation = await api
      .post('/conversations', { targetUserId: u.id })
      .then(r => r.json())
    if (!state.messages[conversation.id]) {
      const messages: Message[] = await api
        .get(`/conversations/${conversation.id}/messages`)
        .then(r => r.json())
      dispatch({ type: 'SET_MESSAGES', conversationId: conversation.id, messages })
    }
    dispatch({ type: 'UPSERT_CONVERSATION', conversation })
    setActiveConversationId(conversation.id)
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

  const activeConversation = state.conversations.find(c => c.id === state.activeConversationId)

  return (
    <div className="flex h-full w-full" data-socket-connected={socketConnected ? 'true' : 'false'}>
      <Sidebar
        conversations={state.conversations}
        users={state.users}
        activeConversationId={state.activeConversationId}
        showUserList={state.showUserList}
        onSelectConversation={selectConversation}
        onSelectUser={selectUser}
        onToggleUserList={handleToggleUserList}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {activeConversation ? (
          <>
            <div className="h-[60px] shrink-0 flex items-center px-6 border-b-2 border-gray-300 w-[93%] mx-auto">
              <span className="text-[18px] font-semibold">{activeConversation.otherUser.username}</span>
            </div>
            {activeMessages !== null && (
              <MessageThread messages={activeMessages} currentUserId={user!.id} />
            )}
            <MessageInput onSend={sendMessage} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-[18px]">
            select a conversation
          </div>
        )}
      </div>
    </div>
  )
}
