import { useEffect, useRef, useState } from 'react'
import { useChatStore, LogLine } from '../../stores/chat'
import { useSessionsStore } from '../../stores/sessions'
import { useGatewayStore } from '../../stores/gateway'

function lineClass(line: LogLine): string {
  if (line.role === 'tool') return 'feed-line--tool'
  if (line.role === 'system') return 'feed-line--error'
  if (line.toolName) return 'feed-line--tool'
  if (line.content.toLowerCase().includes('error')) return 'feed-line--error'
  if (line.content.includes('Write') || line.content.includes('write')) return 'feed-line--write'
  return 'feed-line--text'
}

export function LiveFeed(): React.JSX.Element {
  const selectedKey = useSessionsStore((s) => s.selectedSessionKey)
  const lines = useChatStore((s) => (selectedKey ? s.lines[selectedKey] ?? [] : []))
  const addLine = useChatStore((s) => s.addLine)
  const client = useGatewayStore((s) => s.client)

  const feedRef = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    if (!client || !selectedKey) return

    const unsub = client.onMessage((data) => {
      const msg = data as {
        type?: string
        sessionKey?: string
        role?: string
        content?: string
        toolName?: string
      }
      if (msg.type === 'session_log' && msg.sessionKey === selectedKey) {
        addLine(selectedKey, {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: (msg.role as LogLine['role']) ?? 'assistant',
          content: msg.content ?? '',
          toolName: msg.toolName,
          timestamp: Date.now()
        })
      }
    })

    return unsub
  }, [client, selectedKey, addLine])

  useEffect(() => {
    if (!hovering && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [lines, hovering])

  if (!selectedKey) {
    return (
      <div className="live-feed live-feed--empty">
        <span className="live-feed__empty-text">Select a session to watch its output</span>
      </div>
    )
  }

  return (
    <div
      className="live-feed"
      ref={feedRef}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="live-feed__header">
        <span className="live-feed__title">Live Feed</span>
        <span className="live-feed__session-key">{selectedKey}</span>
      </div>
      <div className="live-feed__lines">
        {lines.map((line) => (
          <div key={line.id} className={`feed-line ${lineClass(line)}`}>
            {line.toolName && <span className="feed-line__tool-name">{line.toolName}</span>}
            <span className="feed-line__content">{line.content}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <span className="live-feed__waiting">Waiting for output…</span>
        )}
      </div>
    </div>
  )
}
