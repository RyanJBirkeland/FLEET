import './ConsoleCard.css'
import { formatTime } from './util'

interface McpDisclosureCardProps {
  servers: string[]
  timestamp: number
  searchClass: string
}

export function McpDisclosureCard({
  servers,
  timestamp,
  searchClass
}: McpDisclosureCardProps): React.JSX.Element {
  const serverList = servers.length > 0 ? servers.join(' · ') : 'none'
  return (
    <div
      className={`console-card console-card--mcp-disclosure${searchClass}`}
      data-testid="console-line-mcp-disclosure"
    >
      🔌 MCP servers: {serverList} · {formatTime(timestamp)} · managed connectors not available
    </div>
  )
}
