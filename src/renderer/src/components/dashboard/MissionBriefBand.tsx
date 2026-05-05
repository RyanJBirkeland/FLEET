import './MissionBriefBand.css'
import type { BriefHeadlinePart } from './hooks/useDashboardData'
import type { DashboardStats } from '../../lib/dashboard-types'

interface MissionBriefBandProps {
  briefHeadlineParts: BriefHeadlinePart[]
  stats: DashboardStats
  onOpenReview: () => void
  onOpenPlanner: () => void
  onNewTask: () => void
}

function BriefHeadline({ parts }: { parts: BriefHeadlinePart[] }): React.JSX.Element {
  return (
    <p className="mission-brief__headline" data-testid="dashboard-headline">
      {parts.map((part, i) =>
        part.kind === 'count' ? (
          <span key={i} style={{ color: part.color, fontWeight: 600 }}>
            {part.text}
          </span>
        ) : (
          <span key={i} style={{ color: 'var(--fg-3)' }}>
            {part.text}
          </span>
        )
      )}
    </p>
  )
}

function SprintProgress({ stats }: { stats: DashboardStats }): React.JSX.Element {
  const total =
    stats.done + stats.queued + stats.active + stats.blocked + stats.review + stats.failed
  const pct = total > 0 ? Math.round((stats.done / total) * 100) : 0
  // TODO(phase-2.5): sprint.id and sprint.end_date need a sprint IPC + store to compute days_left and pace
  return (
    <div className="mission-brief__col mission-brief__col--bordered">
      <span className="fleet-eyebrow">Sprint · Current</span>
      <div className="mission-brief__sprint-hero">
        <span className="mission-brief__sprint-pct">{pct}%</span>
        <span className="mission-brief__sprint-meta">
          {stats.done} / {total} done
        </span>
      </div>
      <div className="mission-brief__sprint-bar">
        <div className="mission-brief__sprint-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function QuickActions({
  reviewCount,
  onOpenReview,
  onOpenPlanner,
  onNewTask
}: {
  reviewCount: number
  onOpenReview: () => void
  onOpenPlanner: () => void
  onNewTask: () => void
}): React.JSX.Element {
  return (
    <div className="mission-brief__col mission-brief__col--bordered mission-brief__quick">
      <span className="fleet-eyebrow">Quick</span>
      <div className="mission-brief__quick-actions">
        <button className="mission-brief__primary-btn" onClick={onOpenReview}>
          Review queue · {reviewCount}
        </button>
        <div className="mission-brief__ghost-row">
          <button className="mission-brief__ghost-btn" onClick={onNewTask}>
            + Task
          </button>
          <button className="mission-brief__ghost-btn" onClick={onOpenPlanner}>
            Plan
          </button>
          <button className="mission-brief__ghost-btn" disabled title="Coming in Phase 3">
            Run all
          </button>
        </div>
      </div>
    </div>
  )
}

function Timestamp(): React.JSX.Element {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'short' })
  const date = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <span className="mission-brief__timestamp">
      {day} · {date} · {time}
    </span>
  )
}

export function MissionBriefBand({
  briefHeadlineParts,
  stats,
  onOpenReview,
  onOpenPlanner,
  onNewTask
}: MissionBriefBandProps): React.JSX.Element {
  return (
    <header className="mission-brief">
      {/* Col 1 — headline */}
      <div className="mission-brief__col">
        <div className="mission-brief__eyebrow-row">
          <span className="fleet-eyebrow">Mission Brief</span>
          <span className="mission-brief__dot" />
          <Timestamp />
        </div>
        <BriefHeadline parts={briefHeadlineParts} />
      </div>

      {/* Col 2 — sprint progress */}
      <SprintProgress stats={stats} />

      {/* Col 3 — quick actions */}
      <QuickActions
        reviewCount={stats.review}
        onOpenReview={onOpenReview}
        onOpenPlanner={onOpenPlanner}
        onNewTask={onNewTask}
      />
    </header>
  )
}
