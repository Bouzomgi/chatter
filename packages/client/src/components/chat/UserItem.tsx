import type { UserSummary } from '@chatter/shared'
import { getAvatarSrc } from '../../lib/avatars.js'

interface Props {
  user: UserSummary
  onClick: () => void
}

export default function UserItem({ user, onClick }: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Start chat with ${user.username}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-testid="user-item"
      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#e0d0c1cc] border-b-2 border-white"
    >
      <img
        src={getAvatarSrc(user.avatarIndex)}
        alt={user.username}
        className="h-12 w-12 rounded-full shrink-0"
      />
      <span className="font-bold text-[16px]">{user.username}</span>
    </div>
  )
}
