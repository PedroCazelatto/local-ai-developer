interface ContextFooterProps {
  usage: number
  limit: number
}

export function ContextFooter(props: ContextFooterProps) {
  const { usage, limit } = props

  const percentage = limit > 0 ? Math.round((usage / limit) * 100) : 0

  const getStatusColor = () => {
    if (percentage < 70) return "text-green-400"
    if (percentage < 90) return "text-yellow-400"
    return "text-red-400"
  }

  return (
    <div className="flex items-center gap-2 font-mono text-xs w-full justify-end">
      <span className="text-gray-400">{"CONTEXT USAGE >"}</span>

      <span className={`font-bold ${getStatusColor()}`}>
        {percentage}%
      </span>

      <span className="text-gray-500 dim">
        ({usage.toLocaleString()} / {limit.toLocaleString()} tokens)
      </span>
    </div>
  )
};
