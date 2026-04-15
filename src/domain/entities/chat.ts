import type { ChatMessage } from "../../types/chat-message"

export const estimateTokens = (messages: ChatMessage[]): number => {
  const text = messages.reduce((acc, msg) => acc + msg.content, "")
  return Math.ceil(text.length / 4)
}
