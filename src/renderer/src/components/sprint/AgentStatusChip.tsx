import { useState, useEffect } from 'react'
import { formatElapsed } from '../../lib/format'

type AgentStatus = 'idle' | 'running' | 'done' | 'error'

type AgentStatusChipProps = {
  status: AgentStatus
  startedAt: string | number | null
}

export function AgentStatusChip({ status, startedAt }: AgentStatusChipProps) {
  const [, tick] = useState(0)

  useEffect(() => {
    if (status !== 'running' || !startedAt) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [status, startedAt])

  const label =
    status === 'running' && startedAt
      ? formatElapsed(typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt)
      : status === 'done'
        ? 'Done'
        : status === 'error'
          ? 'Error'
          : 'Idle'

  return (
    <span className={`agent-chip agent-chip--${status}`}>
      <span className="agent-chip__dot" />
      {label}
    </span>
  )
}
