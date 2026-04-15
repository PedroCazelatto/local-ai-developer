import type { ChatMessage } from "../../types/chat-message"
import { SimpleTextRenderer } from "./simple-text-renderer"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble(props: MessageBubbleProps) {
  const { message } = props

  const isUser = message.role === "user"

  const roleColor = isUser ? "text-gray-100" : "text-magenta-400"
  const contentColor = isUser ? "text-gray-100" : "text-cyan-400"

  return (
    <div className={`flex flex-col mb-8 ${isUser ? "items-end" : "items-start"}`}>
      <div className={`font-mono font-bold text-sm ${roleColor} mb-2`}>
        {message.role.toUpperCase()} &gt;
      </div>

      <div className={`max-w-[90%] ${contentColor}`}>
        <SimpleTextRenderer content={message.content} />
      </div>
    </div>
  )
}
