import { getAvatarSrc } from '../../lib/avatars.js'

type AvatarSelectionModalProps = {
  readonly onSelect: (index: number) => void
  readonly onClose: () => void
}

const AVATAR_COUNT = 9

export default function AvatarSelectionModal({ onSelect, onClose }: AvatarSelectionModalProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-[#e0d0c1] rounded-3xl p-8 flex flex-col gap-6 w-[420px]"
        onClick={e => e.stopPropagation()}
        data-testid="avatar-selection-modal"
      >
        <div className="flex justify-between items-center">
          <span className="text-[24px]">choose an avatar</span>
          <button
            onClick={onClose}
            className="text-[32px] leading-none bg-transparent border-none cursor-pointer"
            aria-label="close"
          >
            ×
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <img
              key={i}
              src={getAvatarSrc(i)}
              alt={`avatar ${i + 1}`}
              className="w-full cursor-pointer rounded-xl hover:scale-105 transition-transform hover:drop-shadow-[2px_4px_4px_#00a676]"
              onClick={() => onSelect(i)}
              data-testid={`avatar-option-${i}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
