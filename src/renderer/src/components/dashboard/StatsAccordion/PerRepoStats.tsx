import './PerRepoStats.css'
import { Card } from '../primitives/Card'
import { CardHead } from '../primitives/CardHead'
import type { PerRepoRow } from '../hooks/useDashboardData'

interface PerRepoStatsProps {
  rows: PerRepoRow[]
}

export function PerRepoStats({ rows }: PerRepoStatsProps): React.JSX.Element {
  const totalPrs = rows.reduce((s, r) => s + r.prs, 0)
  return (
    <Card>
      <CardHead
        eyebrow="Per repo"
        title="Last 7 days"
        right={
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-3)'
            }}
          >
            {rows.length} repos · {totalPrs} PRs
          </span>
        }
      />
      <div className="per-repo__header-row">
        <span className="fleet-eyebrow per-repo__col-repo">Repo</span>
        <span className="fleet-eyebrow per-repo__col-num">Runs</span>
        <span className="fleet-eyebrow per-repo__col-num">PRs</span>
        <span className="fleet-eyebrow per-repo__col-num">Merged</span>
        <span className="fleet-eyebrow per-repo__col-num">Open</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.repo}
          className="per-repo__data-row"
          style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)' }}
        >
          <span className="per-repo__name per-repo__col-repo">{row.repo}</span>
          <span className="per-repo__col-num" style={{ color: 'var(--fg-2)' }}>
            {row.runs}
          </span>
          <span className="per-repo__col-num" style={{ color: 'var(--fg-2)' }}>
            {row.prs}
          </span>
          <span className="per-repo__col-num" style={{ color: 'var(--st-done)' }}>
            {row.merged}
          </span>
          <span
            className="per-repo__col-num"
            style={{ color: row.open > 0 ? 'var(--st-review)' : 'var(--fg-4)' }}
          >
            {row.open}
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="per-repo__empty">No runs in the last 7 days.</p>
      )}
    </Card>
  )
}
