import type { KeyboardEvent } from "react"
import { useState } from "react"

interface InputBarProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function InputBar(props: InputBarProps) {
  const { onSend, disabled } = props

  const [inputValue, setInputValue] = useState("")

  const handleSend = () => {
    if (inputValue.trim() && !disabled) {
      onSend(inputValue.trim())
      setInputValue("")
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 bg-[#3a3a3a] rounded-md border border-white/10 p-2">
      <textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
        disabled={disabled}
        className="flex-1 bg-transparent text-white font-mono text-sm outline-none resize-none overflow-y-auto max-h-40 placeholder:text-gray-500"
        rows={1}
      />

      <button
        onClick={handleSend}
        disabled={disabled || !inputValue.trim()}
        className="px-4 py-1.5 bg-magenta-600 text-white font-bold text-sm rounded disabled:bg-gray-600 disabled:opacity-50 transition-all"
      >
        SEND
      </button>
    </div>
  )
};
