import type { ChatMessage } from "./chat-message"

export interface OllamaChatResponse {
  model: string
  message: ChatMessage
  done: boolean
  prompt_eval_count?: number
  eval_count?: number
}
