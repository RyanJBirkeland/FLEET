import './RecentCompletionsCard.css'
import { Card } from '../primitives/Card'
import { CardHead } from '../primitives/CardHead'
import { QualityChip } from '../primitives/QualityChip'
import { formatTime, formatTokensCompact } from '../../../lib/format'
import type { SprintTask } from '../../../../../shared/types'

interface RecentCompletionsCardProps {
  completions: SprintTask[]
  taskTokenMap: Map<string, number>
  windowHours?: number
}

export function RecentCompletionsCard({
  completions,
  taskTokenMap,
  windowHours = 2
}: RecentCompletionsCardProps): React.JSX.Element | null {
  if (completions.length === 0) return null

  return (
    <Card>
      <CardHead
        eyebrow="Recent completions"
        eyebrowColor="var(--st-done)"
        title={`last ${windowHours}h · ${completions.length} merged`}
      />
      <div>
        {completions.map((task, i) => {
          const tokens = taskTokenMap.get(task.id) ?? 0
          const completedAt = task.completed_at ? formatTime(task.completed_at) : '—'
          return (
            <div
              key={task.id}
              className="recent-completions__row"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}
            >
              <span className="fleet-dot fleet-dot--done" />
              <span className="recent-completions__title">{task.title}</span>
              <QualityChip q={task.quality_score ?? null} />
              <span className="recent-completions__tokens">
                {tokens > 0 ? formatTokensCompact(tokens) : '—'}
              </span>
              <span className="recent-completions__time">{completedAt}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
