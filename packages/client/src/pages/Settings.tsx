import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth.js'
import { api } from '../lib/api.js'
import { getAvatarSrc } from '../lib/avatars.js'
import SubmissionArrow from '../components/SubmissionArrow.js'
import AvatarSelectionModal from '../components/modal/AvatarSelectionModal.js'
import type { User } from '@chatter/shared'

export default function Settings() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const [selectedAvatarIndex, setSelectedAvatarIndex] = useState(user?.avatarIndex ?? 0)
  const [showModal, setShowModal] = useState(false)
  const [isShaking, setIsShaking] = useState(false)

  function shake() {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 500)
  }

  async function submit() {
    try {
      const res = await api.put('/users/me', { avatarIndex: selectedAvatarIndex })
      const updated: User = await res.json()
      setUser(updated)
      navigate('/')
    } catch {
      shake()
    }
  }

  return (
    <div className="flex items-center justify-center h-full w-full">
      {showModal && (
        <AvatarSelectionModal
          onSelect={(index) => {
            setSelectedAvatarIndex(index)
            setShowModal(false)
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="bg-[#e0d0c180] rounded-3xl w-[30%] flex flex-col justify-between gap-8 px-[3%] py-[2%]">
        <h1 className="text-[50px] font-normal text-center m-0">settings</h1>

        <div className="flex flex-col items-center gap-3">
          <span className="text-[22px]">current avatar</span>
          <img
            src={getAvatarSrc(selectedAvatarIndex)}
            alt="current avatar"
            className="w-[120px] cursor-pointer rounded-xl hover:scale-105 transition-transform hover:drop-shadow-[2px_4px_4px_#00a676]"
            onClick={() => setShowModal(true)}
            data-testid="current-avatar"
          />
          <span className="text-[16px] text-gray-500">click to change</span>
        </div>

        <div className="flex justify-end items-center">
          <SubmissionArrow onSubmit={submit} isShaking={isShaking} />
        </div>
      </div>
    </div>
  )
}
