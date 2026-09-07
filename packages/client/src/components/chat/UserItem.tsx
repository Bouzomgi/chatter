import type { UserSummary } from '@chatter/shared'
import { getAvatarSrc } from '../../lib/avatars.js'

interface Props {
  user: UserSummary
  selected: boolean
  onClick: () => void
}

export default function UserItem({ user, selected, onClick }: Props) {
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
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-testid="user-item"
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#e0d0c1cc] border-b-2 border-white${selected ? ' bg-[#e0d0c1cc]' : ''}`}
    >
      <div className="relative shrink-0">
        <img
          src={getAvatarSrc(user.avatarIndex)}
          alt={user.username}
          className="h-12 w-12 rounded-full"
        />
        {selected && (
          <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-[#00a676] ring-2 ring-white flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M1 4l3 3 5-5" />
            </svg>
          </span>
        )}
      </div>
      <span className="font-bold text-[16px]">{user.username}</span>
    </div>
  )
}
