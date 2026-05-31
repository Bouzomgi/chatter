import { useState } from 'react'
import { getCroppedAvatarSrc } from '../../lib/avatars.js'

type AvatarSelectionModalProps = {
  readonly onSelect: (index: number) => void
  readonly onClose: () => void
}

const AVATAR_COUNT = 9

export default function AvatarSelectionModal({ onSelect, onClose }: AvatarSelectionModalProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="avatar-outline-modal" x="-10%" y="-10%" width="130%" height="130%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="expanded" />
            <feOffset in="expanded" dx="3" dy="3" result="offsetShape" />
            <feFlood floodColor="#00a676" floodOpacity="0.65" result="color" />
            <feComposite in="color" in2="offsetShape" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
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
            <span className="inline-block transition-transform hover:scale-110">×</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <img
              key={i}
              src={getCroppedAvatarSrc(i)}
              alt={`avatar ${i + 1}`}
              className="w-full cursor-pointer transition-transform hover:scale-105"
              style={hoveredIndex === i ? { filter: 'url(#avatar-outline-modal)' } : {}}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onSelect(i)}
              data-testid={`avatar-option-${i}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
