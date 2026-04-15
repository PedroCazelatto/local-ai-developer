interface SimpleTextRendererProps {
  content: string
}

export function SimpleTextRenderer(props: SimpleTextRendererProps) {
  const { content } = props

  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n")
          const codeContent = lines.slice(1, -1).join("\n")
          const language = lines[0].replace("```", "").trim() || "code"

          return (
            <div key={index} className="my-4 border border-white/10 rounded overflow-hidden">
              <div className="bg-white/5 px-3 py-1 text-[10px] text-gray-500 uppercase border-b border-white/10">
                {language}
              </div>
              <pre className="p-4 bg-black/30 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                <code className="text-cyan-300">{codeContent}</code>
              </pre>
            </div>
          )
        }

        return <span key={index}>{part}</span>
      })}
    </div>
  )
}
