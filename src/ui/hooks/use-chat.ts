import { useState, useCallback } from "react"
import { streamChat } from "../../infra/ollama/api-client"
import type { ChatMessage } from "../../types/chat-message"
import type { OllamaChatResponse } from "../../types/ollama-chat-response"

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentContextUsage, setCurrentContextUsage] = useState(0)

  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return

    const userMessage: ChatMessage = { role: "user", content }
    const newHistory = [...messages, userMessage]

    setMessages([...newHistory, { role: "assistant", content: "" }])
    setIsStreaming(true)

    let accumulatedContent = ""

    try {
      await streamChat(
        {
          model: "qwen2.5-coder:14b",
          messages: newHistory,
          stream: true,
          options: {
            num_ctx: Number(import.meta.env.VITE_OLLAMA_CTX) || 32768,
          },
        },
        (chunk) => {
          accumulatedContent += chunk
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1].content = accumulatedContent
            return updated
          })
        },
        (final: OllamaChatResponse) => {
          setIsStreaming(false)
          if (final.prompt_eval_count && final.eval_count) {
            setCurrentContextUsage(final.prompt_eval_count + final.eval_count)
          }
        },
      )
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
    } catch (error: unknown) {
      setIsStreaming(false)
      setMessages(prev => [...prev, { role: "assistant", content: "Connection Error." }])
    }
  }, [messages, isStreaming])

  return { messages, sendMessage, isStreaming, currentContextUsage }
}
