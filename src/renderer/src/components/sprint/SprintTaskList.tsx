/**
 * SprintTaskList — Middle-left zone showing all tasks in a scrollable list
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { SprintTask } from '../../../../shared/types'
import { NeonBadge } from '../neon/NeonBadge'
import { neonVar } from '../neon/types'
import { VARIANTS, REDUCED_TRANSITION, useReducedMotion } from '../../lib/motion'

interface SprintTaskListProps {
  tasks: SprintTask[]
  selectedId: string | null
  onSelect: (taskId: string) => void
  loading?: boolean
  repoFilter?: string | null
}

const statusAccentMap = {
  backlog: 'blue',
  queued: 'cyan',
  active: 'purple',
  done: 'pink',
  failed: 'red',
  cancelled: 'red',
  error: 'red',
  blocked: 'orange',
} as const

export function SprintTaskList({ tasks, selectedId, onSelect, loading, repoFilter }: SprintTaskListProps) {
  const reduced = useReducedMotion()

  const filteredTasks = useMemo(() => {
    if (!repoFilter) return tasks
    return tasks.filter((t) => t.repo.toLowerCase() === repoFilter.toLowerCase())
  }, [tasks, repoFilter])

  const sortedTasks = useMemo(() => {
    // Sort by: active first, then by priority (descending), then by created (newest first)
    return [...filteredTasks].sort((a, b) => {
      // Active tasks first
      if (a.status === 'active' && b.status !== 'active') return -1
      if (b.status === 'active' && a.status !== 'active') return 1

      // Then by priority (higher first)
      if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0)

      // Then by created date (newer first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filteredTasks])

  if (loading && tasks.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'rgba(255, 255, 255, 0.3)' }}>
        <div>Loading tasks...</div>
      </div>
    )
  }

  if (sortedTasks.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'rgba(255, 255, 255, 0.2)',
          fontSize: '13px',
          fontFamily: 'var(--bde-font-code)',
        }}
      >
        {repoFilter ? `No tasks for ${repoFilter}` : 'No tasks yet'}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {sortedTasks.map((task) => {
        const accent = statusAccentMap[task.status] || 'blue'
        const isSelected = task.id === selectedId

        return (
          <motion.div
            key={task.id}
            onClick={() => onSelect(task.id)}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              borderBottom: `1px solid ${neonVar(accent, 'border')}`,
              background: isSelected
                ? `linear-gradient(90deg, ${neonVar(accent, 'surface')}, rgba(10, 0, 21, 0.4))`
                : 'rgba(10, 0, 21, 0.2)',
              borderLeft: isSelected ? `3px solid ${neonVar(accent, 'color')}` : '3px solid transparent',
              transition: 'all 0.2s ease',
            }}
            whileHover={{
              background: `linear-gradient(90deg, ${neonVar(accent, 'surface')}, rgba(10, 0, 21, 0.3))`,
            }}
            variants={VARIANTS.fadeIn}
            initial="initial"
            animate="animate"
            transition={reduced ? REDUCED_TRANSITION : { duration: 0.2 }}
          >
            <div style={{ display: 'flex', alignItems: 'start', gap: '8px', marginBottom: '6px' }}>
              <NeonBadge accent={accent} label={task.status} />
              {task.priority !== undefined && task.priority > 0 && (
                <NeonBadge accent="purple" label={`P${task.priority}`} />
              )}
            </div>
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '4px',
                lineHeight: '1.3',
              }}
            >
              {task.title}
            </div>
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '11px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <span>{task.repo}</span>
              {task.pr_number && <span>• PR #{task.pr_number}</span>}
              {task.depends_on && task.depends_on.length > 0 && (
                <span>• {task.depends_on.length} dep{task.depends_on.length > 1 ? 's' : ''}</span>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
