import type { SprintTask } from '../../../../shared/types'

interface PipelineBacklogProps {
  backlog: SprintTask[]
  failed: SprintTask[]
  onTaskClick: (id: string) => void
  onAddToQueue: (task: SprintTask) => void
  onRerun: (task: SprintTask) => void
}

export function PipelineBacklog({
  backlog,
  failed,
  onTaskClick,
  onAddToQueue,
  onRerun,
}: PipelineBacklogProps) {
  return (
    <div className="pipeline-sidebar">
      <div className="pipeline-sidebar__section pipeline-sidebar__section--grow">
        <div className="pipeline-sidebar__label" style={{ color: 'var(--neon-blue)' }}>
          BACKLOG <span className="pipeline-sidebar__count">{backlog.length}</span>
        </div>
        {backlog.map((task) => (
          <div key={task.id} className="backlog-card" onClick={() => onTaskClick(task.id)}>
            <div className="backlog-card__title">{task.title}</div>
            <div className="backlog-card__meta">
              <span>{task.repo}</span>
              {task.priority <= 2 && <span>P{task.priority}</span>}
            </div>
            <button
              className="backlog-card__action"
              onClick={(e) => {
                e.stopPropagation()
                onAddToQueue(task)
              }}
            >
              → Add to queue
            </button>
          </div>
        ))}
        {backlog.length === 0 && (
          <div style={{ fontSize: '10px', color: 'var(--neon-text-dim)', padding: '8px 0' }}>
            No backlog tasks
          </div>
        )}
      </div>
      {failed.length > 0 && (
        <div className="pipeline-sidebar__section">
          <div className="pipeline-sidebar__label" style={{ color: 'var(--neon-red)' }}>
            FAILED <span className="pipeline-sidebar__count">{failed.length}</span>
          </div>
          {failed.map((task) => (
            <div key={task.id} className="failed-card" onClick={() => onTaskClick(task.id)}>
              <div className="failed-card__title">{task.title}</div>
              <div className="failed-card__meta">
                {task.notes ? task.notes.slice(0, 40) : 'No details'}
              </div>
              <button
                className="backlog-card__action"
                onClick={(e) => {
                  e.stopPropagation()
                  onRerun(task)
                }}
                style={{ color: 'var(--neon-red)' }}
              >
                ↻ Re-run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
