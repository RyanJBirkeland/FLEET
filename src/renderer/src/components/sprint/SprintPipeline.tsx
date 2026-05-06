import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { VARIANTS, SPRINGS, REDUCED_TRANSITION, useReducedMotion } from '../../lib/motion'
import { useSprintFilters } from '../../stores/sprintFilters'
import type { StatusFilter } from '../../stores/sprintFilters'
import { useSprintTasks } from '../../stores/sprintTasks'
import { usePanelLayoutStore } from '../../stores/panelLayout'
import { useSprintUI, selectOrphanRecoveryBanner } from '../../stores/sprintUI'
import { useTaskWorkbenchModalStore } from '../../stores/taskWorkbenchModal'
import { setOpenLogDrawerTaskId, useTaskToasts } from '../../hooks/useTaskNotifications'
import { useSprintKeyboardShortcuts } from '../../hooks/useSprintKeyboardShortcuts'
import { useSprintTaskActions } from '../../hooks/useSprintTaskActions'
import { useVisibleStuckTasks } from '../../hooks/useVisibleStuckTasks'
import { useSprintPipelineState } from '../../hooks/useSprintPipelineState'
import { useDrainStatus } from '../../hooks/useDrainStatus'
import { useNow } from '../../hooks/useNow'
import { useRepoOptions } from '../../hooks/useRepoOptions'
import { toast } from '../../stores/toasts'
import { PipelineBacklog } from './PipelineBacklog'
import { PipelineStage } from './PipelineStage'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { PipelineErrorBoundary } from './PipelineErrorBoundary'
import { PipelineFilterBar } from './PipelineFilterBar'
import { PipelineFilterBanner } from './PipelineFilterBanner'
import { PipelineHeader } from './PipelineHeader'
import type { ExportFormat } from './ExportDropdown'
import { PipelineOverlays } from './PipelineOverlays'
import { DagOverlay } from './DagOverlay'
import type { useConfirm } from '../ui/ConfirmModal'
import { BulkActionBar } from './BulkActionBar'
import { PollErrorBanner } from './banners/PollErrorBanner'
import { DrainPausedBanner } from './banners/DrainPausedBanner'
import { OrphanRecoveryBanner } from './banners/OrphanRecoveryBanner'
import type { SprintTask } from '../../../../shared/types'
import { WIP_LIMIT_IN_PROGRESS } from '../../lib/constants'
import { useSprintPipelineCommands } from '../../hooks/useSprintPipelineCommands'

import './SprintPipeline.css'

const STAGE_MIN_WIDTH = '220px'

