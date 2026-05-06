import './ReviewQueueCard.css'
import { Card } from '../primitives/Card'
import { CardHead } from '../primitives/CardHead'
import { timeAgo } from '../../../lib/format'
import type { SprintTask } from '../../../../../shared/types'

interface ReviewQueueCardProps {
  tasks: SprintTask[]
  onOpenReview: () => void
}

const CAP = 5

export function ReviewQueueCard({ tasks, onOpenReview }: ReviewQueueCardProps): React.JSX.Element {
  const displayed = tasks.slice(0, CAP)
  const remaining = tasks.length - displayed.length

  return (
    <Card>
      <CardHead
        eyebrow="Review queue"
        eyebrowColor="var(--st-review)"
        title={`${tasks.length} ready`}
        right={
          <button className="review-queue__mini-link" onClick={onOpenReview}>
            Open Review →
          </button>
        }
      />
      {tasks.length === 0 ? (
        <p className="review-queue__empty">All caught up.</p>
      ) : (
        <div>
          {displayed.map((task, i) => {
            const age = task.promoted_to_review_at ? timeAgo(task.promoted_to_review_at) : '—'
            return (
              <button
                key={task.id}
                type="button"
                className="review-queue__row"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                  background: 'transparent',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onClick={onOpenReview}
                aria-label={`Review "${task.title}" in ${task.repo}, waiting ${age}`}
              >
                <span className="fleet-dot fleet-dot--review" />
                <div className="review-queue__text-col">
                  <span className="review-queue__title">{task.title}</span>
                  {/* TODO(phase-2.5): +add/−del diff stats need PR diff count stored on task */}
                  <span className="review-queue__sub">
                    <span className="review-queue__repo">{task.repo}</span>
                    <span className="review-queue__sep"> · </span>
                    <span className="review-queue__age-inline">{age}</span>
                  </span>
                </div>
                <span className="review-queue__age">{age}</span>
              </button>
            )
          })}
          {remaining > 0 && (
            <button className="review-queue__view-all" onClick={onOpenReview}>
              View all ({tasks.length}) →
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
