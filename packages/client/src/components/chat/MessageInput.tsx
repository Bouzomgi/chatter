import { useState } from 'react'

interface Props {
  onSend: (body: string) => void
}

export default function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('')

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && text.trim()) {
      onSend(text.trim())
      setText('')
    }
  }

  return (
    <div className="h-[63px] shrink-0 flex items-center justify-center border-t border-gray-200">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="message"
        autoComplete="off"
        className="w-[90%] h-[30px] border border-gray-300 rounded-[15px] text-[14px] indent-[10px] outline-none"
      />
    </div>
  )
}
