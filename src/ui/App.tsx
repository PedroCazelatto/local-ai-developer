import { ChatWindow } from "./components/chat-window"
import { InputBar } from "./components/input-bar"
import { ContextFooter } from "./components/context-footer"
import { useChat } from "./hooks/use-chat"

export default function App() {
  const {
    messages,
    sendMessage,
    isStreaming,
    currentContextUsage,
  } = useChat()

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] text-white overflow-hidden">
      <header className="p-4 border-b border-white/10 flex justify-between items-center bg-[#252525]">
        <h1 className="text-sm font-mono font-bold text-magenta-400">
          PROJECT_SESSION {">"} <span className="text-cyan-400">ARCHITECT</span>
        </h1>
        <div className="text-xs dim text-gray-500 font-mono">
          MODE: STATELESS_SYNC
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <ChatWindow messages={messages} isStreaming={isStreaming} />
      </main>

      <section className="p-4 bg-[#1e1e1e]">
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </section>

      <footer className="h-10 border-t border-white/5 bg-[#181818] flex items-center px-4">
        <ContextFooter
          usage={currentContextUsage}
          limit={Number(import.meta.env.VITE_OLLAMA_CTX) || 32768}
        />
      </footer>
    </div>
  )
}
