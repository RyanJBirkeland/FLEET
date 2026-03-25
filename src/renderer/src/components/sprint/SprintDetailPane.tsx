/**
 * SprintDetailPane — Middle-right zone showing task details, spec, and actions
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, Square, FileText, Trash2, CheckCircle, ExternalLink } from 'lucide-react'
import type { SprintTask } from '../../../../shared/types'
import { NeonBadge } from '../neon/NeonBadge'
import { neonVar } from '../neon/types'
import { Button } from '../ui/Button'
import { SpecEditor } from './SpecEditor'
import { TaskMonitorPanel } from './TaskMonitorPanel'
import { VARIANTS, REDUCED_TRANSITION, useReducedMotion } from '../../lib/motion'

interface SprintDetailPaneProps {
  task: SprintTask | null
  onLaunch?: (task: SprintTask) => void
  onStop?: (task: SprintTask) => void
  onRerun?: (task: SprintTask) => void
  onMarkDone?: (task: SprintTask) => void
  onDelete?: (taskId: string) => void
  onSaveSpec?: (taskId: string, spec: string) => void
}

type TabView = 'spec' | 'monitor'

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

export function SprintDetailPane({
  task,
  onLaunch,
  onStop,
  onRerun,
  onMarkDone,
  onDelete,
  onSaveSpec,
}: SprintDetailPaneProps) {
  const reduced = useReducedMotion()
  const [activeTab, setActiveTab] = useState<TabView>('spec')
  const [isEditingSpec, setIsEditingSpec] = useState(false)
  const [specValue, setSpecValue] = useState(task?.spec || '')

  // Update specValue when task changes
  useEffect(() => {
    setSpecValue(task?.spec || '')
    setIsEditingSpec(false)
  }, [task?.id])

  if (!task) {
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
        Select a task to view details
      </div>
    )
  }

  const accent = statusAccentMap[task.status] || 'blue'
  const canLaunch = task.status === 'queued' || task.status === 'backlog'
  const canStop = task.status === 'active'
  const canRerun = task.status === 'done' || task.status === 'failed' || task.status === 'error' || task.status === 'cancelled'
  const canMarkDone = task.status !== 'done'

  const handleSaveSpec = () => {
    if (task) {
      onSaveSpec?.(task.id, specValue)
      setIsEditingSpec(false)
    }
  }

  return (
    <motion.div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--neon-bg)',
      }}
      variants={VARIANTS.fadeIn}
      initial="initial"
      animate="animate"
      transition={reduced ? REDUCED_TRANSITION : { duration: 0.2 }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${neonVar(accent, 'border')}`,
          background: `linear-gradient(180deg, ${neonVar(accent, 'surface')}, rgba(10, 0, 21, 0.2))`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'start', gap: '8px', marginBottom: '8px' }}>
          <NeonBadge accent={accent} label={task.status} />
          {task.priority !== undefined && task.priority > 0 && (
            <NeonBadge accent="purple" label={`P${task.priority}`} />
          )}
          {task.repo && (
            <NeonBadge accent="blue" label={task.repo} />
          )}
        </div>
        <h3
          style={{
            color: 'rgba(255, 255, 255, 0.95)',
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '12px',
            lineHeight: '1.4',
          }}
        >
          {task.title}
        </h3>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {canLaunch && onLaunch && (
            <Button variant="primary" size="sm" onClick={() => onLaunch(task)}>
              <Play size={12} style={{ marginRight: '4px' }} />
              Launch
            </Button>
          )}
          {canStop && onStop && (
            <Button variant="danger" size="sm" onClick={() => onStop(task)}>
              <Square size={12} style={{ marginRight: '4px' }} />
              Stop
            </Button>
          )}
          {canRerun && onRerun && (
            <Button variant="primary" size="sm" onClick={() => onRerun(task)}>
              <Play size={12} style={{ marginRight: '4px' }} />
              Rerun
            </Button>
          )}
          {canMarkDone && onMarkDone && (
            <Button variant="primary" size="sm" onClick={() => onMarkDone(task)}>
              <CheckCircle size={12} style={{ marginRight: '4px' }} />
              Mark Done
            </Button>
          )}
          {task.pr_url && (
            <Button variant="ghost" size="sm" onClick={() => task.pr_url && window.open(task.pr_url, '_blank')}>
              <ExternalLink size={12} style={{ marginRight: '4px' }} />
              PR #{task.pr_number}
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(task.id)}>
              <Trash2 size={12} style={{ marginRight: '4px' }} />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '1px',
          background: 'var(--neon-purple-border)',
          borderBottom: '1px solid var(--neon-purple-border)',
        }}
      >
        <button
          onClick={() => setActiveTab('spec')}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: activeTab === 'spec' ? 'var(--neon-cyan-surface)' : 'rgba(10, 0, 21, 0.4)',
            color: activeTab === 'spec' ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.5)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
          }}
        >
          <FileText size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Spec
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: activeTab === 'monitor' ? 'var(--neon-cyan-surface)' : 'rgba(10, 0, 21, 0.4)',
            color: activeTab === 'monitor' ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.5)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
          }}
        >
          Output
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'spec' && (
          <div style={{ height: '100%', overflow: 'auto', padding: '16px' }}>
            {isEditingSpec ? (
              <div>
                <SpecEditor
                  value={specValue}
                  onChange={setSpecValue}
                />
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <Button variant="primary" size="sm" onClick={handleSaveSpec}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setIsEditingSpec(false)
                    setSpecValue(task?.spec || '')
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSpecValue(task.spec || '')
                    setIsEditingSpec(true)
                  }}>
                    Edit Spec
                  </Button>
                </div>
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    fontFamily: 'var(--bde-font-code)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {task.spec || 'No spec provided'}
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === 'monitor' && task.status === 'active' && (
          <TaskMonitorPanel task={task} onClose={() => {}} onStop={onStop} onRerun={onRerun} />
        )}
        {activeTab === 'monitor' && task.status !== 'active' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'rgba(255, 255, 255, 0.3)',
              fontSize: '13px',
            }}
          >
            {task.status === 'done' || task.status === 'failed' || task.status === 'error' || task.status === 'cancelled'
              ? 'Task completed. Check logs for details.'
              : 'Task not running. Launch to see output.'}
          </div>
        )}
      </div>
    </motion.div>
  )
}
