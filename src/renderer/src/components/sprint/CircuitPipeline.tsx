/**
 * CircuitPipeline — Top zone showing task counts across pipeline stages
 */
import { useMemo } from 'react'
import { PipelineFlow, type PipelineStage } from '../neon/PipelineFlow'
import type { SprintTask } from '../../../../shared/types'

interface CircuitPipelineProps {
  tasks: SprintTask[]
}

export function CircuitPipeline({ tasks }: CircuitPipelineProps) {
  const stages: PipelineStage[] = useMemo(() => {
    const backlog = tasks.filter((t) => t.status === 'backlog').length
    const queued = tasks.filter((t) => t.status === 'queued').length
    const blocked = tasks.filter((t) => t.status === 'blocked').length
    const active = tasks.filter((t) => t.status === 'active').length
    const done = tasks.filter((t) => t.status === 'done').length
    const failed = tasks.filter((t) => t.status === 'failed' || t.status === 'error' || t.status === 'cancelled').length

    return [
      { label: 'Backlog', count: backlog, accent: 'blue' },
      { label: 'Queued', count: queued, accent: 'cyan' },
      { label: 'Active', count: active, accent: 'purple' },
      { label: 'Done', count: done, accent: 'pink' },
      ...(blocked > 0 ? [{ label: 'Blocked', count: blocked, accent: 'orange' as const }] : []),
      ...(failed > 0 ? [{ label: 'Failed', count: failed, accent: 'red' as const }] : []),
    ]
  }, [tasks])

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--neon-purple-border)',
        background: 'linear-gradient(180deg, rgba(138, 43, 226, 0.04), rgba(10, 0, 21, 0.2))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              color: 'var(--neon-cyan)',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              fontWeight: 600,
            }}
          >
            Sprint Pipeline
          </span>
          <PipelineFlow stages={stages} />
        </div>
      </div>
    </div>
  )
}
