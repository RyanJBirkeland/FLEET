import { useState } from 'react'
import { timeAgo } from '../../lib/format'
import type { AgentMeta } from '../../../../shared/types'

interface AgentRowProps {
  agent: AgentMeta
  selected: boolean
  onClick: () => void
  currentStep?: string | undefined
  progressPct?: number | undefined
}

export function AgentRow({
  agent,
  selected,
  onClick,
  currentStep,
  progressPct = 0,
}: AgentRowProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const isRunning = agent.status === 'running'
  const age = agent.startedAt ? timeAgo(agent.startedAt) : ''

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`${agent.task} — ${agent.status}`}
      aria-current={selected ? 'true' : undefined}
      style={{
        width: '100%',
        padding: 'var(--s-2)',
        borderRadius: 'var(--r-md)',
        background: selected ? 'var(--surf-2)' : hovered ? 'var(--surf-1)' : 'transparent',
        border: selected ? '1px solid var(--line-2)' : '1px solid transparent',
        borderLeft: selected
          ? `2px solid var(--st-${agent.status})`
          : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        {isRunning ? (
          <span
            className="fleet-pulse"
            style={{ width: 6, height: 6, flexShrink: 0 }}
            aria-label="Running"
          />
        ) : (
          <span
            className={`fleet-dot--${agent.status}`}
            style={{ width: 6, height: 6, flexShrink: 0 }}
          />
        )}
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--fg)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.id}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fg-4)',
            flexShrink: 0,
          }}
        >
          {age}
        </span>
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--fg-3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingLeft: 'var(--s-3)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>
          {agent.repo} &rsaquo;{' '}
        </span>
        {currentStep ?? agent.task}
      </div>

      {isRunning && (
        <div
          data-testid="progress-bar"
          style={{
            height: 2,
            background: 'var(--surf-3)',
            borderRadius: 999,
            overflow: 'hidden',
            marginLeft: 'var(--s-3)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, progressPct)}%`,
              background: 'var(--st-running)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      )}
    </button>
  )
}
