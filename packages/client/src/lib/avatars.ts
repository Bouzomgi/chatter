import avatar1 from '../assets/avatars/avatar1.svg'
import avatar2 from '../assets/avatars/avatar2.svg'
import avatar3 from '../assets/avatars/avatar3.svg'
import avatar4 from '../assets/avatars/avatar4.svg'
import avatar5 from '../assets/avatars/avatar5.svg'
import avatar6 from '../assets/avatars/avatar6.svg'
import avatar7 from '../assets/avatars/avatar7.svg'
import avatar8 from '../assets/avatars/avatar8.svg'
import avatar9 from '../assets/avatars/avatar9.svg'

import cropped1 from '../assets/avatarsCropped/avatar1.svg'
import cropped2 from '../assets/avatarsCropped/avatar2.svg'
import cropped3 from '../assets/avatarsCropped/avatar3.svg'
import cropped4 from '../assets/avatarsCropped/avatar4.svg'
import cropped5 from '../assets/avatarsCropped/avatar5.svg'
import cropped6 from '../assets/avatarsCropped/avatar6.svg'
import cropped7 from '../assets/avatarsCropped/avatar7.svg'
import cropped8 from '../assets/avatarsCropped/avatar8.svg'
import cropped9 from '../assets/avatarsCropped/avatar9.svg'

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8, avatar9]
const croppedAvatars = [cropped1, cropped2, cropped3, cropped4, cropped5, cropped6, cropped7, cropped8, cropped9]

export function getAvatarSrc(index: number): string {
  return avatars[index % avatars.length]
}

export function getCroppedAvatarSrc(index: number): string {
  return croppedAvatars[index % croppedAvatars.length]
}
