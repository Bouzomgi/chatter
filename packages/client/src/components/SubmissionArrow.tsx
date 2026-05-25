import arrowSvg from '../assets/arrow.svg'

type SubmissionArrowProps = {
  onSubmit: () => void
  isShaking: boolean
}

export default function SubmissionArrow({ onSubmit, isShaking }: SubmissionArrowProps) {
  return (
    <button onClick={onSubmit} aria-label="Submit" className="p-0 border-none bg-transparent cursor-pointer">
      <img
        src={arrowSvg}
        alt="submit"
        className={`h-[70px] hover:rotate-[4deg] hover:drop-shadow-[2px_4px_1px_#00a676] transition-transform ${isShaking ? 'shake' : ''}`}
      />
    </button>
  )
}
