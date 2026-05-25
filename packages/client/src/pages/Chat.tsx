import { useAuth } from '../context/auth.js'
import { useSocket } from '../context/socket.js'
import { useChat } from '../hooks/useChat.js'
import Sidebar from '../components/chat/Sidebar.js'
import MessageThread from '../components/chat/MessageThread.js'
import MessageInput from '../components/chat/MessageInput.js'

export default function Chat() {
  const { user } = useAuth()
  const { socketConnected } = useSocket()
  const {
    state,
    activeMessages,
    activeHasMore,
    activeConversation,
    selectConversation,
    loadMore,
    selectUser,
    handleToggleUserList,
    sendMessage,
  } = useChat()

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
            {activeMessages === null ? (
              <div data-testid="messages-loading" className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-[#00a676] animate-spin" />
              </div>
            ) : (
              <MessageThread
                messages={activeMessages}
                currentUserId={user!.id}
                hasMore={activeHasMore}
                onLoadMore={() => loadMore(state.activeConversationId!)}
              />
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
