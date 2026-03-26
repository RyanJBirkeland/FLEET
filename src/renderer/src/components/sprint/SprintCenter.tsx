/**
 * SprintCenter — Three-zone neon layout:
 * 1. CircuitPipeline (top: pipeline status)
 * 2. SprintTaskList + SprintDetailPane (middle: task list + detail pane)
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ConfirmModal } from '../ui/ConfirmModal'
import { CircuitPipeline } from './CircuitPipeline'
import { SprintTaskList } from './SprintTaskList'
import { SprintDetailPane } from './SprintDetailPane'
import { ConflictDrawer } from './ConflictDrawer'
import { HealthCheckDrawer } from './HealthCheckDrawer'
import { usePrConflictsStore } from '../../stores/prConflicts'
import { useUIStore } from '../../stores/ui'
import { useSprintTasks } from '../../stores/sprintTasks'
import { useSprintUI } from '../../stores/sprintUI'
import { useSprintEvents } from '../../stores/sprintEvents'
import { setOpenLogDrawerTaskId, useTaskToasts } from '../../hooks/useTaskNotifications'
import { useSprintPolling } from '../../hooks/useSprintPolling'
import { usePrStatusPolling } from '../../hooks/usePrStatusPolling'
import { useSprintKeyboardShortcuts } from '../../hooks/useSprintKeyboardShortcuts'
import { useSprintTaskActions } from '../../hooks/useSprintTaskActions'
import { useHealthCheck } from '../../hooks/useHealthCheck'
import { REPO_OPTIONS } from '../../lib/constants'
import { VARIANTS, SPRINGS, REDUCED_TRANSITION, useReducedMotion } from '../../lib/motion'

import { ErrorBoundary } from '../ui/ErrorBoundary'
import type { SprintTask } from '../../../../shared/types'
export type { SprintTask }

export function SprintCenter() {
  const reduced = useReducedMotion()

  // --- Store state ---
  const { tasks, loading, loadError } = useSprintTasks(
    useShallow((s) => ({
      tasks: s.tasks,
      loading: s.loading,
      loadError: s.loadError,
    }))
  )
  const loadData = useSprintTasks((s) => s.loadData)

  const { repoFilter, logDrawerTaskId } = useSprintUI(
    useShallow((s) => ({
      repoFilter: s.repoFilter,
      logDrawerTaskId: s.logDrawerTaskId,
    }))
  )
  const setRepoFilter = useSprintUI((s) => s.setRepoFilter)
  const setLogDrawerTaskId = useSprintUI((s) => s.setLogDrawerTaskId)

  // --- Extracted hooks ---
  const {
    handleSaveSpec,
    handleMarkDone,
    handleStop,
    handleRerun,
    launchTask,
    deleteTask,
    confirmProps,
  } = useSprintTaskActions()

  const { visibleStuckTasks, dismissTask } = useHealthCheck(tasks)

  const setView = useUIStore((s) => s.setView)
  const openWorkbench = useCallback(() => setView('task-workbench'), [setView])

  // --- Local UI state ---
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false)
  const [healthDrawerOpen, setHealthDrawerOpen] = useState(false)

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null),
    [selectedTaskId, tasks]
  )

  // Subscribe to live task output events
  const initTaskOutputListener = useSprintEvents((s) => s.initTaskOutputListener)
  useEffect(() => {
    const cleanup = initTaskOutputListener()
    return cleanup
  }, [initTaskOutputListener])

  // Keep notification hook aware of which task's LogDrawer is open
  useEffect(() => {
    setOpenLogDrawerTaskId(logDrawerTaskId)
    return () => setOpenLogDrawerTaskId(null)
  }, [logDrawerTaskId])

  // In-app toast notifications for agent-done and PR-opened transitions
  const handleViewOutput = useCallback(
    (task: SprintTask) => {
      setLogDrawerTaskId(task.id)
    },
    [setLogDrawerTaskId]
  )
  useTaskToasts(tasks, logDrawerTaskId, handleViewOutput)

  // Extracted polling hooks
  useSprintPolling()
  usePrStatusPolling()
  useSprintKeyboardShortcuts({ openWorkbench, setConflictDrawerOpen })

  // Auto-select first task if none selected
  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id)
    }
  }, [tasks, selectedTaskId])

  const conflictingTaskIds = usePrConflictsStore((s) => s.conflictingTaskIds)
  const conflictingTasks = useMemo(
    () => tasks.filter((t) => conflictingTaskIds.includes(t.id)),
    [tasks, conflictingTaskIds]
  )

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
      transition={reduced ? REDUCED_TRANSITION : SPRINGS.snappy}
    >
      {/* Zone 1: CircuitPipeline */}
      <ErrorBoundary name="CircuitPipeline">
        <CircuitPipeline tasks={tasks} />
      </ErrorBoundary>

      {/* Zone 2: Task List + Detail Pane */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: Task List Sidebar */}
        <div
          style={{
            width: 280,
            minWidth: 200,
            borderRight: '1px solid var(--neon-purple-border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, rgba(138, 43, 226, 0.04), rgba(10, 0, 21, 0.4))',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: '1px solid var(--neon-purple-border)',
            }}
          >
            <span
              style={{
                color: 'var(--neon-purple)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                fontWeight: 600,
              }}
            >
              Tasks
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {visibleStuckTasks.length > 0 && (
                <button
                  className="conflict-badge-btn"
                  onClick={() => setHealthDrawerOpen(true)}
                  title="Stuck tasks detected"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Badge variant="warning" size="sm">
                    {visibleStuckTasks.length}
                  </Badge>
                </button>
              )}
              {conflictingTasks.length > 0 && (
                <button
                  className="conflict-badge-btn"
                  onClick={() => setConflictDrawerOpen(true)}
                  title="View merge conflicts"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Badge variant="danger" size="sm">
                    {conflictingTasks.length}
                  </Badge>
                </button>
              )}
              <button
                onClick={openWorkbench}
                title="New Ticket"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: '1px solid var(--neon-cyan-border)',
                  background: 'var(--neon-cyan-surface)',
                  color: 'var(--neon-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Repo Filter */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--neon-purple-border)',
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
            }}
          >
            {REPO_OPTIONS.map((r) => (
              <button
                key={r.label}
                onClick={() => setRepoFilter(repoFilter === r.label ? null : r.label)}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  borderRadius: '4px',
                  border: `1px solid ${repoFilter === r.label ? r.color : 'rgba(255, 255, 255, 0.1)'}`,
                  background: repoFilter === r.label ? `${r.color}22` : 'rgba(10, 0, 21, 0.4)',
                  color: repoFilter === r.label ? r.color : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: 600,
                }}
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setRepoFilter(null)}
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                borderRadius: '4px',
                border: `1px solid ${repoFilter === null ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.1)'}`,
                background: repoFilter === null ? 'var(--neon-cyan-surface)' : 'rgba(10, 0, 21, 0.4)',
                color: repoFilter === null ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 600,
              }}
            >
              All
            </button>
          </div>

          {/* Task List */}
          <ErrorBoundary name="SprintTaskList">
            {loadError && tasks.length === 0 ? (
              <div style={{ padding: '16px', color: 'rgba(255, 255, 255, 0.5)' }}>
                <p style={{ marginBottom: '12px', fontSize: '13px' }}>{loadError}</p>
                <Button variant="primary" size="sm" onClick={loadData} disabled={loading}>
                  {loading ? 'Retrying…' : 'Retry'}
                </Button>
              </div>
            ) : (
              <SprintTaskList
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={(task) => setSelectedTaskId(task.id)}
                repoFilter={repoFilter}
              />
            )}
          </ErrorBoundary>
        </div>

        {/* Right: Detail Pane */}
        <ErrorBoundary name="SprintDetailPane">
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <SprintDetailPane
              task={selectedTask}
              onClose={() => setSelectedTaskId(null)}
              onLaunch={launchTask}
              onStop={handleStop}
              onRerun={handleRerun}
              onMarkDone={handleMarkDone}
              onDelete={deleteTask}
              onSaveSpec={handleSaveSpec}
            />
          </div>
        </ErrorBoundary>
      </div>

      {/* Drawers */}
      <ConflictDrawer
        open={conflictDrawerOpen}
        tasks={conflictingTasks}
        onClose={() => setConflictDrawerOpen(false)}
      />

      <HealthCheckDrawer
        open={healthDrawerOpen}
        tasks={visibleStuckTasks}
        onClose={() => setHealthDrawerOpen(false)}
        onDismiss={dismissTask}
      />

      <ConfirmModal {...confirmProps} />
    </motion.div>
  )
}
