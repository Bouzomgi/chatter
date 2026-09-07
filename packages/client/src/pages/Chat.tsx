import { formatParticipantNames } from '../lib/formatParticipantNames.js'
import { useAuth } from '../context/auth.js'
import { useSocket } from '../context/socket.js'
import { useChat } from '../hooks/useChat.js'
import { usePresence } from '../hooks/usePresence.js'
import Sidebar from '../components/chat/Sidebar.js'
import MessageThread from '../components/chat/MessageThread.js'
import MessageInput from '../components/chat/MessageInput.js'

export default function Chat() {
  const { user } = useAuth()
  const { socketConnected } = useSocket()
  const onlineUserIds = usePresence()
  const {
    state,
    activeMessages,
    activeHasMore,
    activeConversation,
    pendingUsers,
    selectConversation,
    loadMore,
    togglePendingUser,
    handleToggleUserList,
    sendMessage,
  } = useChat()

  const participants = activeConversation?.participants ?? pendingUsers
  const displayName = formatParticipantNames(participants.map(p => p.username))
  const anyOnline = activeConversation?.participants.some(p => onlineUserIds.has(p.id)) ?? false

  return (
    <div className="flex h-full w-full" data-socket-connected={socketConnected ? 'true' : 'false'}>
      <Sidebar
        conversations={state.conversations}
        users={state.users}
        activeConversationId={state.activeConversationId}
        showUserList={state.showUserList}
        pendingUserIds={new Set(pendingUsers.map(u => u.id))}
        onlineUserIds={onlineUserIds}
        onSelectConversation={selectConversation}
        onTogglePendingUser={togglePendingUser}
        onToggleUserList={handleToggleUserList}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {state.showUserList && pendingUsers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-[15px]">
            Select one or more people to start a conversation
          </div>
        ) : participants.length > 0 ? (
          <>
            <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b-2 border-gray-300 w-[93%] mx-auto">
              <span className="text-[18px] font-semibold">{displayName}</span>
              {activeConversation && !state.showUserList && anyOnline && (
                <span className="text-[13px] text-[#00a676]">Online</span>
              )}
            </div>
            {activeConversation ? (
              activeMessages === null ? (
                <div data-testid="messages-loading" className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-[#00a676] animate-spin" />
                </div>
              ) : (
                <MessageThread
                  messages={activeMessages}
                  currentUserId={user!.id}
                  participants={activeConversation?.participants}
                  hasMore={activeHasMore}
                  onLoadMore={() => loadMore(state.activeConversationId!)}
                />
              )
            ) : (
              <MessageThread messages={[]} currentUserId={user!.id} />
            )}
            <MessageInput onSend={sendMessage} />
          </>
        ) : state.loaded ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-[18px]">
            select a conversation
          </div>
        ) : null}
      </div>
    </div>
  )
}
