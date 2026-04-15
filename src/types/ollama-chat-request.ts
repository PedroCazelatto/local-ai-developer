import type { ChatMessage } from "./chat-message"

export interface OllamaChatRequest {
  model: string
  messages: ChatMessage[]
  stream: boolean
  options?: {
    num_ctx?: number
    temperature?: number
  }
}
