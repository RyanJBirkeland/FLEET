import './ActiveAgentsCard.css'
import { Card } from '../primitives/Card'
import { CardHead } from '../primitives/CardHead'
import { formatDurationMs, formatTokensCompact } from '../../../lib/format'
import type { ActiveAgent } from '../hooks/useDashboardData'

interface ActiveAgentsCardProps {
  agents: ActiveAgent[]
  capacity: number
  onOpenAgents: () => void
  onSpawnOne: () => void
}

function AgentRow({ agent, first }: { agent: ActiveAgent; first: boolean }): React.JSX.Element {
  const elapsed = formatDurationMs(agent.elapsedMs)
  const tokens = agent.tokens > 0 ? formatTokensCompact(agent.tokens) : '—'
  const pct = agent.progressPct ?? 0
  return (
    <li
      className="active-agents__row"
      aria-label={`${agent.title}, running for ${elapsed}, ${pct} percent complete`}
      style={{ borderTop: first ? 'none' : '1px solid var(--line)', listStyle: 'none' }}
    >
      <span className="fleet-pulse" style={{ width: 7, height: 7, flexShrink: 0 }} />
      <div className="active-agents__name-col">
        <span className="active-agents__title">
          {agent.title}
          <span className="active-agents__repo"> · {agent.repo}</span>
        </span>
        <span className="active-agents__step">{agent.stepDescription}</span>
      </div>
      <div className="active-agents__progress-col">
        <div className="active-agents__bar-track">
          <div className="active-agents__bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="active-agents__meta">
        {tokens} <span className="active-agents__meta-dim">tok</span>
      </span>
      <span className="active-agents__meta">
        <span className="active-agents__meta-dim">eta </span>
        {elapsed}
      </span>
      <span className="active-agents__pct">{pct}%</span>
    </li>
  )
}

function EmptyState({ onSpawnOne }: { onSpawnOne: () => void }): React.JSX.Element {
  return (
    <div className="active-agents__empty">
      <span className="active-agents__empty-text">No agents running</span>
      <span className="active-agents__empty-sep">·</span>
      <button className="active-agents__mini-link" onClick={onSpawnOne}>
        Spawn one
      </button>
    </div>
  )
}

export function ActiveAgentsCard({
  agents,
  capacity,
  onOpenAgents,
  onSpawnOne
}: ActiveAgentsCardProps): React.JSX.Element {
  return (
    <Card>
      <CardHead
        eyebrow="Active agents"
        title={`${agents.length} running · ${capacity} capacity`}
        live
        right={
          <button className="active-agents__mini-link" onClick={onOpenAgents}>
            Open Agents →
          </button>
        }
      />
      {agents.length === 0 ? (
        <EmptyState onSpawnOne={onSpawnOne} />
      ) : (
        <ul role="list" style={{ margin: 0, padding: 0 }}>
          {agents.map((a, i) => (
            <AgentRow key={a.id} agent={a} first={i === 0} />
          ))}
        </ul>
      )}
    </Card>
  )
}
