import type { UserSummary } from '@chatter/shared'
import { getAvatarSrc } from '../../lib/avatars.js'

interface Props {
  user: UserSummary
  onClick: () => void
}

export default function UserItem({ user, onClick }: Props) {
  return (
    <div
      onClick={onClick}
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
