import './PerAgentStats.css'
import { Card } from '../primitives/Card'
import { CardHead } from '../primitives/CardHead'
import { QualityChip } from '../primitives/QualityChip'
import { formatDurationMs, formatTokensCompact } from '../../../lib/format'
import type { PerAgentRow } from '../hooks/useDashboardData'

interface PerAgentStatsProps {
  rows: PerAgentRow[]
}

function successColor(pct: number | null): string {
  if (pct == null) return 'var(--fg-3)'
  if (pct >= 90) return 'var(--st-done)'
  if (pct >= 75) return 'var(--st-blocked)'
  return 'var(--st-failed)'
}

export function PerAgentStats({ rows }: PerAgentStatsProps): React.JSX.Element {
  const totalRuns = rows.reduce((s, r) => s + r.runs, 0)
  return (
    <Card>
      <CardHead
        eyebrow="Per agent"
        title="Last 7 days"
        right={
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-3)'
            }}
          >
            {rows.length} agents · {totalRuns} runs
          </span>
        }
      />
      <div className="per-agent__header-row">
        <span className="fleet-eyebrow per-agent__col-agent">Agent</span>
        <span className="fleet-eyebrow per-agent__col-num">Runs</span>
        <span className="fleet-eyebrow per-agent__col-num">Succ</span>
        <span className="fleet-eyebrow per-agent__col-avg">Avg</span>
        <span className="fleet-eyebrow per-agent__col-tok">Tok</span>
        <span className="fleet-eyebrow per-agent__col-q">Q</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.name}
          className="per-agent__data-row"
          style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)' }}
        >
          <span className="per-agent__name per-agent__col-agent">{row.name}</span>
          <span
            className="per-agent__col-num"
            style={{ color: 'var(--fg-2)' }}
          >
            {row.runs}
          </span>
          <span
            className="per-agent__col-num"
            style={{ color: successColor(row.successPct) }}
          >
            {row.successPct != null ? `${row.successPct}%` : '—'}
          </span>
          <span
            className="per-agent__col-avg"
            style={{ color: 'var(--fg-3)' }}
          >
            {formatDurationMs(row.avgDurationMs)}
          </span>
          <span
            className="per-agent__col-tok"
            style={{ color: 'var(--fg-3)' }}
          >
            {row.totalTokens > 0 ? formatTokensCompact(row.totalTokens) : '—'}
          </span>
          <span className="per-agent__col-q">
            {row.quality != null ? <QualityChip q={row.quality} /> : '—'}
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="per-agent__empty">No runs in the last 7 days.</p>
      )}
    </Card>
  )
}