function PipelineStageGrid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(6, minmax(${STAGE_MIN_WIDTH}, 1fr))`,
          gap: 'var(--s-3)',
          padding: 'var(--s-4)',
          height: '100%',
          boxSizing: 'border-box',
          alignItems: 'stretch'
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface PipelineLoadErrorProps {
  message: string
  loading: boolean
  onRetry: () => void
}

function PipelineLoadError({ message, loading, onRetry }: PipelineLoadErrorProps): React.JSX.Element {
  return (
    <div className="pipeline-state">
      <div className="pipeline-state__column">
        <span className="fleet-eyebrow">ERROR</span>
        <span className="pipeline-state__title">Error loading tasks</span>
        <p className="pipeline-state__hint">{message}</p>
        <button onClick={onRetry} disabled={loading} className="pipeline-state__cta">
          {loading ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </div>
  )
}

interface NoRepositoryStateProps {
  onNavigateToSettings: () => void
}

function NoRepositoryState({ onNavigateToSettings }: NoRepositoryStateProps): React.JSX.Element {
  return (
    <div className="pipeline-state">
      <div className="pipeline-state__column">
        <span className="fleet-eyebrow">NO REPOSITORY</span>
        <span className="pipeline-state__title pipeline-state__title--lg">
          No repository configured
        </span>
        <p className="pipeline-state__hint pipeline-state__hint--center">
          Add a repository in Settings before creating tasks.
        </p>
        <button onClick={onNavigateToSettings} className="pipeline-state__cta">
          Configure Repository
        </button>
      </div>
    </div>
  )
}

interface EmptyPipelineStateProps {
  onCreateTask: () => void
}

function EmptyPipelineState({ onCreateTask }: EmptyPipelineStateProps): React.JSX.Element {
  return (
    <div className="pipeline-state">
      <div className="pipeline-state__column">
        <span className="fleet-eyebrow">PIPELINE</span>
        <span className="pipeline-state__title pipeline-state__title--lg">No tasks yet</span>
        <p className="pipeline-state__hint pipeline-state__hint--center">
          Create your first task to start the pipeline.
        </p>
        <button onClick={onCreateTask} className="pipeline-state__cta">
          New Task
        </button>
      </div>
    </div>
  )
}

function PipelineLoadingSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="Loading pipeline" className="sprint-pipeline__body">
      <div className="pipeline-sidebar pipeline-sidebar--loading">
        <div aria-hidden="true" className="fleet-skeleton pipeline-skeleton--sidebar" />
      </div>
      <div className="pipeline-center pipeline-center--loading">
        <div aria-hidden="true" className="fleet-skeleton pipeline-skeleton--stage" />
        <div aria-hidden="true" className="fleet-skeleton pipeline-skeleton--stage" />
        <div aria-hidden="true" className="fleet-skeleton pipeline-skeleton--stage" />
      </div>
    </div>
  )
}

type HeaderStatFilter = 'in-progress' | 'todo' | 'blocked' | 'review' | 'open-prs' | 'failed' | 'done'

// PipelineControlBarProps decomposed (T-28) into four cohesive views — each ≤8 props —
// composed below. Each sub-section maps to a single sub-component the control bar renders.

interface HeaderSectionProps {
  headerStats: { label: string; count: number; filter: HeaderStatFilter }[]
  conflictingTasks: SprintTask[]
  visibleStuckTasks: SprintTask[]
  statusFilter: StatusFilter
  dagOpen: boolean
  onFilterClick: (filter: HeaderStatFilter) => void
  onConflictClick: () => void
  onHealthCheckClick: () => void
}

interface OperatorActionsProps {
  onDagToggle: () => void
  onOpenWorkbench: () => void
  onExportTasks: (format: ExportFormat) => Promise<void>
  onTriggerDrain: () => Promise<void>
}

interface SelectionSectionProps {
  selectedTaskIds: Set<string>
  onClearSelection: () => void
}

interface FilterSectionProps {
  tasks: SprintTask[]
  filteredTasks: SprintTask[]
}

interface BannerSectionProps {
  pollError: string | null
  loading: boolean
  tasksEmpty: boolean
  orphanBanner: { recovered: unknown[]; exhausted: unknown[] } | null
  drainStatus: { reason: string; affectedTaskCount: number; pausedUntil: number } | null
  now: number
  onPollRetry: () => void
  onPollDismiss: () => void
  onOrphanDismiss: () => void
}

interface PipelineControlBarProps {
  header: HeaderSectionProps
  actions: OperatorActionsProps
  selection: SelectionSectionProps
  filter: FilterSectionProps
  banners: BannerSectionProps
}

function PipelineControlBar({
  header,
  actions,
  selection,
  filter,
  banners
}: PipelineControlBarProps): React.JSX.Element {
  return (
    <>
      <PipelineHeader
        stats={header.headerStats}
        conflictingTasks={header.conflictingTasks}
        visibleStuckTasks={header.visibleStuckTasks}
        onFilterClick={header.onFilterClick}
        activeFilter={header.statusFilter}
        onConflictClick={header.onConflictClick}
        onHealthCheckClick={header.onHealthCheckClick}
        onDagToggle={actions.onDagToggle}
        dagOpen={header.dagOpen}
        onOpenWorkbench={actions.onOpenWorkbench}
        onExportTasks={actions.onExportTasks}
        onTriggerDrain={actions.onTriggerDrain}
      />
      <BulkActionBar
        selectedCount={selection.selectedTaskIds.size}
        selectedTaskIds={selection.selectedTaskIds}
        onClearSelection={selection.onClearSelection}
      />
      <PipelineFilterBar tasks={filter.tasks} />
      <PipelineFilterBanner filteredTasks={filter.filteredTasks} totalTasks={filter.tasks} />
      <PipelineBanners {...banners} />
    </>
  )
}

function PipelineBanners({
  pollError,
  loading,
  tasksEmpty,
  orphanBanner,
  drainStatus,
  now,
  onPollRetry,
  onPollDismiss,
  onOrphanDismiss
}: BannerSectionProps): React.JSX.Element {
  return (
    <>
      {pollError && (
        <PollErrorBanner
          message={pollError}
          loading={loading && tasksEmpty}
          onRetry={onPollRetry}
          onDismiss={onPollDismiss}
        />
      )}
      {orphanBanner && (
        <OrphanRecoveryBanner
          recoveredCount={orphanBanner.recovered.length}
          exhaustedCount={orphanBanner.exhausted.length}
          onDismiss={onOrphanDismiss}
        />
      )}
      {drainStatus && (
        <DrainPausedBanner
          reason={drainStatus.reason}
          affectedTaskCount={drainStatus.affectedTaskCount}
          pausedUntil={drainStatus.pausedUntil}
          now={now}
        />
      )}
    </>
  )
}

interface PipelineActiveBodyProps {
  tasks: SprintTask[]
  filteredPartition: {
    backlog: SprintTask[]
    failed: SprintTask[]
    todo: SprintTask[]
    blocked: SprintTask[]
    inProgress: SprintTask[]
    pendingReview: SprintTask[]
    openPrs: SprintTask[]
    done: SprintTask[]
  }
  selectedTaskId: string | null
  selectedTaskIds: Set<string>
  selectedTask: SprintTask | null
  drawerOpen: boolean
  taskTitlesById: Map<string, string>
  onTaskClick: (id: string) => void
  onToggleTaskSelection: (id: string) => void
  onAddToQueue: (task: SprintTask) => void
  onRerun: (task: SprintTask) => void
  onClearFailures: () => void
  onRequeueAllFailed: () => void
  onSetDoneViewOpen: (open: boolean) => void
  onCloseDrawer: () => void
  onLaunch: (task: SprintTask) => void
  onStop: (task: SprintTask) => void
  onDelete: (task: SprintTask) => void
  onViewLogs: () => void
  onOpenSpec: () => void
  onEdit: () => void
  onViewAgents: () => void
  onUnblock: (task: SprintTask) => void
  onRetry: (task: SprintTask) => void
  onReviewChanges: (task: SprintTask) => void
  onExport: (task: SprintTask) => void
}

function PipelineActiveBody({
  tasks,
  filteredPartition,
  selectedTaskId,
  selectedTaskIds,
  selectedTask,
  drawerOpen,
  taskTitlesById,
  onTaskClick,
  onToggleTaskSelection,
  onAddToQueue,
  onRerun,
  onClearFailures,
  onRequeueAllFailed,
  onSetDoneViewOpen,
  onCloseDrawer,
  onLaunch,
  onStop,
  onDelete,
  onViewLogs,
  onOpenSpec,
  onEdit,
  onViewAgents,
  onUnblock,
  onRetry,
  onReviewChanges,
  onExport
}: PipelineActiveBodyProps): React.JSX.Element {
  const bodyClass = `sprint-pipeline__body${tasks.length === 0 ? ' sprint-pipeline__body--hidden' : ''}`
  return (
    <PipelineErrorBoundary fallbackLabel="Pipeline crashed">
      <div className={bodyClass}>
        <PipelineBacklog
          backlog={filteredPartition.backlog}
          failed={filteredPartition.failed}
          selectedTaskIds={selectedTaskIds}
          onToggleTaskSelection={onToggleTaskSelection}
          onTaskClick={onTaskClick}
          onAddToQueue={onAddToQueue}
          onRerun={onRerun}
          onClearFailures={onClearFailures}
          onRequeueAllFailed={onRequeueAllFailed}
        />
        <PipelineStageGrid>
          <LayoutGroup>
            <PipelineStage
              name="queued"
              label="Queued"
              tasks={filteredPartition.todo}
              count={`${filteredPartition.todo.length}`}
              selectedTaskId={selectedTaskId}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={onTaskClick}
            />
            <PipelineStage
              name="blocked"
              label="Blocked"
              tasks={filteredPartition.blocked}
              count={`${filteredPartition.blocked.length}`}
              selectedTaskId={selectedTaskId}
              selectedTaskIds={selectedTaskIds}
              taskTitlesById={taskTitlesById}
              onTaskClick={onTaskClick}
            />
            <PipelineStage
              name="active"
              label="Active"
              tasks={filteredPartition.inProgress}
              count={`${filteredPartition.inProgress.length}/${WIP_LIMIT_IN_PROGRESS}`}
              selectedTaskId={selectedTaskId}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={onTaskClick}
            />
            <PipelineStage
              name="review"
              label="Review"
              tasks={filteredPartition.pendingReview}
              count={`${filteredPartition.pendingReview.length}`}
              selectedTaskId={selectedTaskId}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={onTaskClick}
            />
            <PipelineStage
              name="open-prs"
              label="PRs"
              tasks={filteredPartition.openPrs}
              count={`${filteredPartition.openPrs.length}`}
              selectedTaskId={selectedTaskId}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={onTaskClick}
            />
            <PipelineStage
              name="done"
              label="Done"
              tasks={filteredPartition.done.slice(0, 3)}
              count={`${filteredPartition.done.length}`}
              selectedTaskId={selectedTaskId}
              selectedTaskIds={selectedTaskIds}
              onTaskClick={onTaskClick}
              doneFooter={
                filteredPartition.done.length > 3 ? (
                  <button
                    className="pipeline-stage__done-summary"
                    onClick={() => onSetDoneViewOpen(true)}
                  >
                    {filteredPartition.done.length} completed · View all
                  </button>
                ) : undefined
              }
            />
          </LayoutGroup>
        </PipelineStageGrid>
        {drawerOpen && selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            onClose={onCloseDrawer}
            onLaunch={onLaunch}
            onStop={onStop}
            onDelete={onDelete}
            onViewLogs={onViewLogs}
            onOpenSpec={onOpenSpec}
            onEdit={onEdit}
            onViewAgents={onViewAgents}
            onUnblock={onUnblock}
            onRetry={onRetry}
            onReviewChanges={onReviewChanges}
            onExport={onExport}
          />
        )}
      </div>
    </PipelineErrorBoundary>
  )
}

interface PipelinePostContentProps {
  specPanelOpen: boolean
  selectedTask: SprintTask | null
  onCloseSpec: () => void
  onSaveSpec: (taskId: string, newSpec: string) => Promise<void>
  doneViewOpen: boolean
  doneTasks: SprintTask[]
  onCloseDoneView: () => void
  onTaskClick: (id: string) => void
  conflictDrawerOpen: boolean
  conflictingTasks: SprintTask[]
  onCloseConflict: () => void
  healthCheckDrawerOpen: boolean
  visibleStuckTasks: SprintTask[]
  onCloseHealthCheck: () => void
  onDismissStuckTask: (taskId: string) => void
  confirmProps: ReturnType<typeof useConfirm>['confirmProps']
  dagOpen: boolean
  tasks: SprintTask[]
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
  onCloseDag: () => void
}

function PipelinePostContent({
  dagOpen,
  tasks,
  selectedTaskId,
  onSelectTask,
  onCloseDag,
  ...overlayProps
}: PipelinePostContentProps): React.JSX.Element {
  return (
    <>
      <PipelineOverlays {...overlayProps} />
      {dagOpen && (
        <DagOverlay
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onClose={onCloseDag}
        />
      )}
    </>
  )
}

export function SprintPipeline(): React.JSX.Element {
  const {
    tasks,
    loading,
    loadError,
    updateTask,
    loadData,
    batchRequeueTasks,
    selectedTaskId,
    selectedTaskIds,
    drawerOpen,
    specPanelOpen,
    logDrawerTaskId,
    setSelectedTaskId,
    setDrawerOpen,
    setSpecPanelOpen,
    setLogDrawerTaskId,
    clearMultiSelection,
    toggleTaskSelection,
    doneViewOpen,
    conflictDrawerOpen,
    healthCheckDrawerOpen,
    setDoneViewOpen,
    setConflictDrawerOpen,
    setHealthCheckDrawerOpen,
    selectCodeReviewTask,
    initTaskOutputListener,
    filteredTasks,
    filteredPartition,
    partition,
    selectedTask,
    conflictingTasks
  } = useSprintPipelineState()

  const pollError = useSprintTasks((s) => s.pollError)
  const clearPollError = useSprintTasks((s) => s.clearPollError)
  const exportTaskHistoryAction = useSprintTasks((s) => s.exportTaskHistory)

  const orphanBanner = useSprintUI(selectOrphanRecoveryBanner)
  const dismissOrphanBanner = useSprintUI((s) => s.setOrphanRecoveryBanner)

  const drainStatus = useDrainStatus()
  const now = useNow()
  const repos = useRepoOptions()

  const setStatusFilter = useSprintFilters((s) => s.setStatusFilter)
  const statusFilter = useSprintFilters((s) => s.statusFilter)
  const setView = usePanelLayoutStore((s) => s.setView)
  const reduced = useReducedMotion()
  const openWorkbenchForCreate = useTaskWorkbenchModalStore((s) => s.openForCreate)
  const openForEdit = useTaskWorkbenchModalStore((s) => s.openForEdit)
  const openWorkbench = useCallback(() => openWorkbenchForCreate(), [openWorkbenchForCreate])

  const {
    handleSaveSpec,
    handleStop,
    handleRerun,
    handleRetry,
    launchTask,
    deleteTask,
    batchDeleteTasks,
    unblockTask,
    exportTasks: handleExportTasks,
    triggerDrain: handleTriggerDrain,
    confirmProps
  } = useSprintTaskActions()

  const { visibleStuckTasks, dismissTask } = useVisibleStuckTasks()

  const triggerRef = useRef<HTMLElement | null>(null)

  useSprintPipelineCommands({ openWorkbench, handleStop, handleRetry, setStatusFilter })

  const [dagOpen, setDagOpen] = useState(false)
  // Ref mirror of dagOpen so `handleDagToggle` can flip it without re-creating the callback
  // (T-30: stable callback identity is preserved across renders that don't change deps).
  const dagOpenRef = useRef(dagOpen)
  useEffect(() => {
    dagOpenRef.current = dagOpen
  }, [dagOpen])

  useEffect(() => {
    const cleanup = initTaskOutputListener()
    return cleanup
  }, [initTaskOutputListener])

  useEffect(() => {
    setOpenLogDrawerTaskId(logDrawerTaskId)
    return () => setOpenLogDrawerTaskId(null)
  }, [logDrawerTaskId])

  const handleViewOutput = useCallback(
    (task: SprintTask) => {
      setLogDrawerTaskId(task.id)
    },
    [setLogDrawerTaskId]
  )
  useTaskToasts(tasks, logDrawerTaskId, handleViewOutput)

  useSprintKeyboardShortcuts({
    openWorkbench,
    setConflictDrawerOpen: (value) => {
      setConflictDrawerOpen(typeof value === 'function' ? value(conflictDrawerOpen) : value)
    }
  })

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      const active = partition.inProgress[0] || partition.todo[0]
      if (active) setSelectedTaskId(active.id)
    }
  }, [tasks, selectedTaskId, partition, setSelectedTaskId])

  const handleTaskClick = useCallback(
    (id: string) => {
      const activeEl = document.activeElement
      triggerRef.current = activeEl instanceof HTMLElement ? activeEl : null
      setSelectedTaskId(id)
    },
    [setSelectedTaskId]
  )

  const handleAddToQueue = useCallback(
    async (task: SprintTask) => {
      try {
        await updateTask(task.id, { status: 'queued' })
      } catch {
        // Error already shown by updateTask; store reverts optimistic update
      }
    },
    [updateTask]
  )

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
    setSelectedTaskId(null)
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
      triggerRef.current = null
    })
  }, [setDrawerOpen, setSelectedTaskId])

  const handleDeleteTask = useCallback(
    (task: SprintTask) => {
      void deleteTask(task.id)
    },
    [deleteTask]
  )

  const handleUnblock = useCallback((task: SprintTask) => unblockTask(task.id), [unblockTask])

  const handleEdit = useCallback(() => {
    if (selectedTask) openForEdit(selectedTask)
  }, [selectedTask, openForEdit])

  const handleReviewChanges = useCallback(
    (task: SprintTask): void => {
      selectCodeReviewTask(task.id)
      setView('code-review')
    },
    [selectCodeReviewTask, setView]
  )

  const handleClearFailures = useCallback(() => {
    void batchDeleteTasks(filteredPartition.failed.map((t) => t.id))
  }, [filteredPartition.failed, batchDeleteTasks])

  const handleRequeueAllFailed = useCallback(() => {
    void batchRequeueTasks(filteredPartition.failed.map((t) => t.id))
  }, [filteredPartition.failed, batchRequeueTasks])

  const handleExport = useCallback(
    async (task: SprintTask) => {
      try {
        const result = await exportTaskHistoryAction(task.id)
        if (result.success) toast.success(`Task history exported to ${result.path}`)
      } catch (err) {
        toast.error(`Failed to export: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [exportTaskHistoryAction]
  )

  const headerStats = useMemo(
    () => [
      { label: 'active', count: partition.inProgress.length, filter: 'in-progress' as const },
      { label: 'queued', count: partition.todo.length, filter: 'todo' as const },
      { label: 'blocked', count: partition.blocked.length, filter: 'blocked' as const },
      { label: 'review', count: partition.pendingReview.length, filter: 'review' as const },
      { label: 'PRs', count: partition.openPrs.length, filter: 'open-prs' as const },
      { label: 'failed', count: partition.failed.length, filter: 'failed' as const },
      { label: 'done', count: partition.done.length, filter: 'done' as const }
    ],
    [partition]
  )

  const taskTitlesById = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks])

  const handleSelectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId)
      setDrawerOpen(true)
    },
    [setSelectedTaskId, setDrawerOpen]
  )

  // T-30: stabilize control-bar callbacks so PipelineControlBar / PipelineHeader / banners
  // see referentially stable handlers across renders that don't actually change deps.
  const handleOpenConflict = useCallback(
    () => setConflictDrawerOpen(true),
    [setConflictDrawerOpen]
  )
  const handleOpenHealthCheck = useCallback(
    () => setHealthCheckDrawerOpen(true),
    [setHealthCheckDrawerOpen]
  )
  const handleDagToggle = useCallback(() => setDagOpen(!dagOpenRef.current), [])
  const handlePollRetry = useCallback(() => {
    clearPollError()
    void loadData()
  }, [clearPollError, loadData])
  const handleOrphanDismiss = useCallback(
    () => dismissOrphanBanner(null),
    [dismissOrphanBanner]
  )

  const headerSection: HeaderSectionProps = useMemo(
    () => ({
      headerStats,
      conflictingTasks,
      visibleStuckTasks,
      statusFilter,
      dagOpen,
      onFilterClick: setStatusFilter,
      onConflictClick: handleOpenConflict,
      onHealthCheckClick: handleOpenHealthCheck
    }),
    [
      headerStats,
      conflictingTasks,
      visibleStuckTasks,
      statusFilter,
      dagOpen,
      setStatusFilter,
      handleOpenConflict,
      handleOpenHealthCheck
    ]
  )

  const operatorActions: OperatorActionsProps = useMemo(
    () => ({
      onDagToggle: handleDagToggle,
      onOpenWorkbench: openWorkbench,
      onExportTasks: handleExportTasks,
      onTriggerDrain: handleTriggerDrain
    }),
    [handleDagToggle, openWorkbench, handleExportTasks, handleTriggerDrain]
  )

  const selectionSection: SelectionSectionProps = useMemo(
    () => ({
      selectedTaskIds,
      onClearSelection: clearMultiSelection
    }),
    [selectedTaskIds, clearMultiSelection]
  )

  const filterSection: FilterSectionProps = useMemo(
    () => ({ tasks, filteredTasks }),
    [tasks, filteredTasks]
  )

  const bannerSection: BannerSectionProps = useMemo(
    () => ({
      pollError,
      loading,
      tasksEmpty: tasks.length === 0,
      orphanBanner,
      drainStatus,
      now,
      onPollRetry: handlePollRetry,
      onPollDismiss: clearPollError,
      onOrphanDismiss: handleOrphanDismiss
    }),
    [
      pollError,
      loading,
      tasks.length,
      orphanBanner,
      drainStatus,
      now,
      handlePollRetry,
      clearPollError,
      handleOrphanDismiss
    ]
  )

  const controlBarProps: PipelineControlBarProps = {
    header: headerSection,
    actions: operatorActions,
    selection: selectionSection,
    filter: filterSection,
    banners: bannerSection
  }

  const handleViewAgents = useCallback(() => setView('agents'), [setView])
  const handleOpenSpec = useCallback(() => setSpecPanelOpen(true), [setSpecPanelOpen])

  const activeBodyProps: PipelineActiveBodyProps = {
    tasks,
    filteredPartition,
    selectedTaskId,
    selectedTaskIds,
    selectedTask,
    drawerOpen,
    taskTitlesById,
    onTaskClick: handleTaskClick,
    onToggleTaskSelection: toggleTaskSelection,
    onAddToQueue: handleAddToQueue,
    onRerun: handleRerun,
    onClearFailures: handleClearFailures,
    onRequeueAllFailed: handleRequeueAllFailed,
    onSetDoneViewOpen: setDoneViewOpen,
    onCloseDrawer: handleCloseDrawer,
    onLaunch: launchTask,
    onStop: handleStop,
    onDelete: handleDeleteTask,
    onViewLogs: handleViewAgents,
    onOpenSpec: handleOpenSpec,
    onEdit: handleEdit,
    onViewAgents: handleViewAgents,
    onUnblock: handleUnblock,
    onRetry: handleRetry,
    onReviewChanges: handleReviewChanges,
    onExport: handleExport
  }

  const handleCloseSpec = useCallback(() => setSpecPanelOpen(false), [setSpecPanelOpen])
  const handleCloseDoneView = useCallback(() => setDoneViewOpen(false), [setDoneViewOpen])
  const handleCloseConflict = useCallback(
    () => setConflictDrawerOpen(false),
    [setConflictDrawerOpen]
  )
  const handleCloseHealthCheck = useCallback(
    () => setHealthCheckDrawerOpen(false),
    [setHealthCheckDrawerOpen]
  )
  const handleCloseDag = useCallback(() => setDagOpen(false), [])
  const handleNavigateToSettings = useCallback(() => setView('settings'), [setView])
  const handleLoadDataRetry = useCallback(() => void loadData(), [loadData])

  const postContentProps: PipelinePostContentProps = {
    specPanelOpen,
    selectedTask,
    onCloseSpec: handleCloseSpec,
    onSaveSpec: handleSaveSpec,
    doneViewOpen,
    doneTasks: filteredPartition.done,
    onCloseDoneView: handleCloseDoneView,
    onTaskClick: handleTaskClick,
    conflictDrawerOpen,
    conflictingTasks,
    onCloseConflict: handleCloseConflict,
    healthCheckDrawerOpen,
    visibleStuckTasks,
    onCloseHealthCheck: handleCloseHealthCheck,
    onDismissStuckTask: dismissTask,
    confirmProps,
    dagOpen,
    tasks,
    selectedTaskId,
    onSelectTask: handleSelectTask,
    onCloseDag: handleCloseDag
  }

  return (
    <motion.div
      className="sprint-pipeline"
      data-testid="sprint-pipeline"
      variants={VARIANTS.fadeIn}
      initial="initial"
      animate="animate"
      transition={reduced ? REDUCED_TRANSITION : SPRINGS.snappy}
    >
      <PipelineControlBar {...controlBarProps} />
      {loading && tasks.length === 0 && <PipelineLoadingSkeleton />}
      {loadError && (
        <PipelineLoadError message={loadError} loading={loading} onRetry={handleLoadDataRetry} />
      )}
      {!loading && !loadError && tasks.length === 0 && (
        repos.length === 0
          ? <NoRepositoryState onNavigateToSettings={handleNavigateToSettings} />
          : <EmptyPipelineState onCreateTask={openWorkbench} />
      )}
      <PipelineActiveBody {...activeBodyProps} />
      <PipelinePostContent {...postContentProps} />
    </motion.div>
  )
}
