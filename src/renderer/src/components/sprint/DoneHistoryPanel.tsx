import { useEffect } from 'react'
import type { SprintTask } from '../../../../shared/types'

interface DoneHistoryPanelProps {
  tasks: SprintTask[]
  onTaskClick: (id: string) => void
  onClose: () => void
}

export function DoneHistoryPanel({ tasks, onTaskClick, onClose }: DoneHistoryPanelProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="done-history-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Completed Tasks">
      <div className="done-history" onClick={(e) => e.stopPropagation()}>
        <div className="done-history__header">
          <div className="done-history__title">Completed Tasks ({tasks.length})</div>
          <button className="done-history__close" onClick={onClose} data-testid="dhp-close" aria-label="Close">✕</button>
        </div>
        <div className="done-history__list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="done-history__item"
              onClick={() => onTaskClick(task.id)}
              role="button"
              tabIndex={0}
              aria-label={task.title}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onTaskClick(task.id)
                }
              }}
            >
              <span className="done-history__item-title">{task.title}</span>
              <span className="task-pill__badge" style={{
                background: 'var(--neon-cyan-surface)', color: 'var(--neon-cyan)'
              }}>{task.repo}</span>
              <span className="done-history__item-time">
                {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
              </span>
            </div>
          ))}
          {tasks.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--neon-text-dim)', fontSize: '11px' }}>
              No completed tasks yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
