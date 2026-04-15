import { useEffect, useRef } from "react"
import { MessageBubble } from "./message-bubble"
import type { ChatMessage } from "../../types/chat-message"

interface ChatWindowProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

export function ChatWindow(props: ChatWindowProps) {
  const { messages, isStreaming } = props

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="h-full w-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {messages.map((msg, index) => (
        <MessageBubble key={index} message={msg} />
      ))}

      {isStreaming && messages.length > 0 && messages[messages.length - 1].role === "user" && (
        <div className="font-mono text-sm text-dim-yellow-400 animate-pulse">
          ARCHITECT is thinking...
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
