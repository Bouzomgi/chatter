import avatar1 from '../assets/avatars/avatar1.svg'
import avatar2 from '../assets/avatars/avatar2.svg'
import avatar3 from '../assets/avatars/avatar3.svg'
import avatar4 from '../assets/avatars/avatar4.svg'
import avatar5 from '../assets/avatars/avatar5.svg'
import avatar6 from '../assets/avatars/avatar6.svg'
import avatar7 from '../assets/avatars/avatar7.svg'
import avatar8 from '../assets/avatars/avatar8.svg'
import avatar9 from '../assets/avatars/avatar9.svg'

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8, avatar9]

export function getAvatarSrc(index: number): string {
  return avatars[index % avatars.length]
}
