import type { OllamaChatRequest } from "../../types/ollama-chat-request"
import type { OllamaChatResponse } from "../../types/ollama-chat-response"

export const streamChat = async (
  request: OllamaChatRequest,
  onChunk: (content: string) => void,
  onDone: (final: OllamaChatResponse) => void,
) => {
  const response = await fetch(`${import.meta.env.VITE_OLLAMA_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.body) throw new Error("Ollama connection failed")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split("\n")

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const json: OllamaChatResponse = JSON.parse(line)
        if (json.message?.content) onChunk(json.message.content)
        if (json.done) onDone(json)
      } catch (e) {
        console.error("Parse error", e)
      }
    }
  }
}
