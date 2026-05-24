import type { Conversation, UserSummary } from '@chatter/shared'
import ConversationItem from './ConversationItem.js'
import UserItem from './UserItem.js'

interface Props {
  conversations: Conversation[]
  users: UserSummary[]
  activeConversationId: string | null
  showUserList: boolean
  onSelectConversation: (id: string) => void
  onSelectUser: (user: UserSummary) => void
  onToggleUserList: () => void
}

export default function Sidebar({
  conversations,
  users,
  activeConversationId,
  showUserList,
  onSelectConversation,
  onSelectUser,
  onToggleUserList,
}: Props) {
  return (
    <div data-testid="sidebar" className="flex flex-col w-[350px] shrink-0 bg-[#e0d0c180] border-r border-white">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {showUserList
          ? users.map(u => (
              <UserItem key={u.id} user={u} onClick={() => onSelectUser(u)} />
            ))
          : conversations.map(c => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeConversationId}
                onClick={() => onSelectConversation(c.id)}
              />
            ))}
      </div>
      <button
        data-testid="sidebar-toggle"
        onClick={onToggleUserList}
        className="h-[63px] shrink-0 text-[22px] font-normal hover:bg-[#e0d0c1cc] border-t border-white cursor-pointer bg-transparent"
      >
        {showUserList ? 'back' : 'chat!'}
      </button>
    </div>
  )
}
