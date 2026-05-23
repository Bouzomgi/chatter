import { useAuth } from '../context/auth.js'
import { getAvatarSrc } from '../lib/avatars.js'

export default function Chat() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col h-full w-full">
      <header className="flex items-center gap-3 p-4">
        {user && (
          <img
            src={getAvatarSrc(user.avatarIndex)}
            alt={user.username}
            className="h-10 w-10 rounded-full"
          />
        )}
        <span className="text-xl">{user?.username}</span>
      </header>
    </div>
  )
}
